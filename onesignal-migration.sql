-- ======================================================================
-- MIGRATION: ONESIGNAL PUSH NOTIFICATION SYSTEM FOR LETON COFFEE
-- ======================================================================

-- 1. Create table for tracking active OneSignal Admin subscriptions & devices
CREATE TABLE IF NOT EXISTS public.admin_onesignal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT UNIQUE NOT NULL,
  username TEXT,
  outlet_id TEXT NOT NULL,
  role TEXT DEFAULT 'outlet_admin',
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_onesignal_outlet ON public.admin_onesignal_subscriptions (outlet_id);
CREATE INDEX IF NOT EXISTS idx_onesignal_subscription_id ON public.admin_onesignal_subscriptions (subscription_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.admin_onesignal_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Policies: Allow authenticated / service_role full access, anon can insert/update their device
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_onesignal_subscriptions' 
    AND policyname = 'Allow public insert and update for onesignal subscriptions'
  ) THEN
    CREATE POLICY "Allow public insert and update for onesignal subscriptions"
      ON public.admin_onesignal_subscriptions
      FOR ALL
      TO anon, authenticated, service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ======================================================================
-- SUPABASE EDGE FUNCTION WEBHOOK TRIGGER (ORDERS AFTER INSERT)
-- ======================================================================
-- NOTE:
-- Trigger orders_after_insert_send_push yang memanggil send-order-push
-- via pg_net (net.http_post) tetap AKTIF dan TIDAK PERLU DIUBAH jika
-- sudah terpasang. Edge Function send-order-push kini memanggil REST API OneSignal
-- dengan filter tag outlet_id = 'sudirman' / 'kelakap_7'.
-- ======================================================================
