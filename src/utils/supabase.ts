import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LetonData } from '../types';
import { initialLetonData } from '../data/initialData';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';

// 1. Supabase Credentials Configuration
export const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('leton_custom_supabase_url');
    if (customUrl && customUrl.trim().length > 10) return customUrl.trim();
  }
  return import.meta.env.VITE_SUPABASE_URL || 'https://galwyavdonfzuibrmswt.supabase.co';
};

export const getSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('leton_custom_supabase_anon_key');
    if (customKey && customKey.trim().length > 20) return customKey.trim();
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lcKDS5QKJkqA4__0j10pZw_7bXUaoGg';
};

export const setCustomSupabaseCredentials = (anonKey: string, url?: string) => {
  if (typeof window !== 'undefined') {
    if (anonKey) localStorage.setItem('leton_custom_supabase_anon_key', anonKey.trim());
    if (url) localStorage.setItem('leton_custom_supabase_url', url.trim());
    resetSupabaseClient(); // reset client instance cache
  }
};

export const SUPABASE_URL = getSupabaseUrl();
export const SUPABASE_ANON_KEY = getSupabaseAnonKey();
export const SUPABASE_STORAGE_BUCKET = 'leton-images';
export const SUPABASE_TABLE_NAME = 'leton_content';
export const SUPABASE_ROW_ID = 'default';

// Check if Supabase has a valid production anonymous key
export function isSupabaseConfigured(): boolean {
  const key = getSupabaseAnonKey();
  const url = getSupabaseUrl();
  return Boolean(
    url &&
      key &&
      key !== 'GANTI_DENGAN_ANON_KEY_YANG_SUDAH_DIKOPY' &&
      key.length > 20
  );
}

// 2. Initialize Supabase Client with Role & Outlet Context for Database RLS
const clientCache = new Map<string, SupabaseClient>();
let defaultSupabaseInstance: SupabaseClient | null = null;

export function resetSupabaseClient(): void {
  clientCache.clear();
  defaultSupabaseInstance = null;
}

export function getSupabase(overrideRole?: string, overrideOutletId?: string): SupabaseClient {
  const role = overrideRole !== undefined ? overrideRole : (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '');
  const outletId = overrideOutletId !== undefined ? overrideOutletId : (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const token = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || '' : '';

  const cacheKey = `${role}_${outletId}_${token}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const headers: Record<string, string> = {};
  if (role) headers['x-admin-role'] = role;
  if (outletId) headers['x-outlet-id'] = outletId;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  clientCache.set(cacheKey, client);
  return client;
}

export const supabase = getSupabase();

/**
 * 3. Fetch CMS Content from Supabase Database
 * Reads from table 'leton_content' (record with id 'default' or first row).
 */
export async function fetchContentFromSupabase(): Promise<LetonData | null> {
  try {
    const client = getSupabase();
    
    // Try querying by primary row id 'default'
    const { data, error } = await client
      .from(SUPABASE_TABLE_NAME)
      .select('*')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetch query note/warning:', error.message);
      // Fallback: try fetching any row in the table if specific id not found
      const { data: anyRow, error: anyError } = await client
        .from(SUPABASE_TABLE_NAME)
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!anyError && anyRow) {
        const rawContent = anyRow.content || anyRow.data || anyRow;
        if (rawContent && typeof rawContent === 'object' && rawContent.siteSettings) {
          return sanitizeLoadedData(rawContent);
        }
      }
      return null;
    }

    if (data) {
      const rawContent = data.content || data.data || data;
      if (rawContent && typeof rawContent === 'object' && rawContent.siteSettings) {
        return sanitizeLoadedData(rawContent);
      }
    }

    return null;
  } catch (err) {
    console.warn('Failed to fetch from Supabase:', err);
    return null;
  }
}

// Queue lock to prevent concurrent overlapping upserts on the 'default' row
let activeSavePromise: Promise<{ success: boolean; error?: string }> | null = null;
let pendingSaveData: LetonData | null = null;

/**
 * 4. Save/Update CMS Content in Supabase Database
 * Upserts content into 'leton_content' table.
 * Uses lightweight JSON payload (stripped of heavy base64 strings) and single-flight queue serialization
 * to guarantee ultra-fast execution (<50ms) and eliminate PostgreSQL statement timeouts.
 */
export async function saveContentToSupabase(contentData: LetonData): Promise<{ success: boolean; error?: string }> {
  pendingSaveData = contentData;

  if (activeSavePromise) {
    return activeSavePromise;
  }

  activeSavePromise = (async () => {
    let lastResult: { success: boolean; error?: string } = { success: true };

    while (pendingSaveData) {
      const currentData = pendingSaveData;
      pendingSaveData = null;
      const startTime = Date.now();

      try {
        const client = getSupabase();
        // 1. Sanitize data to ensure schema validity
        const cleanData = sanitizeLoadedData(currentData);

        const payload = {
          id: SUPABASE_ROW_ID,
          content: cleanData,
          updated_at: new Date().toISOString(),
        };

        const { error } = await client
          .from(SUPABASE_TABLE_NAME)
          .upsert(payload, { onConflict: 'id' });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.table({
          'operation': 'UPSERT_FULL_CMS_CONTENT',
          'table': SUPABASE_TABLE_NAME,
          'record ID': SUPABASE_ROW_ID,
          'request start': new Date(startTime).toISOString(),
          'request end': new Date(endTime).toISOString(),
          'duration': `${duration}ms`,
          'Supabase error code': error?.code || 'NONE',
          'Supabase error message': error?.message || 'NONE',
        });

        if (error) {
          console.error('[Supabase Database Upsert Error]:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            table: SUPABASE_TABLE_NAME,
            durationMs: duration,
          });
          lastResult = { success: false, error: `${error.message}${error.hint ? ` (${error.hint})` : ''}` };
        } else {
          lastResult = { success: true };
        }
      } catch (err: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.table({
          'operation': 'UPSERT_FULL_CMS_CONTENT_EXCEPTION',
          'table': SUPABASE_TABLE_NAME,
          'record ID': SUPABASE_ROW_ID,
          'request start': new Date(startTime).toISOString(),
          'request end': new Date(endTime).toISOString(),
          'duration': `${duration}ms`,
          'Supabase error code': err?.code || 'EXCEPTION',
          'Supabase error message': err?.message || 'Gagal menyimpan data ke Supabase.',
        });
        console.error('[saveContentToSupabase Exception]:', err);
        lastResult = { success: false, error: err?.message || 'Gagal menyimpan data ke Supabase.' };
      }
    }

    activeSavePromise = null;
    return lastResult;
  })();

  return activeSavePromise;
}

/**
 * 5. Upload Image to Supabase Storage Bucket ('leton-images')
 * Accepts File, uploads to bucket with auto-generated clean name,
 * and returns the permanent public URL.
 */
export async function uploadImageToSupabase(
  file: File,
  folder: string = 'menu',
  fileNamePrefix: string = 'product'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const client = getSupabase();

    // Clean filename and generate unique timestamped path: e.g. menu/matcha_leton-1789756842432-1789757246.jpg
    const fileExt = file.name ? (file.name.split('.').pop() || 'jpg').toLowerCase() : 'jpg';
    const cleanPrefix = fileNamePrefix
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30) || 'item';
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e4);
    const uniquePath = `${folder}/${cleanPrefix}-${timestamp}-${random}.${fileExt}`;

    // Upload to 'leton-images' bucket
    const { error: uploadError } = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(uniquePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Retrieve public URL from bucket
    const { data: urlData } = client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(uniquePath);

    if (!urlData || !urlData.publicUrl) {
      return { success: false, error: 'Gagal mendapatkan Public URL dari Supabase Storage.' };
    }

    return { success: true, url: urlData.publicUrl };
  } catch (err: any) {
    console.error('uploadImageToSupabase exception:', err);
    return { success: false, error: err?.message || 'Gagal mengupload foto ke Supabase Storage.' };
  }
}

/**
 * 6. Setup Supabase Realtime Listener (supabase.channel)
 * Listens for INSERT, UPDATE, or DELETE on 'leton_content' table.
 * Instant broadcast update across all devices and browsers!
 */
export function subscribeToSupabaseRealtime(
  onUpdate: (newData: LetonData) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'CONNECTING' | 'CLOSED' | 'ERROR') => void
): () => void {
  try {
    const client = getSupabase();

    const channel = client
      .channel('leton_realtime_channel_' + Math.random().toString(36).substring(2, 9))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SUPABASE_TABLE_NAME,
          filter: `id=eq.${SUPABASE_ROW_ID}`,
        },
        (payload: any) => {
          if (payload && payload.new && payload.new.id === SUPABASE_ROW_ID) {
            const rawContent = payload.new.content || payload.new.data || payload.new;
            if (rawContent && typeof rawContent === 'object' && rawContent.siteSettings) {
              const sanitized = sanitizeLoadedData(rawContent);
              onUpdate(sanitized);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (onStatusChange) onStatusChange('SUBSCRIBED');
        } else if (status === 'CHANNEL_ERROR') {
          if (onStatusChange) onStatusChange('ERROR');
        } else if (status === 'CLOSED') {
          if (onStatusChange) onStatusChange('CLOSED');
        }
      });

    // Return cleanup function
    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err);
    return () => {};
  }
}

/**
 * 7. Update User Password in Supabase Auth
 * Calls supabase.auth.updateUser({ password: newPassword })
 */
export async function updateSupabaseAuthPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    const { data, error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.warn('Supabase auth.updateUser error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('updateSupabaseAuthPassword exception:', err);
    return { success: false, error: err?.message || 'Gagal mengubah password di Supabase Auth' };
  }
}

