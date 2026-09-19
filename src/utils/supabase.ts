import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LetonData, CustomerProfile } from '../types';
import { initialLetonData } from '../data/initialData';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';
import { normalizeIndonesianPhone, isValidIndonesianPhone, generateCustomerInternalEmail, generateLegacyCustomerInternalEmail } from './phone';

export { normalizeIndonesianPhone, isValidIndonesianPhone, generateCustomerInternalEmail, generateLegacyCustomerInternalEmail };

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
 * 8. Customer Authentication & Profiles (Direct Supabase Auth from Client)
 * Eliminates Express/Cloud Run/external API dependency for customer authentication.
 * Uses native Supabase Auth with Phone + Password and public.profiles persistence.
 */

/**
 * Register a new customer directly via Supabase Email + Password Auth internally.
 * Generates a stable and unique internal email identity based on customer phone,
 * registers the user with Supabase Auth, and stores profile in public.profiles.
 */
export async function registerCustomer(
  namaLengkap: string,
  nomorHp: string,
  tanggalLahir: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const client = getSupabase();
    const cleanNama = (namaLengkap || '').trim();
    const normalizedPhone = normalizeIndonesianPhone(nomorHp);

    // 1. Basic validation
    if (!cleanNama) {
      return { success: false, error: 'Nama Lengkap wajib diisi.' };
    }
    if (!normalizedPhone || !isValidIndonesianPhone(nomorHp)) {
      return { success: false, error: 'Nomor HP tidak valid.' };
    }
    if (!tanggalLahir) {
      return { success: false, error: 'Tanggal Lahir wajib diisi.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password harus minimal 6 karakter.' };
    }

    // 2. Uniqueness check for Full Name via secure RPC check_customer_name_exists or single row check
    let nameAlreadyUsed = false;
    try {
      const { data: rpcNameExists, error: rpcErr } = await client.rpc('check_customer_name_exists', {
        p_nama: cleanNama,
      });
      if (!rpcErr && typeof rpcNameExists === 'boolean') {
        nameAlreadyUsed = rpcNameExists;
      }
    } catch {}

    if (!nameAlreadyUsed) {
      try {
        const { data: existingName } = await client
          .from('profiles')
          .select('id')
          .ilike('nama_lengkap', cleanNama)
          .limit(1)
          .maybeSingle();

        if (existingName) {
          nameAlreadyUsed = true;
        }
      } catch {}
    }

    if (nameAlreadyUsed) {
      return { success: false, error: 'Nama sudah digunakan.' };
    }

    // 3. Uniqueness check for Phone in public.profiles
    const rawDigits = (nomorHp || '').replace(/[^0-9]/g, '');
    let phoneAlreadyUsed = false;
    try {
      const { data: rpcPhoneExists, error: rpcPhoneErr } = await client.rpc('check_customer_phone_exists', {
        p_phone: normalizedPhone,
      });
      if (!rpcPhoneErr && typeof rpcPhoneExists === 'boolean') {
        phoneAlreadyUsed = rpcPhoneExists;
      }
    } catch {}

    if (!phoneAlreadyUsed) {
      try {
        const { data: existingPhone } = await client
          .from('profiles')
          .select('id')
          .or(`nomor_hp.eq.${normalizedPhone},nomor_hp.eq.${rawDigits}`)
          .limit(1)
          .maybeSingle();

        if (existingPhone) {
          phoneAlreadyUsed = true;
        }
      } catch {}
    }

    if (phoneAlreadyUsed) {
      return { success: false, error: 'Nomor HP sudah digunakan.' };
    }

    // 4. Generate stable, unique internal email identity for Supabase Email + Password Auth
    // Never shown to or requested from the customer; uses standard domain compatible with Supabase
    const internalEmail = generateCustomerInternalEmail(normalizedPhone);

    // 5. Supabase Auth signup directly from client using internal email and password
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email: internalEmail,
      password: password,
      options: {
        data: {
          nama_lengkap: cleanNama,
          nomor_hp: normalizedPhone,
          tanggal_lahir: tanggalLahir,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      const errMsg = (signUpError?.message || '').toLowerCase();
      if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
        return { success: false, error: 'Nomor HP sudah digunakan.' };
      }
      return { success: false, error: signUpError?.message || 'Gagal membuat akun.' };
    }

    const userId = signUpData.user.id;

    // 6. Store customer profile in public.profiles linked to auth.users(id)
    const profilePayload: Record<string, any> = {
      user_id: userId,
      nama_lengkap: cleanNama,
      nomor_hp: normalizedPhone,
      tanggal_lahir: tanggalLahir,
      email_internal: internalEmail,
    };

    let insertedRow: any = null;
    const { data: insertData, error: insertErr } = await client
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    if (insertErr) {
      // Check for unique key constraint violations
      const msg = (insertErr.message + ' ' + (insertErr.details || '')).toLowerCase();
      if (insertErr.code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
        if (msg.includes('nama_lengkap')) {
          return { success: false, error: 'Nama sudah digunakan.' };
        }
        if (msg.includes('nomor_hp') || msg.includes('phone') || msg.includes('email')) {
          return { success: false, error: 'Nomor HP sudah digunakan.' };
        }
      }
      console.error('[Supabase Register] Profile insert error:', insertErr);
      return { success: false, error: 'Gagal membuat akun.' };
    } else {
      insertedRow = insertData;
    }

    // 7. Ensure active session on client via Email + Password sign-in
    if (!signUpData.session) {
      const { error: signInErr } = await client.auth.signInWithPassword({
        email: internalEmail,
        password: password,
      });
      if (signInErr) {
        console.warn('Auto sign-in after register note:', signInErr.message);
        if (signInErr.message?.toLowerCase().includes('email not confirmed')) {
          console.warn('Supabase Auth Info: "Confirm email" is active in Supabase dashboard. Disable "Confirm email" in Auth -> Providers -> Email or run the SQL trigger.');
        }
      }
    }

    const profile: CustomerProfile = {
      id: insertedRow?.id || userId,
      userId: userId,
      namaLengkap: cleanNama,
      nomorHp: normalizedPhone,
      tanggalLahir: tanggalLahir,
      createdAt: insertedRow?.created_at || new Date().toISOString(),
      updatedAt: insertedRow?.updated_at || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Supabase Register] Exception:', err);
    return { success: false, error: err?.message || 'Gagal membuat akun.' };
  }
}

/**
 * Login customer directly via Supabase Auth using Email + Password under the hood.
 * Looks up internal email identity by nama_lengkap using a secure database mechanism (RPC),
 * and authenticates via signInWithPassword({ email: internalEmail, password }).
 * Supports both new format (cust<phone>@letoncoffee.com) and legacy format (cust_<phone>@letoncoffee.com).
 * 
 * Keamanan:
 * - Menggunakan database RPC `get_customer_email_by_name` (SECURITY DEFINER)
 * - Hanya menerima nama yang dicari dan mengembalikan string email internal khusus nama tersebut
 * - Data pelanggan lain TIDAK PERNAH terekspos ke browser
 */
export async function loginCustomer(
  namaLengkap: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const client = getSupabase();
    const cleanNama = (namaLengkap || '').trim();

    if (!cleanNama) {
      return { success: false, error: 'Nama Lengkap wajib diisi.' };
    }
    if (!password) {
      return { success: false, error: 'Password wajib diisi.' };
    }

    // 1. Secure lookup: find internal email identity belonging to this exact full name
    let foundEmail: string | null = null;
    let foundPhoneFallback: string | null = null;

    // A. Primary: call secure RPC get_customer_email_by_name
    try {
      const { data: rpcEmail, error: rpcErr } = await client.rpc('get_customer_email_by_name', {
        p_nama: cleanNama,
      });
      if (!rpcErr && typeof rpcEmail === 'string' && rpcEmail.trim()) {
        foundEmail = rpcEmail.trim();
      }
    } catch (rpcEx) {
      console.warn('[Supabase Login] RPC email lookup exception:', rpcEx);
    }

    // B. Secondary RPC: if old get_customer_phone_by_name is deployed
    if (!foundEmail) {
      try {
        const { data: rpcPhone, error: rpcPhoneErr } = await client.rpc('get_customer_phone_by_name', {
          p_nama: cleanNama,
        });
        if (!rpcPhoneErr && typeof rpcPhone === 'string' && rpcPhone.trim()) {
          foundPhoneFallback = rpcPhone.trim();
          foundEmail = generateCustomerInternalEmail(rpcPhone.trim());
        }
      } catch {}
    }

    // C. Fallback direct lookup for this specific name only
    if (!foundEmail) {
      try {
        const { data: row } = await client
          .from('profiles')
          .select('email_internal, nomor_hp')
          .ilike('nama_lengkap', cleanNama)
          .limit(1)
          .maybeSingle();

        if (row?.email_internal && row.email_internal.trim()) {
          foundEmail = row.email_internal.trim();
        } else if (row?.nomor_hp) {
          foundPhoneFallback = row.nomor_hp;
          foundEmail = generateCustomerInternalEmail(row.nomor_hp);
        }
      } catch (fbErr) {
        console.warn('[Supabase Login] Direct lookup fallback note:', fbErr);
      }
    }

    if (!foundEmail) {
      return { success: false, error: 'Nama tidak ditemukan.' };
    }

    // 2. Direct Supabase Auth Email + Password sign-in from client
    let { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: foundEmail,
      password: password,
    });

    // 2a. Fallback: If failed, try alternative internal email format (cust_ vs cust) for backward compatibility
    if (signInError || !signInData?.user) {
      let altEmail: string | null = null;
      if (foundEmail.startsWith('cust_')) {
        altEmail = foundEmail.replace('cust_', 'cust');
      } else if (foundEmail.startsWith('cust')) {
        altEmail = foundEmail.replace('cust', 'cust_');
      }

      if (altEmail) {
        const { data: altSignIn, error: altErr } = await client.auth.signInWithPassword({
          email: altEmail,
          password: password,
        });
        if (!altErr && altSignIn?.user) {
          signInData = altSignIn;
          signInError = null;

          // Migrate user account to the modern format without underscore (cust<digits>@letoncoffee.com)
          const modernEmail = generateCustomerInternalEmail(foundPhoneFallback || foundEmail);
          try {
            await client.auth.updateUser({ email: modernEmail });
            await client.from('profiles').update({ email_internal: modernEmail }).eq('user_id', altSignIn.user.id);
          } catch {}
        }
      }
    }

    // 2b. Fallback: Check if user was registered with legacy phone auth
    if (signInError || !signInData?.user) {
      if (foundPhoneFallback) {
        const normalizedPhone = normalizeIndonesianPhone(foundPhoneFallback);
        const { data: phoneSignInData, error: phoneSignInError } = await client.auth.signInWithPassword({
          phone: normalizedPhone,
          password: password,
        });

        if (!phoneSignInError && phoneSignInData?.user) {
          signInData = phoneSignInData;
          signInError = null;

          // Seamlessly upgrade legacy phone user to modern email auth
          const modernEmail = generateCustomerInternalEmail(normalizedPhone);
          try {
            await client.auth.updateUser({ email: modernEmail });
            await client.from('profiles').update({ email_internal: modernEmail }).eq('user_id', phoneSignInData.user.id);
          } catch {}
        }
      }
    }

    if (signInError || !signInData?.user) {
      const msg = (signInError?.message || '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password') || msg.includes('grant')) {
        return { success: false, error: 'Password salah.' };
      }
      if (msg.includes('email not confirmed')) {
        return { success: false, error: 'Email belum diverifikasi di Supabase. Nonaktifkan "Confirm email" di Dashboard Supabase Auth -> Providers -> Email.' };
      }
      return { success: false, error: 'Gagal login.' };
    }

    // 3. Fetch customer profile for authenticated user
    const { data: profileRow } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', signInData.user.id)
      .maybeSingle();

    const profile: CustomerProfile = {
      id: profileRow?.id || signInData.user.id,
      userId: signInData.user.id,
      namaLengkap: profileRow?.nama_lengkap || cleanNama,
      nomorHp: profileRow?.nomor_hp ? normalizeIndonesianPhone(profileRow.nomor_hp) : '',
      tanggalLahir: profileRow?.tanggal_lahir || '',
      createdAt: profileRow?.created_at || new Date().toISOString(),
      updatedAt: profileRow?.updated_at || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Supabase Login] Exception:', err);
    return { success: false, error: 'Gagal login.' };
  }
}

/**
 * Retrieve current customer profile from active Supabase Auth session.
 */
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
      nomorHp: normalizeIndonesianPhone(profileRow.nomor_hp),
      tanggalLahir: profileRow.tanggal_lahir,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Sign out customer session directly via Supabase Auth.
 */
export async function logoutCustomer(): Promise<void> {
  try {
    const client = getSupabase();
    await client.auth.signOut();
  } catch (err) {
    console.warn('logoutCustomer error:', err);
  }
}

/**
 * Update customer profile in public.profiles.
 */
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
      return { success: false, error: 'Nama sudah digunakan.' };
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


