import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LetonData, CustomerProfile } from '../types';
import { initialLetonData } from '../data/initialData';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';

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
 * 8. Customer Authentication & Profiles
 */
export async function registerCustomer(
  namaLengkap: string,
  nomorHp: string,
  tanggalLahir: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const client = getSupabase();

    // Clean inputs
    const cleanNama = namaLengkap.trim();
    const cleanPhone = nomorHp.replace(/[^0-9]/g, '');

    if (!cleanNama) return { success: false, error: 'Nama lengkap wajib diisi.' };
    if (!cleanPhone) return { success: false, error: 'Nomor HP wajib diisi.' };
    if (!tanggalLahir) return { success: false, error: 'Tanggal lahir wajib diisi.' };

    // Check if name or phone is already taken using secure uniqueness RPC helper
    const { data: uniqueness, error: uniqueErr } = await client.rpc('check_profile_uniqueness', {
      p_nama_lengkap: cleanNama,
      p_nomor_hp: cleanPhone
    });

    if (uniqueErr) {
      console.warn('Uniqueness RPC error, trying direct table fallback:', uniqueErr.message);
      
      // Fallback direct query if RLS/RPC is not fully deployed yet
      const { data: existingName } = await client
        .from('profiles')
        .select('id')
        .eq('nama_lengkap', cleanNama)
        .maybeSingle();

      if (existingName) {
        return { success: false, error: 'Nama lengkap sudah terdaftar. Silakan pilih nama lain atau masuk.' };
      }

      const { data: existingPhone } = await client
        .from('profiles')
        .select('id')
        .eq('nomor_hp', cleanPhone)
        .maybeSingle();

      if (existingPhone) {
        return { success: false, error: 'Nomor HP ini sudah terdaftar. Silakan gunakan nomor lain atau masuk.' };
      }
    } else if (uniqueness) {
      if (uniqueness.name_exists) {
        return { success: false, error: 'Nama lengkap sudah terdaftar. Silakan pilih nama lain atau masuk.' };
      }
      if (uniqueness.phone_exists) {
        return { success: false, error: 'Nomor HP ini sudah terdaftar. Silakan gunakan nomor lain atau masuk.' };
      }
    }

    // Generate a completely random internal email identifier in c_<random>@auth.letoncoffee.com format
    const randomSuffix = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    const virtualEmail = `c_${randomSuffix}@auth.letoncoffee.com`;

    // Create user in Supabase Auth
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email: virtualEmail,
      password: password,
    });

    if (signUpError || !signUpData.user) {
      return { success: false, error: signUpError?.message || 'Gagal mendaftarkan akun di sistem keamanan.' };
    }

    // Insert profile data including the internal email mapping
    const profilePayload = {
      user_id: signUpData.user.id,
      nama_lengkap: cleanNama,
      nomor_hp: cleanPhone,
      tanggal_lahir: tanggalLahir,
      email_internal: virtualEmail,
    };

    const { data: insertProfile, error: profileError } = await client
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    if (profileError) {
      console.error('Error inserting profile:', profileError);
      return { success: false, error: 'Akun berhasil dibuat tetapi gagal menginisialisasi data profil. Hubungi Admin.' };
    }

    const customerProfile: CustomerProfile = {
      id: insertProfile.id,
      userId: insertProfile.user_id,
      namaLengkap: insertProfile.nama_lengkap,
      nomorHp: insertProfile.nomor_hp,
      tanggalLahir: insertProfile.tanggal_lahir,
      createdAt: insertProfile.created_at,
      updatedAt: insertProfile.updated_at,
    };

    return { success: true, profile: customerProfile };
  } catch (err: any) {
    console.error('Customer registration exception:', err);
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem saat mendaftar.' };
  }
}

export async function loginCustomer(
  namaLengkap: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const client = getSupabase();
    const cleanNama = namaLengkap.trim();

    if (!cleanNama) return { success: false, error: 'Nama lengkap wajib diisi.' };
    if (!password) return { success: false, error: 'Password wajib diisi.' };

    // Fetch the email_internal securely via RPC get_email_by_name helper
    const { data: virtualEmail, error: rpcErr } = await client.rpc('get_email_by_name', {
      p_nama_lengkap: cleanNama
    });

    let profileRow: any = null;
    let finalEmail = virtualEmail;

    if (rpcErr || !finalEmail) {
      console.warn('Secure email lookup RPC unavailable or returned null, falling back to direct table select:', rpcErr?.message);
      
      // Fallback query if RPC isn't deployed yet
      const { data: fallbackRow, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('nama_lengkap', cleanNama)
        .maybeSingle();

      if (profileErr || !fallbackRow) {
        return { success: false, error: 'Nama Lengkap tidak terdaftar atau password salah.' };
      }
      profileRow = fallbackRow;
      finalEmail = fallbackRow.email_internal;
    }

    if (!finalEmail) {
      return { success: false, error: 'Nama Lengkap tidak terdaftar atau password salah.' };
    }

    // Sign in using the registered random internal email and password
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: finalEmail,
      password: password,
    });

    if (signInError || !signInData.user) {
      return { success: false, error: signInError?.message || 'Nama Lengkap atau Password salah.' };
    }

    // If we didn't fetch the profileRow from fallback yet, fetch it securely now since we are fully authenticated!
    if (!profileRow) {
      const { data: authenticatedRow, error: authProfileErr } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', signInData.user.id)
        .maybeSingle();

      if (authProfileErr || !authenticatedRow) {
        return { success: false, error: 'Gagal memuat profil anggota terautentikasi. Silakan coba lagi.' };
      }
      profileRow = authenticatedRow;
    }

    const customerProfile: CustomerProfile = {
      id: profileRow.id,
      userId: profileRow.user_id,
      namaLengkap: profileRow.nama_lengkap,
      nomorHp: profileRow.nomor_hp,
      tanggalLahir: profileRow.tanggal_lahir,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    };

    return { success: true, profile: customerProfile };
  } catch (err: any) {
    console.error('Customer login exception:', err);
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem saat masuk.' };
  }
}

export async function getCurrentCustomerProfile(): Promise<CustomerProfile | null> {
  try {
    const client = getSupabase();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data: profileRow, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !profileRow) return null;

    return {
      id: profileRow.id,
      userId: profileRow.user_id,
      namaLengkap: profileRow.nama_lengkap,
      nomorHp: profileRow.nomor_hp,
      tanggalLahir: profileRow.tanggal_lahir,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    };
  } catch {
    return null;
  }
}

export async function updateCustomerProfile(
  namaLengkap: string,
  tanggalLahir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { success: false, error: 'Silakan masuk terlebih dahulu.' };

    const cleanNama = namaLengkap.trim();
    if (!cleanNama) return { success: false, error: 'Nama lengkap wajib diisi.' };

    // Check if name is taken by other user
    const { data: otherUser } = await client
      .from('profiles')
      .select('id')
      .eq('nama_lengkap', cleanNama)
      .neq('user_id', user.id)
      .maybeSingle();

    if (otherUser) {
      return { success: false, error: 'Nama lengkap sudah terpakai oleh akun lain.' };
    }

    const { error } = await client
      .from('profiles')
      .update({
        nama_lengkap: cleanNama,
        tanggal_lahir: tanggalLahir,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengubah profil.' };
  }
}

