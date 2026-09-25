-- ==============================================================================
-- LETON COFFEE - SECURE PERSISTENT ADMIN SESSIONS MIGRATION
-- ==============================================================================
-- ATURAN KETAT:
-- 1. TIDAK ADA DROP TABLE EXISTING
-- 2. TIDAK MENYENTUH orders ATAU order_items
-- 3. TIDAK MENYENTUH customers ATAU customer_sessions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABEL PERSISTENT ADMIN SESSIONS
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin', -- 'super_admin' | 'outlet_admin'
  outlet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  revoked_at TIMESTAMPTZ
);

-- Index untuk performa lookup token instan
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions (token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_username ON public.admin_sessions (username);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions (expires_at);

-- 2. ROW LEVEL SECURITY (RLS)
-- Akses langsung dari browser client / anonim DITOLAK SEPENUHNYA.
-- Hanya backend server terpercaya (Service Role) yang dapat membaca dan memodifikasi tabel ini.
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct client access to admin_sessions" ON public.admin_sessions;
CREATE POLICY "Deny direct client access to admin_sessions" ON public.admin_sessions
FOR ALL TO anon, authenticated
USING (false);
