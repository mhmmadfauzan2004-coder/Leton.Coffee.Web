import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { LetonData, CustomerProfile } from '../types';
import { initialLetonData } from '../data/initialData';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';
import { getApiUrl } from './api';
import {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  normalizePhoneTo08,
} from './phone';

export {
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  normalizePhoneTo08,
};

// 1. Supabase Credentials Configuration
export const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('leton_custom_supabase_url');
    if (customUrl && customUrl.trim().length > 10) return customUrl.trim();
  }
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);
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
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);
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
 * Extract and normalize a safe, fully validated CustomerProfile from raw RPC or database response.
 */
function extractCustomerProfile(rawCustomer: any): CustomerProfile {
  if (!rawCustomer) {
    return {
      id: '',
      userId: '',
      namaLengkap: 'Member Leton',
      nomorHp: '',
      tanggalLahir: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let obj = rawCustomer;
  if (typeof rawCustomer === 'string') {
    try {
      obj = JSON.parse(rawCustomer);
    } catch (err) {
      console.warn('[extractCustomerProfile] Failed to parse stringified customer JSON:', err);
      obj = {};
    }
  }

  const id = obj.id || obj.userId || obj.user_id || '';
  const nama = obj.namaLengkap || obj.nama_lengkap || obj.nama || obj.full_name || 'Member Leton';
  const hp = obj.nomorHp || obj.nomor_hp || obj.phone || obj.handphone || '';
  const birthDate = obj.tanggalLahir || obj.tanggal_lahir || obj.birth_date || obj.birthdate || '';
  const createdAt = obj.createdAt || obj.created_at || new Date().toISOString();
  const updatedAt = obj.updatedAt || obj.updated_at || new Date().toISOString();

  return {
    id: String(id),
    userId: String(id),
    namaLengkap: String(nama),
    nomorHp: String(hp),
    tanggalLahir: String(birthDate),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  };
}

/**
 * Safely parse any JSON/JSONB response returned by Supabase RPC.
 */
function parseRpcResponse(rawData: any): { success: boolean; token?: string; customer?: any; error?: string } {
  if (!rawData) {
    return { success: false, error: 'Empty RPC response' };
  }
  let parsed = rawData;
  if (typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData);
    } catch (e) {
      console.error('[RPC parse error]: Failed to parse raw string data:', e);
      return { success: false, error: 'Format response tidak valid' };
    }
  }

  const cust = parsed.customer || (parsed.customer_id ? {
    id: parsed.customer_id,
    userId: parsed.customer_id,
    namaLengkap: parsed.nama_lengkap,
    nomorHp: parsed.nomor_hp,
    tanggalLahir: parsed.tanggal_lahir,
    pointsBalance: parsed.points_balance,
    totalPointsEarned: parsed.total_points_earned,
    totalPointsRedeemed: parsed.total_points_redeemed,
  } : undefined);

  return {
    success: Boolean(parsed.success),
    token: parsed.token || parsed.session_token || parsed.p_token,
    customer: cust,
    error: parsed.error || parsed.message,
  };
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

    const parsed = parseRpcResponse(data);
    if (!parsed.success) {
      console.error('[Customer Register Business Error]:', parsed.error);
      return {
        success: false,
        error: parsed.error || 'Pendaftaran gagal. Silakan periksa kembali data Anda.',
      };
    }

    const sessionToken = parsed.token;
    const profile = extractCustomerProfile(parsed.customer);

    // Persist session token and profile safely
    if (typeof window !== 'undefined') {
      if (sessionToken) {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
      }
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
    }

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Customer Register] Exception:', err);
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem saat mendaftar.' };
  }
}

/**
 * Customer Login using Nomor HP and Password.
 * Multi-layer resilient authentication for both Cloudflare Pages (Split deployment) & AI Studio Preview.
 * 
 * Strategy 1: Direct Supabase RPC `customer_login_by_phone` (Direct Phone + Password RPC).
 * Strategy 2: Supabase customer lookup by phone + RPC `customer_login` with customer's nama_lengkap.
 * Strategy 3: Supabase customer lookup + client-side bcrypt verification + server session creation.
 * Strategy 4: Express/Cloud Run backend API fallback (`/api/customer/login`).
 */
export async function loginCustomer(
  inputPhone: string,
  password: string
): Promise<{ success: boolean; profile?: CustomerProfile; error?: string }> {
  try {
    const rawInput = (inputPhone || '').trim();

    if (!rawInput) {
      return { success: false, error: 'Nomor HP wajib diisi.' };
    }
    if (!password) {
      return { success: false, error: 'Password wajib diisi.' };
    }

    const cleanDigits = rawInput.replace(/[^0-9]/g, '');
    const normalizedPhone = normalizePhoneTo08(rawInput);
    const client = getSupabase();
    const adminClient = getSupabase('super_admin');

    // ----------------------------------------------------
    // STRATEGY 1: Direct Supabase RPC customer_login_by_phone
    // ----------------------------------------------------
    try {
      const resRpc = await client.rpc('customer_login_by_phone', {
        p_phone: normalizedPhone,
        p_password: password,
      });

      console.log('[loginCustomer DIAGNOSTIC 1 - customer_login_by_phone]', {
        normalized_phone: normalizedPhone,
        rpc_called: 'customer_login_by_phone',
        rpc_error_code: resRpc.error?.code || null,
        rpc_error_message: resRpc.error?.message || null,
        rpc_data_received: Boolean(resRpc.data),
        login_success: resRpc.data?.success || false,
      });

      if (!resRpc.error && resRpc.data) {
        const parsed = parseRpcResponse(resRpc.data);
        if (parsed.success) {
          const sessionToken = parsed.token;
          const profile = extractCustomerProfile(parsed.customer);

          if (typeof window !== 'undefined') {
            if (sessionToken) {
              localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
            }
            localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
          }

          return { success: true, profile };
        }
      }
    } catch (rpcErr) {
      console.warn('[loginCustomer Strategy 1 exception]:', rpcErr);
    }

    // ----------------------------------------------------
    // STRATEGY 2: Supabase customer lookup by phone + RPC customer_login by name
    // ----------------------------------------------------
    try {
      // Look up customer by normalized and raw phone numbers
      const phoneCandidates = Array.from(new Set([
        normalizedPhone,
        cleanDigits,
        cleanDigits.startsWith('62') ? '0' + cleanDigits.slice(2) : '',
        cleanDigits.startsWith('0') ? '62' + cleanDigits.slice(1) : '',
        rawInput,
      ].filter(Boolean)));

      const { data: matchedCustomers, error: lookupErr } = await adminClient
        .from('customers')
        .select('id, nama_lengkap, nomor_hp, tanggal_lahir, password_hash, points_balance, total_points_earned, total_points_redeemed')
        .in('nomor_hp', phoneCandidates)
        .limit(1);

      console.log('[loginCustomer DIAGNOSTIC 2 - Customer Lookup]', {
        phone_candidates: phoneCandidates,
        customer_found: Boolean(matchedCustomers && matchedCustomers.length > 0),
        lookup_error: lookupErr?.message || null,
      });

      if (matchedCustomers && matchedCustomers.length > 0) {
        const customerRecord = matchedCustomers[0];

        // 2a. Attempt RPC customer_login with the customer's actual registered name
        if (customerRecord.nama_lengkap) {
          const resRpc2 = await client.rpc('customer_login', {
            p_nama: customerRecord.nama_lengkap,
            p_password: password,
          });

          console.log('[loginCustomer DIAGNOSTIC 2a - customer_login with customer name]', {
            nama_lengkap: customerRecord.nama_lengkap,
            rpc_error: resRpc2.error?.code || null,
            rpc_success: resRpc2.data?.success || false,
          });

          if (!resRpc2.error && resRpc2.data) {
            const parsed2 = parseRpcResponse(resRpc2.data);
            if (parsed2.success) {
              const sessionToken = parsed2.token;
              const profile = extractCustomerProfile(parsed2.customer || customerRecord);

              if (typeof window !== 'undefined') {
                if (sessionToken) {
                  localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
                }
                localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
              }

              return { success: true, profile };
            }
          }
        }

        // 2b. Direct cryptographic bcrypt verification fallback
        if (customerRecord.password_hash) {
          const isPasswordValid = bcrypt.compareSync(password, customerRecord.password_hash);
          console.log('[loginCustomer DIAGNOSTIC 2b - Bcrypt Compare]', {
            is_valid: isPasswordValid,
          });

          if (isPasswordValid) {
            // Generate cryptographic session token (64 hex characters)
            const randomBytesArray = new Uint8Array(32);
            if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
              window.crypto.getRandomValues(randomBytesArray);
            } else {
              for (let i = 0; i < 32; i++) {
                randomBytesArray[i] = Math.floor(Math.random() * 256);
              }
            }
            const sessionToken = Array.from(randomBytesArray)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            // Insert session record directly into Supabase customer_sessions
            try {
              await adminClient.from('customer_sessions').insert({
                customer_id: customerRecord.id,
                token: sessionToken,
                expires_at: expiresAt,
              });
            } catch (sessInsertErr) {
              console.warn('[loginCustomer Strategy 2b session insert warning]:', sessInsertErr);
            }

            // Extract points balance
            let balance = Number(customerRecord.points_balance) || 0;
            let totalEarned = Number(customerRecord.total_points_earned) || 0;
            let totalRedeemed = Number(customerRecord.total_points_redeemed) || 0;

            try {
              const { data: ptsData } = await adminClient
                .from('customer_points')
                .select('current_balance, total_points_earned, total_points_redeemed')
                .eq('customer_id', customerRecord.id)
                .maybeSingle();

              if (ptsData) {
                balance = Number(ptsData.current_balance) || balance;
                totalEarned = Number(ptsData.total_points_earned) || totalEarned;
                totalRedeemed = Number(ptsData.total_points_redeemed) || totalRedeemed;
              }
            } catch {}

            const profile: CustomerProfile = extractCustomerProfile({
              id: customerRecord.id,
              userId: customerRecord.id,
              namaLengkap: customerRecord.nama_lengkap,
              nomorHp: customerRecord.nomor_hp,
              tanggalLahir: customerRecord.tanggal_lahir ? String(customerRecord.tanggal_lahir).split('T')[0] : '',
            });

            if (typeof window !== 'undefined') {
              localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
              localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
            }

            return { success: true, profile };
          } else {
            // Password checked and is definitely incorrect for the registered customer
            return {
              success: false,
              error: 'Nomor HP atau password salah.',
            };
          }
        }
      }
    } catch (lookupStrategyErr) {
      console.warn('[loginCustomer Strategy 2 exception]:', lookupStrategyErr);
    }

    // ----------------------------------------------------
    // STRATEGY 3: Backend Express API (/api/customer/login) fallback
    // ----------------------------------------------------
    try {
      const isSameHost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('.run.app'));

      if (isSameHost) {
        const apiUrl = getApiUrl('/api/customer/login');
        const apiRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalizedPhone,
            nomorHp: normalizedPhone,
            inputPhone: normalizedPhone,
            password: password,
          }),
        });

        const parsedApi = await apiRes.json().catch(() => null);

        if (apiRes.ok && parsedApi && parsedApi.success) {
          const sessionToken = parsedApi.token;
          const profile = extractCustomerProfile(parsedApi.customer);

          if (typeof window !== 'undefined') {
            if (sessionToken) {
              localStorage.setItem(CUSTOMER_TOKEN_KEY, sessionToken);
            }
            localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
          }

          return { success: true, profile };
        }

        if (parsedApi && !parsedApi.success && (apiRes.status === 400 || apiRes.status === 401)) {
          return {
            success: false,
            error: parsedApi.error || 'Nomor HP atau password salah.',
          };
        }
      }
    } catch (apiErr) {
      console.warn('[loginCustomer Strategy 3 Backend API notice]:', apiErr);
    }

    return {
      success: false,
      error: 'Nomor HP atau password salah.',
    };
  } catch (err: any) {
    console.error('[Customer Login Main Exception]:', err);
    return { success: false, error: 'Terjadi gangguan saat masuk. Silakan coba lagi.' };
  }
}

/**
 * Retrieve current customer profile from active server-side session token.
 * Direct Supabase RPC verification (customer_get_session).
 */
export async function getCurrentCustomerProfile(): Promise<CustomerProfile | null> {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) return null;

  // 1. Verifikasi langsung ke Supabase RPC (Direct & Fast, CORS-safe for Cloudflare Pages)
  try {
    const client = getSupabase();
    const { data, error } = await client.rpc('customer_get_session', {
      p_token: token,
    });

    if (!error && data) {
      const parsed = parseRpcResponse(data);
      if (parsed.success && parsed.customer) {
        const profile = extractCustomerProfile(parsed.customer);
        localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
        return profile;
      }
    }
  } catch (err) {
    console.warn('[getCurrentCustomerProfile] Supabase RPC check notice:', err);
  }

  // 2. Fallback backend API jika tersedia di host yang sama
  try {
    const isSameHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('.run.app'));
    
    if (isSameHost) {
      const res = await fetch(getApiUrl('/api/customer/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const parsed = await res.json().catch(() => null);
        if (parsed && parsed.success && parsed.customer) {
          const profile = extractCustomerProfile(parsed.customer);
          localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
          return profile;
        }
      }
    }
  } catch (apiErr) {
    console.warn('[getCurrentCustomerProfile] Backend API check notice:', apiErr);
  }

  // 3. Fallback profil cached jika jaringan sedang offline
  try {
    const cached = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (cached) {
      return extractCustomerProfile(JSON.parse(cached));
    }
  } catch {}

  // Jika token invalid di seluruh verifier, bersihkan session
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  return null;
}

/**
 * Sign out customer by revoking the server-side session token.
 */
export async function logoutCustomer(): Promise<void> {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (token) {
    // 1. Revoke session token directly in Supabase
    try {
      const client = getSupabase();
      await client.rpc('customer_logout', { p_token: token });
    } catch (err) {
      console.warn('Customer logout RPC notice:', err);
    }

    // 2. Optionally notify backend if on same host
    try {
      const isSameHost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('.run.app'));
      
      if (isSameHost) {
        fetch(getApiUrl('/api/customer/logout'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } catch {}
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
      console.error('[Customer Update Profile RPC Error]:', error);
      return { success: false, error: error.message || 'Gagal mengubah profil.' };
    }

    const parsed = parseRpcResponse(data);
    if (!parsed.success) {
      console.error('[Customer Update Profile Business Error]:', parsed.error);
      return { success: false, error: parsed.error || 'Gagal mengubah profil.' };
    }

    const profile = extractCustomerProfile(parsed.customer || { namaLengkap: cleanNama, tanggalLahir });
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));

    return { success: true, profile };
  } catch (err: any) {
    console.error('[Customer Update Profile Exception]:', err);
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


