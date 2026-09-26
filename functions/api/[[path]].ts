// ==============================================================================
// LETON COFFEE - CLOUDFLARE PAGES FUNCTIONS FULL BACKEND ENGINE
// Runs seamlessly on Cloudflare Pages V8 Edge without external backend containers.
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
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_USERNAME?: string;
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

// Helper to generate a secure 64-character hex token using standard Web Crypto API
function generateSecureHexToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
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
async function verifyAdminAuth(request: Request, env: Env): Promise<{
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

  return { isValid: false, username: '', role: 'super_admin' };
}

// Default Admin Auth Record fallback
const DEFAULT_AUTH = {
  username: 'admin',
  passwordHash: '$2a$10$wO7y8wGgqO/h5M7zU67tOu0YI4yT53n01gZ8E2fUu/5d54q9PqF4y', // LetonAdmin2026!
};

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
  // 2. HEALTH CHECK
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
      const { username, password, role, outletId } = body;

      if (!username || !password) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 400, request);
      }

      const configuredUsername = env.ADMIN_USERNAME || DEFAULT_AUTH.username;
      const configuredPasswordHash = env.ADMIN_PASSWORD_HASH || DEFAULT_AUTH.passwordHash;

      // Verify username match
      if (username.trim().toLowerCase() !== configuredUsername.toLowerCase()) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 401, request);
      }

      // Verify password match (bcrypt or default fallback LetonAdmin2026!)
      let isMatch = false;
      try {
        isMatch = bcrypt.compareSync(password, configuredPasswordHash);
      } catch {
        isMatch = false;
      }
      if (!isMatch && password === 'LetonAdmin2026!') {
        isMatch = true;
      }

      if (!isMatch) {
        return jsonResponse({ error: 'Password atau Username salah, silakan coba lagi.' }, 401, request);
      }

      // Generate official 64-char hex token
      const serverToken = generateSecureHexToken();
      const sessionId = `cf-session-${Date.now()}-${generateSecureHexToken().slice(0, 8)}`;
      const assignedRole = role === 'outlet_admin' ? 'outlet_admin' : 'super_admin';
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Persist session to Supabase public.admin_sessions using service role key
      const supabase = getSupabase(env, true);
      const { error: insertErr } = await supabase.from('admin_sessions').insert({
        id: sessionId,
        token: serverToken,
        username: username.trim(),
        role: assignedRole,
        outlet_id: outletId || null,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (insertErr) {
        console.error('[Cloudflare Auth Login DB Error]:', insertErr);
      }

      return jsonResponse(
        {
          success: true,
          token: serverToken,
          username: username.trim(),
          role: assignedRole,
          message: 'Login successful',
        },
        200,
        request
      );
    } catch (err: any) {
      console.error('[Cloudflare Auth Login Exception]:', err);
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
  if (pathname.startsWith('/api/admin/customers/') && (method === 'DELETE' || (method === 'POST' && pathname.endsWith('/delete')))) {
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
  // 9. DEFAULT / UNHANDLED API ROUTE
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
