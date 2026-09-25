-- ==============================================================================
-- LETON COFFEE - 3 LEVEL MEMBERSHIP TIER SYSTEM
-- Optional SQL Migration Script for Supabase Production
-- ==============================================================================

-- 1. Tabel Konfigurasi Threshold Tier (Non-Destructive)
CREATE TABLE IF NOT EXISTS public.membership_tier_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  silver_min_transactions INTEGER NOT NULL DEFAULT 0,
  gold_min_transactions INTEGER NOT NULL DEFAULT 10,
  platinum_min_transactions INTEGER NOT NULL DEFAULT 25,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'Super Admin'
);

-- 2. Seed Default Settings jika belum ada
INSERT INTO public.membership_tier_settings (id, silver_min_transactions, gold_min_transactions, platinum_min_transactions, updated_by)
VALUES ('default', 0, 10, 25, 'Super Admin')
ON CONFLICT (id) DO NOTHING;

-- 3. Row Level Security (RLS)
ALTER TABLE public.membership_tier_settings ENABLE ROW LEVEL SECURITY;

-- a. Public/Customer Read Access
DROP POLICY IF EXISTS "Membership Tier Settings Public Select" ON public.membership_tier_settings;
CREATE POLICY "Membership Tier Settings Public Select" ON public.membership_tier_settings
FOR SELECT TO anon, authenticated
USING (true);

-- b. Super Admin Write/Update Access
DROP POLICY IF EXISTS "Membership Tier Settings Super Admin Manage" ON public.membership_tier_settings;
CREATE POLICY "Membership Tier Settings Super Admin Manage" ON public.membership_tier_settings
FOR ALL TO anon, authenticated
USING (
  COALESCE(current_setting('request.headers', true)::json->>'x-admin-role', '') = 'super_admin'
)
WITH CHECK (
  COALESCE(current_setting('request.headers', true)::json->>'x-admin-role', '') = 'super_admin'
);
