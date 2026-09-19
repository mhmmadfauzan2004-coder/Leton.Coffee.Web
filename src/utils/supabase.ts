import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LetonData, CustomerProfile } from '../types';
import { initialLetonData } from '../data/initialData';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';
import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
} from './phone';

export {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
};

// 1. Supabase Credentials Configuration
export const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('leton_custom_supabase_url');
    if (customUrl && customUrl.trim().length > 10) return customUrl.trim();
  }
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('GANTI_DENGAN_URL_YANG_SUDAH_DIKOPY')) {
    return envUrl.trim();
  }
  return 'https://galwyavdonfzuibrmswt.supabase.co';
};

export const getSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('leton_custom_supabase_anon_key');
    if (customKey && customKey.trim().length > 20) return customKey.trim();
  }
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envKey && envKey.trim() && !envKey.includes('GANTI_DENGAN_ANON_KEY_YANG_SUDAH_DIKOPY') && envKey.trim().length > 20) {
    return envKey.trim();
  }
  return 'sb_publishable_lcKDS5QKJkqA4__0j10pZw_7bXUaoGg';
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
 * Strips heavy base64 strings so payload remains lightweight (~10KB) preventing PostgreSQL statement timeouts.
 * Performs direct single upsert and a mandatory read-back verification.
 */
export async function saveContentToSupabase(contentData: LetonData): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  try {
    const client = getSupabase();
    // 1. Sanitize data and strip any raw base64 data URIs (>500 chars) to prevent statement timeout
    const cleanData = sanitizeLoadedData(contentData);
    const lightweightData = stripHeavyBase64Images(cleanData);

    const payload = {
      id: SUPABASE_ROW_ID,
      content: lightweightData,
      updated_at: new Date().toISOString(),
    };

    // 2. Perform direct single upsert
    const { error: upsertError } = await client
      .from(SUPABASE_TABLE_NAME)
      .upsert(payload, { onConflict: 'id' });

    const upsertDuration = Date.now() - startTime;

    if (upsertError) {
      console.error('[Supabase Database Upsert Error]:', {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
        table: SUPABASE_TABLE_NAME,
        durationMs: upsertDuration,
      });
      return {
        success: false,
        error: `Database error: ${upsertError.message}${upsertError.hint ? ` (${upsertError.hint})` : ''}`,
      };
    }

    // 3. Mandatory 1-time Read-Back Verification to ensure data is saved
    const readBackStart = Date.now();
    const { data: verifyRow, error: verifyError } = await client
      .from(SUPABASE_TABLE_NAME)
      .select('content')
      .eq('id', SUPABASE_ROW_ID)
      .single();

    const readBackDuration = Date.now() - readBackStart;

    if (verifyError || !verifyRow?.content) {
      console.error('[Supabase Read-Back Verification Error]:', verifyError);
      return {
        success: false,
        error: `Read-back verification failed: ${verifyError?.message || 'Record not found'}`,
      };
    }

    console.table({
      'operation': 'UPSERT_AND_VERIFY',
      'table': SUPABASE_TABLE_NAME,
      'record ID': SUPABASE_ROW_ID,
      'upsert duration': `${upsertDuration}ms`,
      'read-back duration': `${readBackDuration}ms`,
      'total duration': `${Date.now() - startTime}ms`,
      'status': 'VERIFIED_SUCCESS',
    });

    return { success: true };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error('[saveContentToSupabase Exception]:', {
      error: err,
      durationMs: duration,
    });
    return {
      success: false,
      error: err?.message || 'Gagal menyimpan data ke Supabase.',
    };
  }
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
      let errorMsg = uploadError.message;
      if (
        errorMsg === 'Bucket not found' ||
        errorMsg.includes('Bucket not found') ||
        errorMsg.includes('NoSuchBucket') ||
        errorMsg.includes('does not exist')
      ) {
        errorMsg = `Bucket "${SUPABASE_STORAGE_BUCKET}" tidak ditemukan di Supabase. Silakan buat bucket publik bernama "${SUPABASE_STORAGE_BUCKET}" di panel Storage Supabase Anda.`;
      }
      return { success: false, error: errorMsg };
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
 * Deletes an old image asset from Supabase Storage bucket as cleanup AFTER database update succeeds.
 */
export async function deleteImageFromSupabase(imageUrl?: string | null): Promise<boolean> {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) return false;
  try {
    const client = getSupabase();
    if (!imageUrl.includes('/' + SUPABASE_STORAGE_BUCKET + '/')) {
      return false;
    }

    const parts = imageUrl.split('/' + SUPABASE_STORAGE_BUCKET + '/');
    const pathInBucket = parts[1];
    if (!pathInBucket) return false;

    const { error } = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .remove([pathInBucket]);

    if (error) {
      console.warn('[Supabase Storage Cleanup Notice]:', error.message);
      return false;
    }
    console.log('[Supabase Storage Cleanup Success]: Deleted old image file:', pathInBucket);
    return true;
  } catch (err) {
    console.warn('[Supabase Storage Cleanup Error]:', err);
    return false;
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

/**
 * 8. Customer Authentication & Profiles (Standalone Customer Auth)
 * Completely separate from Admin/Outlet Supabase Auth.
 * Uses secure server-side session tokens, bcrypt password hashing, and PostgreSQL tables (customers, customer_sessions).
 * No fake emails, no SMS/OTP, no phone auth services.
 */
export const CUSTOMER_TOKEN_KEY = 'leton_customer_token';
export const CUSTOMER_PROFILE_KEY = 'leton_customer_profile';

export function getCustomerSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

/**
 * Register a new customer with Nama Lengkap, Nomor HP, Tanggal Lahir, and Password.
 * Password is cryptographically hashed with bcrypt on the server-side.
 * Never generates or uses fake emails.
 */
export async function registerCustomer(
  namaLengkap: string,
  nomorHp: string,
  tanggalLahir: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const cleanNama = (namaLengkap || '').trim();
    const cleanPhoneNumber = (nomorHp || '').replace(/[^0-9]/g, '');

    // Basic client-side validation
    if (!cleanNama || cleanNama.length < 2) {
      return { success: false, error: 'Nama Lengkap wajib diisi (minimal 2 karakter).' };
    }
    if (!cleanPhoneNumber || cleanPhoneNumber.length < 9) {
      return { success: false, error: 'Nomor Handphone minimal 9 digit angka.' };
    }
    if (!tanggalLahir) {
      return { success: false, error: 'Tanggal Lahir wajib diisi.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password harus minimal 6 karakter.' };
    }

    const client = getSupabase();

    // Call secure PostgreSQL function (SECURITY DEFINER)
    const { data, error } = await client.rpc('customer_register', {
      p_nama: cleanNama,
      p_phone: cleanPhoneNumber,
      p_birth_date: tanggalLahir,
      p_password: password,
    });

    if (error) {
      console.error('[Customer Register RPC Error]:', error);
      return {
        success: false,
        error: error.message || 'Pendaftaran gagal. Silakan periksa kembali data Anda.',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Pendaftaran gagal. Silakan periksa kembali data Anda.',
      };
    }

    const customer = data.customer;
    const sessionToken = data.token;

    // Persist session token and profile safely
    if (typeof window !== 'undefined') {
      if (sessionToken) {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
      }
      if (customer) {
        localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));
      }
    }

    const profile: CustomerProfile = {
      id: customer.id,
      userId: customer.userId || customer.id,
      namaLengkap: customer.namaLengkap,
      nomorHp: customer.nomorHp,
      tanggalLahir: customer.tanggalLahir,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Customer Register] Exception:', err);
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem saat mendaftar.' };
  }
}

/**
 * Customer Login using Nama Lengkap and Password.
 * Generates and returns a secure server-side session token upon bcrypt verification.
 */
export async function loginCustomer(
  inputNamaOrPhone: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const rawInput = (inputNamaOrPhone || '').trim();

    if (!rawInput) {
      return { success: false, error: 'Nama Lengkap wajib diisi.' };
    }
    if (!password) {
      return { success: false, error: 'Password wajib diisi.' };
    }

    const client = getSupabase();

    // Call secure PostgreSQL function (SECURITY DEFINER)
    const { data, error } = await client.rpc('customer_login', {
      p_nama: rawInput,
      p_password: password,
    });

    if (error) {
      console.error('[Customer Login RPC Error]:', error);
      return { success: false, error: 'Nama Lengkap atau Password salah.' };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Nama Lengkap atau Password salah.',
      };
    }

    const customer = data.customer;
    const sessionToken = data.token;

    if (typeof window !== 'undefined') {
      if (sessionToken) {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
      }
      if (customer) {
        localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));
      }
    }

    const profile: CustomerProfile = {
      id: customer.id,
      userId: customer.userId || customer.id,
      namaLengkap: customer.namaLengkap,
      nomorHp: customer.nomorHp,
      tanggalLahir: customer.tanggalLahir,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Customer Login] Exception:', err);
    return { success: false, error: 'Nama Lengkap atau Password salah.' };
  }
}

/**
 * Retrieve current customer profile from active server-side session token.
 * Token is verified on the server against public.customer_sessions.
 */
export async function getCurrentCustomerProfile(): Promise<CustomerProfile | null> {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) return null;

  try {
    const client = getSupabase();
    const { data, error } = await client.rpc('customer_get_session', {
      p_token: token,
    });

    if (error || !data || !data.success || !data.customer) {
      // Session expired or invalid
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_PROFILE_KEY);
      return null;
    }

    const customer = data.customer;
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));

    return {
      id: customer.id,
      userId: customer.userId || customer.id,
      namaLengkap: customer.namaLengkap,
      nomorHp: customer.nomorHp,
      tanggalLahir: customer.tanggalLahir,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };
  } catch {
    // In case of transient offline, fallback to cached profile if available
    try {
      const cached = localStorage.getItem(CUSTOMER_PROFILE_KEY);
      if (cached) {
        return JSON.parse(cached) as CustomerProfile;
      }
    } catch {}
    return null;
  }
}

/**
 * Sign out customer by revoking the server-side session token.
 */
export async function logoutCustomer(): Promise<void> {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (token) {
    try {
      const client = getSupabase();
      await client.rpc('customer_logout', { p_token: token });
    } catch (err) {
      console.warn('Customer logout RPC notice:', err);
    }
  }

  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
}

/**
 * Update customer profile (Nama Lengkap & Tanggal Lahir) via server-side session.
 */
export async function updateCustomerProfile(
  namaLengkap: string,
  tanggalLahir: string
): Promise<{ success: boolean; error?: string; profile?: CustomerProfile }> {
  if (typeof window === 'undefined') return { success: false, error: 'Browser environment required.' };

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) {
    return { success: false, error: 'Silakan masuk terlebih dahulu.' };
  }

  const cleanNama = (namaLengkap || '').trim();
  if (!cleanNama) {
    return { success: false, error: 'Nama Lengkap wajib diisi.' };
  }

  try {
    const client = getSupabase();
    const { data, error } = await client.rpc('customer_update_profile', {
      p_token: token,
      p_nama: cleanNama,
      p_birth_date: tanggalLahir,
    });

    if (error) {
      return { success: false, error: error.message || 'Gagal mengubah profil.' };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Gagal mengubah profil.' };
    }

    const customer = data.customer;
    if (customer) {
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));
    }

    const profile: CustomerProfile = {
      id: customer.id,
      userId: customer.userId || customer.id,
      namaLengkap: customer.namaLengkap,
      nomorHp: customer.nomorHp,
      tanggalLahir: customer.tanggalLahir,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengubah profil.' };
  }
}

/**
 * Retrieve customer orders using active session token via RPC customer_get_my_orders.
 */
export async function getCustomerOrdersRpc(
  customToken?: string
): Promise<{ success: boolean; orders: any[]; error?: string }> {
  if (typeof window === 'undefined') return { success: false, orders: [], error: 'Browser required.' };

  const token = customToken || getCustomerSessionToken();
  if (!token) {
    return { success: false, orders: [], error: 'Silakan masuk terlebih dahulu.' };
  }

  try {
    const client = getSupabase();
    const { data, error } = await client.rpc('customer_get_my_orders', {
      p_token: token,
    });

    if (error) {
      return { success: false, orders: [], error: error.message };
    }

    const list = Array.isArray(data)
      ? data
      : (data?.orders && Array.isArray(data.orders) ? data.orders : []);

    return { success: true, orders: list };
  } catch (err: any) {
    return { success: false, orders: [], error: err?.message || 'Gagal mengambil data pesanan.' };
  }
}


