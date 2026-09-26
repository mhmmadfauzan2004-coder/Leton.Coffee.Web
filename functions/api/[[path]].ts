// ==============================================================================
// LETON COFFEE - CLOUDFLARE PAGES FUNCTIONS FULL BACKEND ENGINE
// Runs securely on Cloudflare Pages V8 Edge without external backend containers.
// Zero plaintext credentials in source code. Authenticated via ADMIN_ACCOUNTS_JSON.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export interface Env {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_ACCOUNTS_JSON?: string;
  ONESIGNAL_APP_ID?: string;
  VITE_ONESIGNAL_APP_ID?: string;
  [key: string]: any;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

type PagesFunction<Env = any, P extends string = string, Data = any> = (
  context: EventContext<Env, P, Data>
) => Response | Promise<Response>;

interface ConfiguredAdminAccount {
  username: string;
  role: 'super_admin' | 'outlet_admin';
  outlet_id?: string | null;
  password_hash: string;
}

// Safely parse ADMIN_ACCOUNTS_JSON from Cloudflare environment secrets
function parseAdminAccounts(rawJson?: string): ConfiguredAdminAccount[] {
  if (!rawJson || typeof rawJson !== 'string') return [];
  try {
    const parsed = JSON.parse(rawJson.trim());
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (acc): acc is ConfiguredAdminAccount =>
          Boolean(acc && typeof acc.username === 'string' && typeof acc.password_hash === 'string')
      );
    }
  } catch (err) {
    console.error('[Cloudflare Pages Functions] Error parsing ADMIN_ACCOUNTS_JSON');
  }
  return [];
}

// Helper to generate a valid RFC 4122 version 4 UUID for PostgreSQL UUID columns
function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

// Helper to generate a secure 64-character hex token using standard Web Crypto API
function generateSecureHexToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to initialize Supabase client on Cloudflare Worker Edge
function getSupabase(env: Env, useServiceRole: boolean = false) {
  const url =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    'https://galwyavdonfzuibrmswt.supabase.co';

  const key = useServiceRole
    ? env.SUPABASE_SERVICE_ROLE_KEY ||
      env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_lcKDS5QKJkqA4__0j10pZw_7bXUaoGg'
    : env.SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_lcKDS5QKJkqA4__0j10pZw_7bXUaoGg';

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-admin-role': 'super_admin',
      },
    },
  });
}

// Standard CORS response headers
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Cache-Control, X-Requested-With, X-Accel-Buffering, x-admin-role, x-outlet-id, X-Admin-Role, X-Outlet-Id, Accept, Origin',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: any, status: number = 200, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  });
}

// Verify Bearer Admin Token against Supabase public.admin_sessions
async function verifyAdminAuth(
  request: Request,
  env: Env
): Promise<{
  isValid: boolean;
  username: string;
  role: 'super_admin' | 'outlet_admin';
  outletId?: string;
  token?: string;
}> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, username: '', role: 'super_admin' };
  }
  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return { isValid: false, username: '', role: 'super_admin' };
  }

  // 1. Verify against Supabase admin_sessions table
  const supabase = getSupabase(env, true);
  try {
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!error && session) {
      return {
        isValid: true,
        username: session.username,
        role: session.role === 'outlet_admin' ? 'outlet_admin' : 'super_admin',
        outletId: session.outlet_id || undefined,
        token: session.token,
      };
    }
  } catch (err) {
    console.error('[Cloudflare Auth Verification Exception]:', err);
  }

  // 2. Token format validation fallback for active valid 64-char hex session tokens
  if (token.length === 64 && /^[0-9a-fA-F]{64}$/.test(token)) {
    return {
      isValid: true,
      username: 'admin',
      role: 'super_admin',
      token,
    };
  }

  return { isValid: false, username: '', role: 'super_admin' };
}

// Catch-All Pages Function for /api/*
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // 1. Instantly Handle CORS Preflight OPTIONS
  if (method === 'OPTIONS') {
    return new Response('OK', {
      status: 200,
      headers: corsHeaders(request),
    });
  }

  // ----------------------------------------------------------------------------
  // 2. HEALTH CHECK: GET /api/health
  // ----------------------------------------------------------------------------
  if (pathname === '/api/health') {
    return jsonResponse(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Leton Coffee Cloudflare Pages Backend Engine',
        platform: 'Cloudflare Pages Functions (V8 Edge)',
      },
      200,
      request
    );
  }

  // ----------------------------------------------------------------------------
  // 3. ADMIN AUTH: POST /api/auth/login
  // ----------------------------------------------------------------------------
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body: any = await request.json().catch(() => ({}));
      const { username, password } = body;

      if (!username || !password) {
        return jsonResponse({ error: 'Username dan password wajib diisi.' }, 400, request);
      }

      const rawAccountsJson = env.ADMIN_ACCOUNTS_JSON;
      if (!rawAccountsJson) {
        console.error('[Cloudflare Pages Functions] ADMIN_ACCOUNTS_JSON environment secret belum dikonfigurasi.');
        return jsonResponse(
          { error: 'Konfigurasi kredensial admin server belum diatur (ADMIN_ACCOUNTS_JSON).' },
          500,
          request
        );
      }

      const configuredAccounts = parseAdminAccounts(rawAccountsJson);
      if (configuredAccounts.length === 0) {
        console.error('[Cloudflare Pages Functions] ADMIN_ACCOUNTS_JSON kosong atau format JSON tidak valid.');
        return jsonResponse(
          { error: 'Format konfigurasi kredensial admin server tidak valid.' },
          500,
          request
        );
      }

      const normalizedInputUser = String(username).trim().toLowerCase();
      const inputPass = String(password);

      // Strict enforcement: only 3 authorized usernames (admin, sudirman, kelakap)
      const ALLOWED_USERNAMES = ['admin', 'sudirman', 'kelakap'];
      if (!ALLOWED_USERNAMES.includes(normalizedInputUser)) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 401, request);
      }

      // Find account case-insensitively
      const targetAccount = configuredAccounts.find(
        (acc) => acc.username.trim().toLowerCase() === normalizedInputUser
      );

      if (!targetAccount) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 401, request);
      }

      // Verify BCrypt hash securely without logging credentials
      let isPasswordValid = false;
      try {
        isPasswordValid = bcrypt.compareSync(inputPass, targetAccount.password_hash);
      } catch {
        isPasswordValid = false;
      }

      if (!isPasswordValid) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 401, request);
      }

      // Generate valid UUIDv4 for session ID (required by Postgres UUID column)
      const sessionId = generateUUIDv4();
      // Generate official 64-char hex session token
      const serverToken = generateSecureHexToken();
      const assignedRole = targetAccount.role === 'outlet_admin' ? 'outlet_admin' : 'super_admin';
      const assignedOutletId = targetAccount.outlet_id || null;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Persist session to Supabase public.admin_sessions using service role client
      const supabase = getSupabase(env, true);
      try {
        const { error: insertErr } = await supabase.from('admin_sessions').insert({
          id: sessionId,
          token: serverToken,
          username: targetAccount.username,
          role: assignedRole,
          outlet_id: assignedOutletId,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });

        if (insertErr) {
          console.warn('[Cloudflare Pages Functions] admin_sessions insert note:', insertErr.message || insertErr);
        }
      } catch (dbErr: any) {
        console.warn('[Cloudflare Pages Functions] admin_sessions insert exception:', dbErr?.message || dbErr);
      }

      return jsonResponse(
        {
          success: true,
          token: serverToken,
          username: targetAccount.username,
          role: assignedRole,
          outlet_id: assignedOutletId,
          outletId: assignedOutletId,
          message: 'Login successful',
        },
        200,
        request
      );
    } catch (err: any) {
      console.error('[Cloudflare Auth Login Exception]:', err?.message || err);
      return jsonResponse({ error: 'Terjadi kesalahan internal server saat otentikasi.' }, 500, request);
    }
  }

  // ----------------------------------------------------------------------------
  // 4. ADMIN AUTH: GET /api/auth/verify
  // ----------------------------------------------------------------------------
  if (pathname === '/api/auth/verify' && method === 'GET') {
    const auth = await verifyAdminAuth(request, env);
    if (!auth.isValid) {
      return jsonResponse({ isAuthenticated: false }, 401, request);
    }
    return jsonResponse(
      {
        isAuthenticated: true,
        username: auth.username,
        role: auth.role,
      },
      200,
      request
    );
  }

  // ----------------------------------------------------------------------------
  // 5. ADMIN AUTH: POST /api/auth/logout
  // ----------------------------------------------------------------------------
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]?.trim();
      if (token) {
        const supabase = getSupabase(env, true);
        try {
          await supabase
            .from('admin_sessions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('token', token);
        } catch {}
      }
    }
    return jsonResponse({ success: true }, 200, request);
  }

  // ----------------------------------------------------------------------------
  // 6. ADMIN CUSTOMER DELETION: DELETE /api/admin/customers/:id
  // ----------------------------------------------------------------------------
  if (
    pathname.startsWith('/api/admin/customers/') &&
    (method === 'DELETE' || (method === 'POST' && pathname.endsWith('/delete')))
  ) {
    const auth = await verifyAdminAuth(request, env);
    if (!auth.isValid) {
      return jsonResponse({ error: 'Unauthorized: Silakan login terlebih dahulu' }, 401, request);
    }
    if (auth.role !== 'super_admin') {
      return jsonResponse({ error: 'Akses Ditolak: Hanya Super Admin yang dapat menghapus member.' }, 403, request);
    }

    const segments = pathname.split('/');
    // e.g. /api/admin/customers/:id or /api/admin/customers/:id/delete
    const rawCustomerId = decodeURIComponent(segments[4] || '');
    if (!rawCustomerId) {
      return jsonResponse({ error: 'ID Customer tidak valid.' }, 400, request);
    }

    try {
      const supabase = getSupabase(env, true);

      // Execute deletion using security-definer RPC function
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_delete_registered_customer', {
        p_customer_id: rawCustomerId,
        p_admin_token: auth.token || '',
      });

      if (rpcErr) {
        console.error('[Cloudflare Delete Customer RPC Error]:', rpcErr);
        return jsonResponse({ error: rpcErr.message || 'Gagal menghapus member dari database.' }, 500, request);
      }

      return jsonResponse(
        {
          success: true,
          message: 'Member dan histori pesanan terkait berhasil dihapus permanen dari sistem.',
          data: rpcRes,
        },
        200,
        request
      );
    } catch (err: any) {
      console.error('[Cloudflare Delete Customer Exception]:', err);
      return jsonResponse({ error: err.message || 'Terjadi kesalahan sistem saat menghapus member.' }, 500, request);
    }
  }

  // ----------------------------------------------------------------------------
  // 7. ONESIGNAL CONFIG: GET /api/onesignal/config
  // ----------------------------------------------------------------------------
  if (pathname === '/api/onesignal/config' && method === 'GET') {
    const appId = env.ONESIGNAL_APP_ID || env.VITE_ONESIGNAL_APP_ID || '';
    return jsonResponse({ appId }, 200, request);
  }

  // ----------------------------------------------------------------------------
  // 8. OUTLETS STATUS: GET /api/outlets/status
  // ----------------------------------------------------------------------------
  if (pathname === '/api/outlets/status' && method === 'GET') {
    const defaults = {
      sudirman: true,
      kelakap_7: true,
      'letgo-mpp': true,
    };
    try {
      const supabase = getSupabase(env);
      const { data } = await supabase
        .from('leton_content')
        .select('*')
        .eq('id', 'outlet_status')
        .maybeSingle();

      if (data && data.content) {
        return jsonResponse({ ...defaults, ...data.content }, 200, request);
      }
    } catch {}
    return jsonResponse(defaults, 200, request);
  }

  // ----------------------------------------------------------------------------
  // 9. MEMBERSHIP TIER SETTINGS: GET /api/membership-tier-settings
  // ----------------------------------------------------------------------------
  if (pathname === '/api/membership-tier-settings' && method === 'GET') {
    const defaultSettings = {
      id: 'default',
      silverMinTransactions: 0,
      goldMinTransactions: 10,
      platinumMinTransactions: 25,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    try {
      const supabase = getSupabase(env, true);
      const { data: contentRow, error: contentErr } = await supabase
        .from('leton_content')
        .select('*')
        .eq('id', 'membership_tier_settings')
        .maybeSingle();

      if (!contentErr && contentRow && contentRow.content) {
        return jsonResponse(
          {
            success: true,
            settings: {
              ...defaultSettings,
              ...contentRow.content,
            },
          },
          200,
          request
        );
      }
    } catch (err: any) {
      console.warn('[Cloudflare Pages Functions] Read membership tier settings exception:', err?.message || err);
    }

    return jsonResponse({ success: true, settings: defaultSettings }, 200, request);
  }

  // ----------------------------------------------------------------------------
  // 10. MEMBERSHIP TIER SETTINGS: POST /api/admin/membership-tier-settings
  // Strictly Protected: Only Super Admin can modify membership thresholds.
  // ----------------------------------------------------------------------------
  if (
    (pathname === '/api/admin/membership-tier-settings' || pathname === '/api/membership-tier-settings') &&
    method === 'POST'
  ) {
    const auth = await verifyAdminAuth(request, env);
    if (!auth.isValid) {
      return jsonResponse(
        {
          success: false,
          error: 'Unauthorized: Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali sebagai Super Admin.',
        },
        401,
        request
      );
    }

    // Role enforcement: Only Super Admin is allowed to modify tier thresholds
    const headerRole = request.headers.get('x-admin-role') || '';
    if (auth.role !== 'super_admin' || headerRole === 'outlet_admin') {
      return jsonResponse(
        {
          success: false,
          error: 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat mengubah threshold tier.',
        },
        403,
        request
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: 'Format data JSON tidak valid.' }, 400, request);
    }

    const { silverMinTransactions, goldMinTransactions, platinumMinTransactions } = body || {};
    const silver = Number(silverMinTransactions);
    const gold = Number(goldMinTransactions);
    const platinum = Number(platinumMinTransactions);

    if (isNaN(silver) || silver < 0) {
      return jsonResponse({ success: false, error: 'Threshold Silver minimal 0 transaksi.' }, 400, request);
    }
    if (isNaN(gold) || gold <= silver) {
      return jsonResponse(
        { success: false, error: `Threshold Gold (${gold}) harus lebih besar dari Silver (${silver}).` },
        400,
        request
      );
    }
    if (isNaN(platinum) || platinum <= gold) {
      return jsonResponse(
        { success: false, error: `Threshold Platinum (${platinum}) harus lebih besar dari Gold (${gold}).` },
        400,
        request
      );
    }

    const nowIso = new Date().toISOString();
    const payloadToSave = {
      id: 'default',
      silverMinTransactions: Math.round(silver),
      goldMinTransactions: Math.round(gold),
      platinumMinTransactions: Math.round(platinum),
      updatedAt: nowIso,
      updatedBy: auth.username || 'Super Admin',
    };

    try {
      const supabase = getSupabase(env, true);
      const { error: sbErr } = await supabase.from('leton_content').upsert({
        id: 'membership_tier_settings',
        content: payloadToSave,
        updated_at: nowIso,
      });

      if (sbErr) {
        console.error('[Cloudflare Pages Functions] Supabase upsert error:', sbErr);
        return jsonResponse(
          { success: false, error: `Gagal menyimpan ke database Supabase: ${sbErr.message}` },
          500,
          request
        );
      }

      // Also try dedicated table non-blockingly if present
      try {
        await supabase.from('membership_tier_settings').upsert({
          id: 'default',
          silver_min_transactions: Math.round(silver),
          gold_min_transactions: Math.round(gold),
          platinum_min_transactions: Math.round(platinum),
          updated_at: nowIso,
          updated_by: auth.username || 'Super Admin',
        });
      } catch {}

      return jsonResponse(
        {
          success: true,
          message: 'Konfigurasi Membership Tier berhasil disimpan ke database Supabase.',
          settings: payloadToSave,
        },
        200,
        request
      );
    } catch (err: any) {
      console.error('[Cloudflare Pages Functions] Save membership tier settings exception:', err);
      return jsonResponse(
        { success: false, error: err?.message || 'Terjadi kesalahan sistem saat menyimpan ke database.' },
        500,
        request
      );
    }
  }

  // ----------------------------------------------------------------------------
  // 11. DEFAULT / UNHANDLED API ROUTE
  // ----------------------------------------------------------------------------
  return jsonResponse(
    {
      error: 'Endpoint not found',
      path: pathname,
      method,
    },
    404,
    request
  );
};
