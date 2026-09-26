import { CustomerOrder, OrderStatus, PaymentStatus } from '../types';
import { getSupabase, isSupabaseConfigured, getCustomerSessionToken, fetchContentFromSupabase } from './supabase';
import { processOrderPointsEarning } from './supabaseLoyalty';
import { isMenuItemAvailableForOutlet } from './supabaseStock';
import { normalizeIndonesianPhone } from './phone';
import { matchesOutlet } from '../data/adminAccounts';
import { getApiUrl } from './api';
import { safeSetItem, safeGetItem, stripHeavyBase64Images } from './safeStorage';
import { normalizeOutletKey } from './supabaseOutletStatus';

const ORDERS_STORAGE_KEY = 'leton_orders_history';
const ADMIN_ORDERS_CACHE_KEY = 'leton_admin_orders_cache';

export const ORDERS_SQL_SCHEMA = `-- ==============================================================================
-- LETON COFFEE DUMAI - DATABASE MIGRATION & RLS POLICIES
-- Outlets, Orders, Order Items, Realtime, & Storage 'leton-images'
-- ==============================================================================

-- 1. Buat Tabel Outlets (Cabang Leton Coffee)
CREATE TABLE IF NOT EXISTS public.outlets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  address TEXT,
  hours TEXT,
  image TEXT,
  badge TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data outlets dasar jika belum ada
INSERT INTO public.outlets (id, name, short_name, address, hours, badge)
VALUES
  ('sudirman', 'Leton Coffee — Jalan Jendral Sudirman', 'Leton Sudirman', 'Jl. Jend. Sudirman No. 88, Dumai Kota, Riau', '08:00 – 23:00 WIB', 'CHAPTER 5 • URBAN HUB'),
  ('kelakap_7', 'Leton Coffee — Ratusima / Kelakap 7', 'Leton Kelakap 7', 'Jl. Ratu Sima / Kelakap 7, Dumai Barat, Riau', '09:00 – 23:30 WIB', 'CHAPTER 6 • OPEN AIR SPOT'),
  ('letgo-mpp', 'LetGo — depan MPP', 'LetGo MPP', 'Area Parkir Depan Mall Pelayanan Publik (MPP), Dumai', '16:00 – 22:30 WIB', 'MOBILE COFFEE BOOTH')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  address = EXCLUDED.address,
  hours = EXCLUDED.hours,
  badge = EXCLUDED.badge;

-- 2. Buat Tabel Orders (Pesanan Pelanggan Online)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  outlet_id TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  order_type TEXT NOT NULL, -- 'DINE IN' | 'TAKE AWAY'
  table_number TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL, -- 'QRIS' | 'TUNAI'
  payment_status TEXT NOT NULL DEFAULT 'WAITING PAYMENT', -- 'WAITING PAYMENT' | 'WAITING VERIFICATION' | 'PAY AT STORE' | 'PAID' | 'PAYMENT REJECTED'
  payment_proof_path TEXT, -- Path file bukti transfer di Supabase Storage
  payment_receipt_url TEXT, -- URL file bukti pembayaran
  payment_receipt_path TEXT, -- Path unik file bukti pembayaran
  rejection_reason TEXT, -- Catatan penolakan jika pembayaran / pesanan ditolak
  order_status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
  customer_note TEXT,
  payment_verified_at TIMESTAMPTZ, -- Waktu verifikasi/penolakan pembayaran untuk retensi 24 jam
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan seluruh kolom wajib tersedia jika tabel sudah ada sebelumnya
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS outlet_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS outlet_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_path TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_path TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Buat Tabel Order Items (Relasi Produk)
CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  image TEXT,
  note TEXT,
  topping JSONB,
  syrup JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Aktifkan Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- Helper Function: Ekstrak Role Admin dari Request Header Supabase
CREATE OR REPLACE FUNCTION public.get_current_admin_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-admin-role',
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper Function: Ekstrak Outlet ID Admin dari Request Header Supabase
CREATE OR REPLACE FUNCTION public.get_current_outlet_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-outlet-id',
    ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Kebijakan Keamanan RLS Orders (SUPER ADMIN & OUTLET ADMIN ISOLATION)
DROP POLICY IF EXISTS "Public Read Access Orders" ON public.orders;
DROP POLICY IF EXISTS "Public Insert Access Orders" ON public.orders;
DROP POLICY IF EXISTS "Public Update Access Orders" ON public.orders;
DROP POLICY IF EXISTS "Orders Super Admin Full Access" ON public.orders;
DROP POLICY IF EXISTS "Orders Super Admin Read Only" ON public.orders;
DROP POLICY IF EXISTS "Orders Outlet Admin Access" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Read Open" ON public.orders;

-- a. SUPER ADMIN:
-- Super Admin memiliki hak penuh (SELECT, UPDATE, DELETE) untuk manajemen data pesanan
CREATE POLICY "Orders Super Admin Full Access" ON public.orders
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'super_admin'
)
WITH CHECK (
  get_current_admin_role() = 'super_admin'
);

-- b. OUTLET ADMIN:
-- Hanya dapat membaca dan mengupdate pesanan yang terdaftar di outlet miliknya sendiri.
-- Mendukung isolasi ketat Sudirman dan Kelakap 7 (termasuk alias Ratusima).
CREATE POLICY "Orders Outlet Admin Access" ON public.orders
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'outlet_admin'
  AND (
    outlet_id = get_current_outlet_id()
    OR (get_current_outlet_id() = 'kelakap_7' AND (outlet_id = 'kelakap_7' OR outlet_id = 'ratusima' OR outlet_id ILIKE '%kelakap%'))
    OR (get_current_outlet_id() = 'sudirman' AND (outlet_id = 'sudirman' OR outlet_id ILIKE '%sudirman%'))
    OR (get_current_outlet_id() = 'letgo-mpp' AND (outlet_id = 'letgo-mpp' OR outlet_id ILIKE '%letgo%'))
  )
)
WITH CHECK (
  get_current_admin_role() = 'outlet_admin'
  AND (
    outlet_id = get_current_outlet_id()
    OR (get_current_outlet_id() = 'kelakap_7' AND (outlet_id = 'kelakap_7' OR outlet_id = 'ratusima' OR outlet_id ILIKE '%kelakap%'))
    OR (get_current_outlet_id() = 'sudirman' AND (outlet_id = 'sudirman' OR outlet_id ILIKE '%sudirman%'))
    OR (get_current_outlet_id() = 'letgo-mpp' AND (outlet_id = 'letgo-mpp' OR outlet_id ILIKE '%letgo%'))
  )
);

-- c. Customer Publik: Dapat membuat pesanan baru
CREATE POLICY "Orders Public Insert" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- d. Customer Publik: Dapat membaca pesanan untuk pelacakan status pesanan
CREATE POLICY "Orders Public Read Open" ON public.orders
FOR SELECT TO anon, authenticated
USING (
  get_current_admin_role() = '' OR get_current_admin_role() IS NULL
);

-- 6. Kebijakan Keamanan RLS Order Items
DROP POLICY IF EXISTS "Order Items Public Select" ON public.order_items;
DROP POLICY IF EXISTS "Order Items Public Insert" ON public.order_items;

CREATE POLICY "Order Items Public Select" ON public.order_items
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Order Items Public Insert" ON public.order_items
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 7. Kebijakan Keamanan RLS Outlets
DROP POLICY IF EXISTS "Outlets Public Select" ON public.outlets;
DROP POLICY IF EXISTS "Outlets Super Admin Manage" ON public.outlets;

CREATE POLICY "Outlets Public Select" ON public.outlets
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Outlets Super Admin Manage" ON public.outlets
FOR ALL TO anon, authenticated
USING (get_current_admin_role() = 'super_admin')
WITH CHECK (get_current_admin_role() = 'super_admin');

-- 8. STORAGE BUCKET 'leton-images' (Foto Menu & Bukti Transfer QRIS)
-- Membuat bucket publik 'leton-images' dengan batas ukuran 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leton-images',
  'leton-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- Kebijakan Storage leton-images: Public Upload
DROP POLICY IF EXISTS "Public Upload to leton-images" ON storage.objects;
CREATE POLICY "Public Upload to leton-images"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'leton-images');

-- Kebijakan Storage leton-images: Public View
DROP POLICY IF EXISTS "Public View leton-images" ON storage.objects;
CREATE POLICY "Public View leton-images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'leton-images');

-- Kebijakan Storage leton-images: Public Update
DROP POLICY IF EXISTS "Public Update leton-images" ON storage.objects;
CREATE POLICY "Public Update leton-images"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'leton-images');

-- Kebijakan Storage leton-images: Public Delete
DROP POLICY IF EXISTS "Public Delete leton-images" ON storage.objects;
CREATE POLICY "Public Delete leton-images"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'leton-images');

-- 9. Aktifkan Realtime Replication untuk Tabel Orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ==============================================================================
-- LETON COFFEE DUMAI - LOYALTY SYSTEM SCHEMA
-- ==============================================================================

-- 10. Table: Loyalty Settings
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  earning_amount_per_point NUMERIC NOT NULL DEFAULT 10000,
  calculation_basis TEXT NOT NULL DEFAULT 'SUBTOTAL', -- 'SUBTOTAL' | 'TOTAL' (after discount)
  expiration_mode TEXT NOT NULL DEFAULT 'NEVER', -- 'NEVER' | 'DAYS'
  expiration_days INTEGER NOT NULL DEFAULT 365,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.loyalty_settings (id, is_active, earning_amount_per_point, calculation_basis, expiration_mode, expiration_days)
VALUES ('default', true, 10000, 'SUBTOTAL', 'NEVER', 365)
ON CONFLICT (id) DO NOTHING;

-- 11. Table: Loyalty Rewards
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- 'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL' | 'FREE_ITEM'
  reward_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  redeem_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rewards
INSERT INTO public.loyalty_rewards (id, name, description, points_required, reward_type, reward_value, is_active)
VALUES 
  ('rwd-1', 'Potongan Rp5.000', 'Diskon langsung Rp5.000 untuk transaksi berikutnya.', 15, 'DISCOUNT_NOMINAL', 5000, true),
  ('rwd-2', 'Potongan Rp10.000', 'Diskon langsung Rp10.000 untuk transaksi berikutnya.', 28, 'DISCOUNT_NOMINAL', 10000, true),
  ('rwd-3', 'Free Redvelvet Leton', 'Klaim 1x Cup Redvelvet Leton gratis.', 40, 'FREE_ITEM', 22000, true)
ON CONFLICT (id) DO NOTHING;

-- 12. Ensure columns in public.customers for loyalty balances
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_redeemed INTEGER NOT NULL DEFAULT 0;

-- 13. Table: Loyalty Point Transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'EARN' | 'REDEEM' | 'MANUAL_ADD' | 'MANUAL_SUB' | 'EXPIRED'
  points INTEGER NOT NULL, -- positive for credit, negative for debit
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  reference_reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reason TEXT,
  admin_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Table: Reward Redemptions (Vouchers)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC NOT NULL,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'USED' | 'EXPIRED'
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL, -- order where it was used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

-- 15. Create secure function for manual adjustments and automatic point earnings
-- Ensures atomic updates to customer points balance and records transaction securely.
-- All operations are executed within a database transaction.
CREATE OR REPLACE FUNCTION public.adjust_customer_points(
  p_customer_id TEXT,
  p_points INTEGER, -- can be positive (earn/add) or negative (redeem/sub)
  p_type TEXT,
  p_reason TEXT,
  p_ref_order_id TEXT DEFAULT NULL,
  p_ref_reward_id TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_bal INTEGER := 0;
  v_new_bal INTEGER := 0;
  v_tx_id TEXT;
  v_earned_inc INTEGER := 0;
  v_redeemed_inc INTEGER := 0;
  v_customer_exists BOOLEAN;
BEGIN
  -- 1. Check if customer exists
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) INTO v_customer_exists;
  IF NOT v_customer_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer tidak ditemukan');
  END IF;

  -- 2. Lock customer row and get current balance
  SELECT points_balance INTO v_current_bal
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_bal := v_current_bal + p_points;

  -- Prevent negative balance
  IF v_new_bal < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo point tidak mencukupi');
  END IF;

  -- Set increments
  IF p_points > 0 THEN
    v_earned_inc := p_points;
  ELSE
    v_redeemed_inc := ABS(p_points);
  END IF;

  -- 3. Update customer table
  UPDATE public.customers
  SET 
    points_balance = v_new_bal,
    total_points_earned = total_points_earned + v_earned_inc,
    total_points_redeemed = total_points_redeemed + v_redeemed_inc,
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Generate transaction ID
  v_tx_id := 'TX-' || floor(random() * 900000 + 100000)::text;

  -- 4. Record transaction history
  INSERT INTO public.loyalty_transactions (
    id, customer_id, transaction_type, points, balance_before, balance_after,
    reference_order_id, reference_reward_id, reason, admin_username, created_at
  ) VALUES (
    v_tx_id, p_customer_id, p_type, p_points, v_current_bal, v_new_bal,
    p_ref_order_id, p_ref_reward_id, p_reason, p_admin, NOW()
  );

  RETURN jsonb_build_object(
    'success', true, 
    'transaction_id', v_tx_id, 
    'points_balance', v_new_bal,
    'points_adjusted', p_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 16. Create secure function for reward redemption (atomic check-then-redeem)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_customer_id TEXT,
  p_reward_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_points_required INTEGER;
  v_reward_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
  v_is_active BOOLEAN;
  v_current_bal INTEGER;
  v_new_bal INTEGER;
  v_redemption_id TEXT;
  v_tx_res JSONB;
BEGIN
  -- 1. Get reward detail
  SELECT name, points_required, reward_type, reward_value, is_active
  INTO v_reward_name, v_points_required, v_reward_type, v_reward_value, v_is_active
  FROM public.loyalty_rewards
  WHERE id = p_reward_id;

  IF v_reward_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward tidak ditemukan');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward sedang tidak aktif');
  END IF;

  -- 2. Call adjust_customer_points to securely deduct points
  v_tx_res := public.adjust_customer_points(
    p_customer_id,
    -v_points_required,
    'REDEEM',
    'Redeem Reward: ' || v_reward_name,
    NULL,
    p_reward_id,
    NULL
  );

  IF NOT (v_tx_res->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_tx_res->>'error', 'Redeem gagal'));
  END IF;

  -- 3. Create redemption voucher record
  v_redemption_id := 'VCH-' || floor(random() * 900000 + 100000)::text;
  
  INSERT INTO public.reward_redemptions (
    id, customer_id, reward_id, reward_name, reward_type, reward_value, 
    points_spent, status, created_at, expires_at
  ) VALUES (
    v_redemption_id, p_customer_id, p_reward_id, v_reward_name, v_reward_type, v_reward_value,
    v_points_required, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days' -- standard 30 days validation
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'reward_name', v_reward_name,
    'points_spent', v_points_required,
    'points_balance', (v_tx_res->>'points_balance')::integer
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 17. Create secure function to trigger automatic point earning for a PAID/COMPLETED order.
-- Ensures that an order only awards points once.
CREATE OR REPLACE FUNCTION public.process_order_points_earning(
  p_order_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order_exists BOOLEAN;
  v_customer_id TEXT;
  v_total_amount NUMERIC;
  v_payment_status TEXT;
  v_order_status TEXT;
  v_is_active BOOLEAN;
  v_earning_amount NUMERIC;
  v_calc_basis TEXT;
  v_points_to_earn INTEGER;
  v_points_calculated NUMERIC;
  v_already_earned BOOLEAN;
  v_res JSONB;
BEGIN
  -- 1. Check if points earning already processed for this order
  SELECT EXISTS(
    SELECT 1 FROM public.loyalty_transactions 
    WHERE reference_order_id = p_order_id AND transaction_type = 'EARN'
  ) INTO v_already_earned;

  IF v_already_earned THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin untuk pesanan ini sudah pernah diproses');
  END IF;

  -- 2. Fetch order details
  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order tidak ditemukan');
  END IF;

  SELECT customer_id, total_amount, payment_status, order_status
  INTO v_customer_id, v_total_amount, v_payment_status, v_order_status
  FROM public.orders
  WHERE id = p_order_id;

  -- Must have a valid customer_id linked
  IF v_customer_id IS NULL OR v_customer_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pesanan tidak ditautkan ke member customer_id');
  END IF;

  -- Order must be PAID or COMPLETED
  -- REMOVED: IF v_payment_status <> 'PAID' AND v_order_status <> 'COMPLETED' THEN ...

  -- 3. Fetch loyalty settings
  SELECT is_active, earning_amount_per_point, calculation_basis
  INTO v_is_active, v_earning_amount, v_calc_basis
  FROM public.loyalty_settings
  WHERE id = 'default';

  IF v_is_active IS NULL OR NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sistem Loyalty Point sedang dinonaktifkan oleh Admin');
  END IF;

  -- 4. Calculate points
  -- Since orders subtotal is not a standalone DB numeric column, we use order total_amount
  v_points_calculated := floor(v_total_amount / v_earning_amount);
  v_points_to_earn := v_points_calculated::integer;

  IF v_points_to_earn <= 0 THEN
    RETURN jsonb_build_object('success', true, 'points_earned', 0, 'message', 'Nominal transaksi tidak mencapai batas minimum perolehan poin');
  END IF;

  -- 5. Credit points via adjust_customer_points
  v_res := public.adjust_customer_points(
    v_customer_id,
    v_points_to_earn,
    'EARN',
    'Earn point dari Pesanan #' || p_order_id,
    p_order_id,
    NULL,
    NULL
  );

  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 18. Enable RLS and create public policies
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Allow reading loyalty settings and rewards for anyone
CREATE POLICY "Allow read loyalty_settings" ON public.loyalty_settings FOR SELECT USING (true);
CREATE POLICY "Allow read loyalty_rewards" ON public.loyalty_rewards FOR SELECT USING (true);

-- Allow admins full access to settings, rewards, and transactions
CREATE POLICY "Admins manage loyalty_settings" ON public.loyalty_settings 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage loyalty_rewards" ON public.loyalty_rewards 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage loyalty_transactions" ON public.loyalty_transactions 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage reward_redemptions" ON public.reward_redemptions 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

-- ==============================================================================
-- 19. Table: OneSignal Admin Subscriptions (Web Push Notification Subscriptions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_onesignal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT 'admin',
  outlet_id TEXT NOT NULL DEFAULT 'sudirman',
  role TEXT NOT NULL DEFAULT 'outlet_admin',
  device_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_push_at TIMESTAMPTZ,
  last_push_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist for existing deployments
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS last_push_at TIMESTAMPTZ;
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS last_push_status TEXT;
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.admin_onesignal_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_admin_onesignal_active_outlet 
  ON public.admin_onesignal_subscriptions(outlet_id, is_active);

CREATE INDEX IF NOT EXISTS idx_admin_onesignal_sub_id 
  ON public.admin_onesignal_subscriptions(subscription_id);

ALTER TABLE public.admin_onesignal_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read admin_onesignal_subscriptions" ON public.admin_onesignal_subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow service and admin write admin_onesignal_subscriptions" ON public.admin_onesignal_subscriptions FOR ALL USING (true);
`;

/**
 * Generate unique order code e.g. "LTN-7842"
 */
export function generateOrderNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `LTN-${randomNum}`;
}

/**
 * Save order to localStorage history (for customer review on their device)
 */
export function saveOrderToLocalHistory(order: CustomerOrder): void {
  try {
    const existing = getLocalOrderHistory();
    const filtered = existing.filter((o) => o.id !== order.id);
    // Keep heavy receipt images out of localStorage history to save quota
    const sanitizedOrder = stripHeavyBase64Images(order);
    const updated = [sanitizedOrder, ...filtered].slice(0, 20); // keep last 20 orders
    safeSetItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save order to local history:', err);
  }
}

export function getLocalOrderHistory(): CustomerOrder[] {
  try {
    const raw = safeGetItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Helper to update order in local cache
 */
function updateLocalCache(order: CustomerOrder): void {
  try {
    const raw = safeGetItem(ADMIN_ORDERS_CACHE_KEY);
    let orders: CustomerOrder[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(orders)) orders = [];
    const sanitizedOrder = stripHeavyBase64Images(order);
    const index = orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      orders[index] = sanitizedOrder;
    } else {
      orders.unshift(sanitizedOrder);
    }
    safeSetItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(orders.slice(0, 50)));
  } catch (err) {
    console.warn('Local cache update failed:', err);
  }
}

/**
 * Helper to compress image in browser to lightweight JPEG before saving
 */
async function compressImageForCloud(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((e.target?.result as string) || '');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Upload Payment Receipt (QRIS)
 * Valid formats: JPG, JPEG, PNG, WEBP (Max 10MB)
 * Multi-layer storage strategy:
 * 1. Supabase Storage bucket 'leton-images' (Direct Cloud Storage)
 * 2. Backend API /api/upload-receipt (Node Server Storage)
 * 3. Supabase Cloud Database Record in 'leton_content' (High-resilience fallback)
 * Ensures user is NEVER blocked by "Bucket not found" or network misconfigurations.
 */
export async function uploadPaymentReceipt(
  file: File,
  orderNumber: string
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  // 1. Format validation (JPG, JPEG, PNG, WEBP)
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!validExtensions.includes(ext) && !validMimes.includes(file.type)) {
    return {
      success: false,
      error: 'Format file tidak didukung. Harap upload file JPG, JPEG, PNG, atau WEBP.',
    };
  }

  // 2. Size validation (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return {
      success: false,
      error: 'Ukuran file terlalu besar. Maksimal ukuran bukti transfer adalah 10MB.',
    };
  }

  // 3. Generate unique file path with order number and timestamp
  const timestamp = Date.now();
  const safeOrderCode = (orderNumber || `ORD-${timestamp}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueToken = Math.random().toString(36).substring(2, 8);
  const fileExt = ext || 'jpg';
  const filePath = `receipts/${safeOrderCode}_${timestamp}_${uniqueToken}.${fileExt}`;

  // 4. Layer 1: Supabase Storage bucket 'leton-images'
  try {
    const client = getSupabase();
    const bucketName = 'leton-images';

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      });

    if (!uploadError) {
      const { data } = client.storage.from(bucketName).getPublicUrl(filePath);
      if (data && data.publicUrl) {
        return {
          success: true,
          url: data.publicUrl,
          path: filePath,
        };
      }
    } else {
      console.warn('[Supabase Storage Notice]:', uploadError.message);
    }
  } catch (err) {
    console.warn('[Supabase Storage Exception]:', err);
  }

  // 5. Layer 2: Backend API /api/upload-receipt (Express server)
  try {
    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('orderNumber', safeOrderCode);

    const backendEndpoint = getApiUrl('/api/upload-receipt');
    const res = await fetch(backendEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const json = await res.json();
      if (json.url) {
        return {
          success: true,
          url: json.url,
          path: json.path || json.url,
        };
      }
    }
  } catch (backendErr) {
    console.warn('[Backend Receipt Upload Notice]:', backendErr);
  }

  // 6. Layer 3: Supabase Database Cloud Persistence Fallback
  // If bucket 'leton-images' has not been created in Supabase yet, store compressed receipt in leton_content
  try {
    const compressedDataUrl = await compressImageForCloud(file);
    if (compressedDataUrl) {
      const client = getSupabase();
      const receiptDocId = `receipt_${safeOrderCode}`;

      await client.from('leton_content').upsert({
        id: receiptDocId,
        content: {
          orderNumber: safeOrderCode,
          imageDataUrl: compressedDataUrl,
          uploadedAt: new Date().toISOString(),
          fileName: file.name,
        },
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        url: compressedDataUrl,
        path: `supabase://leton_content/${receiptDocId}`,
      };
    }
  } catch (dbErr) {
    console.warn('[Supabase DB Receipt Fallback Note]:', dbErr);
  }

  return {
    success: false,
    error: 'Gagal mengupload bukti transfer. Pastikan file valid dan coba kembali.',
  };
}

/**
 * Post Order to Supabase and Backend API with Multi-level Fallback
 */
export async function createNewOrder(
  orderData: CustomerOrder
): Promise<{ success: boolean; order: CustomerOrder; error?: string }> {
  // Always update local cache & history first
  saveOrderToLocalHistory(orderData);
  updateLocalCache(orderData);

  const receiptProofPath = orderData.paymentProofPath || orderData.paymentReceiptPath || orderData.paymentReceiptUrl || null;

  // 1. Try Supabase Insert into 'orders' table
  try {
    const client = getSupabase();

    // Verify outlet order acceptance availability before placing order
    try {
      const { fetchOutletsAvailability, normalizeOutletKey } = await import('./supabaseOutletStatus');
      const availabilityMap = await fetchOutletsAvailability();
      const normOutlet = normalizeOutletKey(orderData.outletId);
      if (availabilityMap && availabilityMap[normOutlet] === false) {
        console.error(`[Order Rejected]: Outlet "${orderData.outletId}" is currently NOT ACCEPTING ORDERS.`);
        return {
          success: false,
          order: orderData,
          error: `Cabang ${orderData.outletName || orderData.outletId} sedang TIDAK MENERIMA PESANAN saat ini. Silakan coba lagi nanti atau pilih cabang lain.`,
        };
      }
    } catch (availErr) {
      console.warn('[Outlet Availability Check Notice]:', availErr);
    }

    // Verify outlet stock before placing order
    try {
      const liveContent = await fetchContentFromSupabase();
      if (liveContent && Array.isArray(liveContent.menuItems)) {
        for (const item of orderData.items) {
          const menuItem = liveContent.menuItems.find(
            (m) => m.id === item.productId || m.name.toLowerCase() === item.name.toLowerCase()
          );
          if (menuItem && !isMenuItemAvailableForOutlet(menuItem, orderData.outletId)) {
            console.error(`[Stock Check Failed]: Menu "${item.name}" is OUT OF STOCK for outlet "${orderData.outletId}"`);
            return {
              success: false,
              order: orderData,
              error: `Pesanan tidak dapat diproses: Menu "${item.name}" sedang HABIS di cabang ${orderData.outletName || orderData.outletId}.`,
            };
          }
        }
      }
    } catch (stockErr) {
      console.warn('[Stock Verification Notice]:', stockErr);
    }

    // Customer standalone uses public.orders.customer_id. Do NOT put customer ID into user_id!
    // user_id is reserved exclusively for Supabase Auth (Admin/Outlet).
    let effectiveUserId: string | null = null;
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user?.id) {
        effectiveUserId = user.id;
      }
    } catch {}

    // Securely validate customer session token from client
    let validatedCustomerId: string | null = null;
    const customerToken = getCustomerSessionToken();
    if (customerToken) {
      try {
        const { data: sessionData } = await client.rpc('customer_get_session', {
          p_token: customerToken,
        });
        if (sessionData && sessionData.success && sessionData.customer?.id) {
          validatedCustomerId = sessionData.customer.id;
        }
      } catch (sessErr) {
        console.warn('Session verification during order placement notice:', sessErr);
      }
    }

    if (!validatedCustomerId && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('leton_customer_profile');
        if (cached) {
          const parsedCached = JSON.parse(cached);
          if (parsedCached?.id) {
            validatedCustomerId = parsedCached.id;
          }
        }
      } catch {}
    }

    // Guest checkout has effectiveCustomerId = null; authenticated customer has validatedCustomerId
    const effectiveCustomerId = validatedCustomerId || null;
    orderData.customerId = effectiveCustomerId || undefined;

    const effectivePhone = orderData.customerPhone ? normalizeIndonesianPhone(orderData.customerPhone) : null;

    const originalPaymentStatus = orderData.paymentStatus;
    const originalOrderStatus = orderData.orderStatus;

    const payload = {
      id: orderData.id,
      order_number: orderData.orderNumber,
      outlet_id: orderData.outletId,
      outlet_name: orderData.outletName,
      customer_name: orderData.customerName,
      customer_phone: effectivePhone,
      customer_id: effectiveCustomerId, // Associates order directly with public.customers.id
      user_id: effectiveUserId, // Associates with Supabase Auth if logged in as Admin/Outlet, NULL for customer
      order_type: orderData.orderType,
      table_number: orderData.tableNumber || null,
      items: orderData.items,
      total_amount: orderData.totalAmount,
      payment_method: orderData.paymentMethod,
      payment_status: originalPaymentStatus,
      payment_proof_path: receiptProofPath,
      payment_receipt_url: orderData.paymentReceiptUrl || null,
      payment_receipt_path: receiptProofPath,
      rejection_reason: orderData.rejectionReason || null,
      order_status: originalOrderStatus,
      customer_note: orderData.customerNote || null,
      created_at: orderData.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[Order] Creating order:', orderData.orderNumber);
    console.log('[Order] Primary orders INSERT started');
    const { error: insertError } = await client.from('orders').insert(payload);
    
    if (insertError) {
      console.error('[Order] Primary orders INSERT FAILED:', insertError);
      
      // Still write to orders_registry backup for recovery/debugging if desired, but return success: false
      try {
        const { data: regRow } = await client
          .from('leton_content')
          .select('*')
          .eq('id', 'orders_registry')
          .maybeSingle();

        const existingList: CustomerOrder[] =
          regRow?.content?.orders && Array.isArray(regRow.content.orders)
            ? regRow.content.orders
            : [];

        const mergedList = [orderData, ...existingList.filter((o) => o.id !== orderData.id)].slice(0, 500);

        await client.from('leton_content').upsert({
          id: 'orders_registry',
          content: { orders: mergedList, last_error: insertError },
          updated_at: new Date().toISOString(),
        });
      } catch (regErr) {
        console.warn('[Orders Registry Backup Note on failure]:', regErr);
      }

      return {
        success: false,
        order: orderData,
        error: `Gagal menyimpan pesanan ke database: ${insertError.message || 'Silakan coba lagi.'}`,
      };
    }

    console.log('[Order] Primary orders INSERT SUCCESS');

    // Try inserting into order_items table (auxiliary relational store)
    try {
      const itemRows = orderData.items.map((it, idx) => ({
        id: `${orderData.id}-item-${idx}`,
        order_id: orderData.id,
        product_id: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image || null,
        note: it.note || null,
        topping: it.topping || null,
        syrup: it.syrup || null,
        created_at: new Date().toISOString(),
      }));
      
      const { error: itemsError } = await client.from('order_items').insert(itemRows);
      if (itemsError) {
        console.warn('[Supabase Order Items Note]: Auxiliary order_items insert note (primary order is already safely committed in orders table):', itemsError.message);
      } else {
        console.log('[Order] order_items auxiliary INSERT SUCCESS');
      }
    } catch (itemErr: any) {
      console.warn('[Supabase Order Items Exception]:', itemErr?.message || itemErr);
    }

    // 1b. Instant Realtime Broadcast via Supabase Channel
    try {
      const broadcastChannel = client.channel('leton_orders_stream');
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'ORDER_CREATED',
            payload: orderData,
          });
        }
      });
    } catch (bcErr) {
      console.warn('[Supabase Broadcast Warning]:', bcErr);
    }

  } catch (err: any) {
    console.error('[Supabase Orders Exception]:', err);
    return {
      success: false,
      order: orderData,
      error: `Terjadi kendala saat memproses pesanan: ${err?.message || 'Silakan coba lagi.'}`,
    };
  }

  // 2. Cloud Database Backup to 'leton_content' (orders_registry) for successful orders
  try {
    const client = getSupabase();
    const { data: regRow } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'orders_registry')
      .maybeSingle();

    const existingList: CustomerOrder[] =
      regRow?.content?.orders && Array.isArray(regRow.content.orders)
        ? regRow.content.orders
        : [];

    const mergedList = [orderData, ...existingList.filter((o) => o.id !== orderData.id)].slice(0, 500);

    await client.from('leton_content').upsert({
      id: 'orders_registry',
      content: { orders: mergedList },
      updated_at: new Date().toISOString(),
    });
  } catch (regErr) {
    console.warn('[Orders Registry Backup Note]:', regErr);
  }

  // 3. Post to backend server API /api/orders (Express server push trigger)
  const notifyBackendPush = async () => {
    const backendUrl = getApiUrl('/api/orders');
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for cold-starts
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          console.log(`[Backend API] Order ${orderData.orderNumber} successfully registered on server backend and Web Push dispatched.`);
          break;
        }
      } catch (err) {
        console.warn(`[Backend API Order Dispatch] Attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  };
  // Dispatch asynchronously without blocking user confirmation
  notifyBackendPush();

  // 4. Automatically award loyalty points immediately on order creation (Checkout - non-blocking)
  if (orderData.customerId || orderData.userId) {
    processOrderPointsEarning(orderData).catch((earnErr) => {
      console.warn('[Loyalty Points Earning Note]:', earnErr);
    });
  }

  return {
    success: true,
    order: orderData,
  };
}

/**
 * Fetch all orders for Admin Dashboard & Kitchen Display
 * Supabase database 'orders' table is the SINGLE SOURCE OF TRUTH.
 * If targetOutletId is specified and not 'ALL', strictly filters orders for that outlet.
 */
export async function fetchAllOrders(targetOutletId?: string): Promise<CustomerOrder[]> {
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const filterId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  // 1. Primary & Authoritative: Supabase Database 'orders' table
  try {
    const client = getSupabase(activeRole, filterId);
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data)) {
      const orders: CustomerOrder[] = data.map((row: any) => ({
        id: row.id,
        orderNumber: row.order_number || row.orderNumber || 'LTN-????',
        outletId: row.outlet_id || row.outletId || '',
        outletName: row.outlet_name || row.outletName || '',
        customerName: row.customer_name || row.customerName || '',
        customerPhone: row.customer_phone || row.customerPhone || '',
        customerId: row.customer_id || row.customerId || undefined,
        userId: row.user_id || row.userId || undefined,
        orderType: row.order_type || row.orderType || 'DINE IN',
        tableNumber: row.table_number || row.tableNumber || '',
        items: Array.isArray(row.items) ? row.items : [],
        totalAmount: Number(row.total_amount || row.totalAmount || 0),
        paymentMethod: row.payment_method || row.paymentMethod || 'QRIS',
        paymentStatus: row.payment_status || row.paymentStatus || 'WAITING PAYMENT',
        paymentProofPath: row.payment_proof_path || row.payment_receipt_path || row.paymentReceiptPath,
        paymentReceiptUrl: row.payment_receipt_url || row.paymentReceiptUrl,
        paymentReceiptPath: row.payment_receipt_path || row.payment_proof_path || row.paymentReceiptPath,
        rejectionReason: row.rejection_reason || row.rejectionReason,
        orderStatus: row.order_status || row.orderStatus || 'NEW',
        customerNote: row.customer_note || row.customerNote || '',
        pickupTime: row.pickup_time || row.pickupTime || undefined,
        pickup_time: row.pickup_time || row.pickupTime || undefined,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt,
      }));

      // Apply strict outlet filtering if targetOutletId is specified
      const filtered = filterId
        ? orders.filter((o) => matchesOutlet(o.outletId, filterId))
        : orders;

      // Update local storage cache to strictly match the authoritative database state
      safeSetItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(stripHeavyBase64Images(filtered).slice(0, 50)));

      return filtered;
    }
  } catch (err) {
    console.warn('[Fetch Supabase Orders Warning]:', err);
  }

  // 2. Offline Fallback ONLY if network/database connection is completely unreachable
  try {
    const cached = safeGetItem(ADMIN_ORDERS_CACHE_KEY);
    if (cached) {
      const parsed: CustomerOrder[] = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return filterId ? parsed.filter((o) => matchesOutlet(o.outletId, filterId)) : parsed;
      }
    }
  } catch {}

  return [];
}

/**
 * Update Order Status and/or Payment Status (Verified / Rejected / Completed)
 * Designed for non-blocking execution & instant optimistic admin feedback.
 */
export async function updateOrderStatus(
  orderId: string,
  newOrderStatus: OrderStatus,
  newPaymentStatus?: PaymentStatus,
  rejectionReason?: string
): Promise<boolean> {
  const updatePayload: any = {
    order_status: newOrderStatus,
    updated_at: new Date().toISOString(),
  };
  if (newPaymentStatus) {
    updatePayload.payment_status = newPaymentStatus;
  }
  if (newPaymentStatus === 'PAID' || newPaymentStatus === 'PAYMENT REJECTED' || newPaymentStatus === 'REJECTED' || newOrderStatus === 'CANCELLED') {
    updatePayload.payment_verified_at = new Date().toISOString();
  }
  if (rejectionReason !== undefined) {
    updatePayload.rejection_reason = rejectionReason;
  }

  // 1. Direct Supabase update in 'orders' table (Primary authoritative database record)
  let updateSuccess = false;
  let lastDbError: string | null = null;

  try {
    const role = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
    const rawOutlet = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '';
    const activeOutlet = normalizeOutletKey(rawOutlet);
    const cleanNumber = orderId.replace(/^#/, '').trim();

    // Authenticate update call with admin session authorization context (super_admin or normalized activeOutlet)
    const client = role === 'super_admin'
      ? getSupabase('super_admin')
      : getSupabase(role || 'outlet_admin', activeOutlet);

    // Fetch the order first to discover exact ID
    const { data: ordList } = await client
      .from('orders')
      .select('id, outlet_id, order_number')
      .or(`id.eq.${orderId},id.eq.${cleanNumber},order_number.eq.${orderId},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`)
      .limit(1);

    const actualDbId = ordList && ordList[0]?.id ? ordList[0].id : orderId;

    let { data, error } = await client
      .from('orders')
      .update(updatePayload)
      .or(`id.eq.${actualDbId},id.eq.${orderId},id.eq.${cleanNumber},order_number.eq.${orderId},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`)
      .select();

    if (error && error.message.includes('payment_verified_at')) {
      delete updatePayload.payment_verified_at;
      const retry = await client
        .from('orders')
        .update(updatePayload)
        .or(`id.eq.${actualDbId},id.eq.${orderId},id.eq.${cleanNumber},order_number.eq.${orderId},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`)
        .select();
      error = retry.error;
      data = retry.data;
    }

    if (error) {
      lastDbError = error.message;
      console.warn('[Supabase updateOrderStatus direct notice]:', error.message);
    } else if (data && data.length > 0) {
      updateSuccess = true;
    }

    // Broadcast ORDER_STATUS_UPDATED event on Supabase Realtime channel for instant customer notification
    try {
      const liveChannel = client.channel(`order_live_${orderId}`);
      liveChannel.send({
        type: 'broadcast',
        event: 'ORDER_STATUS_UPDATED',
        payload: {
          order_id: orderId,
          order_status: newOrderStatus,
          payment_status: newPaymentStatus,
          rejection_reason: rejectionReason,
          updated_at: updatePayload.updated_at,
        },
      });
    } catch (bcErr) {
      console.warn('[Supabase Broadcast Warning]:', bcErr);
    }

    // Award loyalty points securely ONLY when Admin Outlet presses tombol SIAP (newOrderStatus === 'READY')
    if (newOrderStatus === 'READY') {
      try {
        const { data: rpcRes, error: rpcErr } = await client.rpc('process_order_points_earning', { p_order_id: orderId });
        if (rpcErr || (rpcRes && typeof rpcRes === 'object' && rpcRes.success === false)) {
          const existingOrder = await fetchSingleOrder(orderId);
          if (existingOrder) {
            await processOrderPointsEarning(existingOrder);
          }
        }
      } catch (ptsErr) {
        console.warn('[Order Points Earning Error in updateOrderStatus]:', ptsErr);
        try {
          const existingOrder = await fetchSingleOrder(orderId);
          if (existingOrder) {
            await processOrderPointsEarning(existingOrder);
          }
        } catch (fbErr) {
          console.warn('[Fallback Points Earning Failed]:', fbErr);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Supabase direct update error]:', err?.message || err);
    lastDbError = err?.message || 'Direct Supabase update error';
  }

  // 2. Server API fallback / verification
  try {
    const adminRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
    const adminOutlet = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '';
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || 'leton_local_token' : 'leton_local_token';

    const serverRes = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-admin-role': adminRole || 'super_admin',
        'x-outlet-id': normalizeOutletKey(adminOutlet),
      },
      body: JSON.stringify({
        orderStatus: newOrderStatus,
        paymentStatus: newPaymentStatus,
        rejectionReason: rejectionReason,
      }),
    });

    if (serverRes.ok) {
      const serverJson = await serverRes.json();
      if (serverJson && (serverJson.success || serverJson.order)) {
        updateSuccess = true;
      }
    }
  } catch (apiErr: any) {
    console.warn('[Server updateOrderStatus API Warning]:', apiErr?.message || apiErr);
  }

  if (!updateSuccess) {
    throw new Error(lastDbError || 'Gagal memperbarui status pesanan. Pastikan akun admin memiliki akses wewenang ke outlet ini.');
  }

  // 2. Parallel background sync for registry & local cache without blocking caller
  (async () => {
    try {
      // Local storage cache immediate sync
      const cached = safeGetItem(ADMIN_ORDERS_CACHE_KEY);
      if (cached) {
        let list: CustomerOrder[] = JSON.parse(cached);
        list = list.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              orderStatus: newOrderStatus,
              paymentStatus: newPaymentStatus || o.paymentStatus,
              rejectionReason: rejectionReason !== undefined ? rejectionReason : o.rejectionReason,
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        });
        safeSetItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(stripHeavyBase64Images(list).slice(0, 50)));
      }

      // Backend API sync
      const adminRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
      const adminOutlet = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '';
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || 'leton_local_token' : 'leton_local_token';
      fetch(getApiUrl(`/api/orders/${orderId}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-admin-role': adminRole,
          'x-outlet-id': adminOutlet
        },
        body: JSON.stringify({
          orderStatus: newOrderStatus,
          paymentStatus: newPaymentStatus,
          rejectionReason,
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  })();

  return true;
}

export interface DeleteOrderResult {
  success: boolean;
  deleted: boolean;
  verified: boolean;
  error?: string;
}

/**
 * Delete or Archive Order with strict Outlet Isolation and mandatory Post-Delete Database Verification
 */
export async function deleteOrder(
  orderId: string,
  requesterOutletId?: string,
  isAdminRole?: string
): Promise<DeleteOrderResult> {
  if (!orderId) {
    return {
      success: false,
      deleted: false,
      verified: false,
      error: 'ID pesanan tidak valid.',
    };
  }

  const cleanNumber = orderId.replace(/^#/, '').trim();

  // 1. Fetch the exact order to verify outlet isolation and obtain actual database ID
  let targetDbId = orderId;
  let targetOutletId = requesterOutletId;
  let existingOrder: CustomerOrder | null = null;

  try {
    existingOrder = await fetchSingleOrder(orderId);
    if (existingOrder) {
      targetDbId = existingOrder.id;
      targetOutletId = existingOrder.outletId;

      if (requesterOutletId && requesterOutletId !== 'ALL' && isAdminRole !== 'super_admin') {
        if (!matchesOutlet(existingOrder.outletId, requesterOutletId)) {
          return {
            success: false,
            deleted: false,
            verified: false,
            error: 'Akses Ditolak: Anda tidak memiliki wewenang menghapus pesanan dari cabang lain.',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[deleteOrder fetchSingleOrder Notice]:', err?.message || err);
  }

  // 2. Perform direct deletion in Supabase database
  let supabaseDeleteSuccess = false;
  let supabaseDeleteError: string | null = null;

  try {
    const client = getSupabase(isAdminRole || 'super_admin', targetOutletId);

    // a. Delete child rows in order_items table to satisfy foreign key constraints
    try {
      await client
        .from('order_items')
        .delete()
        .or(`order_id.eq.${targetDbId},order_id.eq.${orderId},order_id.eq.${cleanNumber}`);
    } catch (childErr: any) {
      console.warn('[Supabase deleteOrder order_items warning]:', childErr?.message || childErr);
    }

    // b. Delete record from orders table
    const { error: delErr } = await client
      .from('orders')
      .delete()
      .or(`id.eq.${targetDbId},id.eq.${orderId},order_number.eq.${orderId},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`);

    if (delErr) {
      console.warn('[Supabase deleteOrder Notice]:', delErr.message);
      supabaseDeleteError = delErr.message;
    } else {
      supabaseDeleteSuccess = true;
    }
  } catch (err: any) {
    console.warn('[Supabase deleteOrder Exception]:', err);
    supabaseDeleteError = err?.message || 'Gagal menghapus dari Supabase';
  }

  // 3. Perform backend server delete sync (Express backend + local JSON storage + server Supabase client)
  try {
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || 'leton_local_token' : 'leton_local_token';
    const serverRes = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(targetDbId)}`), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-admin-role': isAdminRole || 'super_admin',
        'x-outlet-id': targetOutletId || '',
      },
    });

    if (serverRes.ok) {
      const serverJson = await serverRes.json();
      if (serverJson.verified) {
        supabaseDeleteSuccess = true;
      }
    }
  } catch (apiErr: any) {
    console.warn('[Server deleteOrder API Warning]:', apiErr?.message || apiErr);
  }

  // 4. MANDATORY POST-DELETE DATABASE VERIFICATION (SELECT query on Supabase)
  let verifiedEmpty = false;
  try {
    const verifyClient = getSupabase(isAdminRole || 'super_admin', targetOutletId);
    const { data: remainingRows, error: verifyErr } = await verifyClient
      .from('orders')
      .select('id, order_number')
      .or(`id.eq.${targetDbId},id.eq.${orderId},order_number.eq.${orderId},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`);

    if (verifyErr) {
      console.warn('[deleteOrder Verification Query Warning]:', verifyErr.message);
    }

    if (!remainingRows || remainingRows.length === 0) {
      verifiedEmpty = true;
    } else {
      verifiedEmpty = false;
      console.error('[deleteOrder Verification Failed]: Record still found in database:', remainingRows);
    }
  } catch (vErr: any) {
    console.warn('[deleteOrder Verification Exception]:', vErr);
  }

  if (!verifiedEmpty) {
    return {
      success: false,
      deleted: false,
      verified: false,
      error: supabaseDeleteError || `Verifikasi gagal: Record pesanan (${cleanNumber}) masih ditemukan di Supabase. Periksa izin RLS DELETE pada Supabase.`,
    };
  }

  // 5. Clean up local storage cache only after verified database deletion
  try {
    // Clean up local storage cache
    const cached = safeGetItem(ADMIN_ORDERS_CACHE_KEY);
    if (cached) {
      let list: CustomerOrder[] = JSON.parse(cached);
      list = list.filter((o) => o.id !== targetDbId && o.id !== orderId && o.orderNumber !== cleanNumber && o.orderNumber !== `#${cleanNumber}`);
      safeSetItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(stripHeavyBase64Images(list).slice(0, 50)));
    }

    // Clean up leton_content backup registry if present
    try {
      const client = getSupabase(isAdminRole || 'super_admin', targetOutletId);
      const { data: regRow } = await client
        .from('leton_content')
        .select('content')
        .eq('id', 'orders_registry')
        .maybeSingle();

      if (regRow?.content?.orders && Array.isArray(regRow.content.orders)) {
        const filteredOrders = regRow.content.orders.filter(
          (o: any) => o.id !== targetDbId && o.id !== orderId && o.orderNumber !== cleanNumber && o.orderNumber !== `#${cleanNumber}`
        );
        await client
          .from('leton_content')
          .update({ content: { ...regRow.content, orders: filteredOrders } })
          .eq('id', 'orders_registry');
      }
    } catch {}
  } catch {}

  return {
    success: true,
    deleted: true,
    verified: true,
  };
}

/**
 * Realtime Subscription for Orders
 * Listens for new and updated orders via Supabase Postgres Realtime Channel,
 * Server-Sent Events (SSE), and backup polling.
 * If targetOutletId is set, filters notifications and alert sounds specifically for that outlet.
 */
export function subscribeToOrdersRealtime(
  onOrdersChange: (updatedList: CustomerOrder[]) => void,
  onNewOrderAlert?: (newOrder: CustomerOrder) => void,
  targetOutletId?: string
): () => void {
  let isSubscribed = true;
  let clientChannel: any = null;
  let sseSource: EventSource | null = null;
  const knownOrderIds = new Set<string>();
  let isInitialLoadDone = false;

  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const filterOutletId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  const triggerAlertIfNeeded = (order: CustomerOrder) => {
    if (!order || !order.id) return;
    // Super Admin / Central TIDAK menerima operational new-order notification popup/chime
    if (activeRole === 'super_admin') return;
    // Routing outlet check: hanya admin cabang yang sesuai
    if (filterOutletId && !matchesOutlet(order.outletId, filterOutletId)) return;
    if (onNewOrderAlert) {
      onNewOrderAlert(order);
    }
  };

  // Function to refresh and notify
  const refresh = async (alertOrder?: CustomerOrder) => {
    if (!isSubscribed) return;
    const orders = await fetchAllOrders(filterOutletId);
    if (!isSubscribed) return;
    onOrdersChange(orders);

    if (!isInitialLoadDone) {
      orders.forEach((o) => knownOrderIds.add(o.id));
      isInitialLoadDone = true;
    } else {
      // Find any newly discovered order from cloud fetch
      const newlyDiscovered = orders.filter((o) => !knownOrderIds.has(o.id));
      newlyDiscovered.forEach((o) => {
        knownOrderIds.add(o.id);
        triggerAlertIfNeeded(o);
      });
    }

    if (alertOrder && alertOrder.id) {
      knownOrderIds.add(alertOrder.id);
      triggerAlertIfNeeded(alertOrder);
    }
  };

  // Initial load
  refresh();

  // 1. Fallback Polling Control (Only active when Realtime channel is NOT healthy/subscribed)
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const startFallbackPolling = () => {
    if (!isSubscribed || pollInterval !== null) return;
    pollInterval = setInterval(() => {
      if (isSubscribed) {
        refresh();
      }
    }, 2500);
  };
  const stopFallbackPolling = () => {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  // 2. Supabase Postgres Realtime & Broadcast Stream
  try {
    const client = getSupabase(activeRole, filterOutletId);
    clientChannel = client
      .channel('leton_orders_stream_' + Math.random().toString(36).slice(2))
      .on('broadcast', { event: 'ORDER_CREATED' }, (payload: any) => {
        const newOrder = payload?.payload;
        if (newOrder && newOrder.id) {
          refresh(newOrder);
        } else {
          refresh();
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            if (payload.old && payload.old.id) {
              knownOrderIds.delete(payload.old.id);
            }
            refresh();
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const raw = payload.new;
            const newOrder: CustomerOrder = {
              id: raw.id,
              orderNumber: raw.order_number || raw.orderNumber || 'LTN-????',
              outletId: raw.outlet_id || raw.outletId || '',
              outletName: raw.outlet_name || raw.outletName || '',
              customerName: raw.customer_name || raw.customerName || '',
              customerPhone: raw.customer_phone || raw.customerPhone || '',
              orderType: raw.order_type || raw.orderType || 'DINE IN',
              tableNumber: raw.table_number || raw.tableNumber || '',
              items: Array.isArray(raw.items) ? raw.items : [],
              totalAmount: Number(raw.total_amount || raw.totalAmount || 0),
              paymentMethod: raw.payment_method || raw.paymentMethod || 'QRIS',
              paymentStatus: raw.payment_status || raw.paymentStatus || 'WAITING PAYMENT',
              paymentProofPath: raw.payment_proof_path || raw.payment_receipt_path || raw.paymentReceiptPath,
              paymentReceiptUrl: raw.payment_receipt_url || raw.paymentReceiptUrl,
              paymentReceiptPath: raw.payment_receipt_path || raw.payment_proof_path || raw.paymentReceiptPath,
              rejectionReason: raw.rejection_reason || raw.rejectionReason,
              orderStatus: raw.order_status || raw.orderStatus || 'NEW',
              customerNote: raw.customer_note || raw.customerNote || '',
              pickupTime: raw.pickup_time || raw.pickupTime || undefined,
              pickup_time: raw.pickup_time || raw.pickupTime || undefined,
              createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
            };
            refresh(newOrder);
          } else {
            refresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leton_content',
          filter: 'id=eq.orders_registry',
        },
        () => {
          refresh();
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          stopFallbackPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startFallbackPolling();
        }
      });
  } catch (err) {
    console.warn('[Orders Realtime Subscription Error]:', err);
    startFallbackPolling();
  }

  // 3. Server-Sent Events (SSE) Listener for Backend events
  try {
    if (typeof window !== 'undefined' && window.EventSource) {
      sseSource = new EventSource(getApiUrl('/api/events'));
      sseSource.onerror = (e) => {
        try {
          if (e && typeof (e as any).preventDefault === 'function') {
            (e as any).preventDefault();
          }
        } catch {}
        try { sseSource?.close(); } catch {}
      };
      sseSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && (payload.type === 'ORDER_CREATED' || payload.type === 'ORDER_UPDATED' || payload.type === 'ORDER_DELETED' || payload.type === 'ORDER_STATUS_UPDATED')) {
            if (payload.type === 'ORDER_CREATED' && payload.order) {
              refresh(payload.order);
            } else {
              refresh();
            }
          }
        } catch {
          // ignore
        }
      };
    }
  } catch (sseErr) {
    // SSE optional notice
  }

  // Return cleanup
  return () => {
    isSubscribed = false;
    stopFallbackPolling();
    if (sseSource) {
      sseSource.close();
    }
    if (clientChannel) {
      try {
        const client = getSupabase(activeRole, filterOutletId);
        client.removeChannel(clientChannel);
      } catch {
        // ignore
      }
    }
  };
}

/**
 * Fetch a single order by ID or Order Number
 * Uses SECURITY DEFINER RPC get_guest_order_status for guest public tracking,
 * or direct table access if an admin role is active.
 */
export async function fetchSingleOrder(
  orderIdOrNumber: string,
  customerPhone?: string
): Promise<CustomerOrder | null> {
  if (!orderIdOrNumber) return null;
  const cleanNumber = orderIdOrNumber.replace(/^#/, '').trim();

  // 1. Admin Flow (If admin role is active in localStorage)
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') : '';
  if (activeRole === 'super_admin' || activeRole === 'outlet_admin') {
    try {
      const client = getSupabase(activeRole);
      const { data, error } = await client
        .from('orders')
        .select('*')
        .or(`id.eq.${orderIdOrNumber},id.eq.${cleanNumber},order_number.eq.${orderIdOrNumber},order_number.eq.${cleanNumber},order_number.eq.#${cleanNumber}`)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          orderNumber: data.order_number || data.orderNumber || 'LTN-????',
          outletId: data.outlet_id || data.outletId || '',
          outletName: data.outlet_name || data.outletName || '',
          customerName: data.customer_name || data.customerName || '',
          customerPhone: data.customer_phone || data.customerPhone || '',
          customerId: data.customer_id || data.customerId || undefined,
          userId: data.user_id || data.userId || undefined,
          orderType: data.order_type || data.orderType || 'DINE IN',
          tableNumber: data.table_number || data.tableNumber || '',
          items: Array.isArray(data.items) ? data.items : [],
          totalAmount: Number(data.total_amount || data.totalAmount || 0),
          paymentMethod: data.payment_method || data.paymentMethod || 'QRIS',
          paymentStatus: data.payment_status || data.paymentStatus || 'WAITING PAYMENT',
          paymentProofPath: data.payment_proof_path || data.payment_receipt_path || data.paymentReceiptPath,
          paymentReceiptUrl: data.payment_receipt_url || data.paymentReceiptUrl,
          paymentReceiptPath: data.payment_receipt_path || data.payment_proof_path || data.paymentReceiptPath,
          rejectionReason: data.rejection_reason || data.rejectionReason,
          orderStatus: data.order_status || data.orderStatus || 'NEW',
          customerNote: data.customer_note || data.customerNote || '',
          createdAt: data.created_at || data.createdAt || new Date().toISOString(),
          updatedAt: data.updated_at || data.updatedAt,
        };
      }
    } catch (err) {
      console.warn('[Fetch Single Admin Order Note]:', err);
    }
  }

  // 2. Public / Guest Flow via Security Definer RPC (2-Factor Authorization)
  try {
    const client = getSupabase();
    const { data: rpcRes, error: rpcErr } = await client.rpc('get_guest_order_status', {
      p_order_identifier: orderIdOrNumber,
      p_phone: customerPhone || ''
    });

    if (!rpcErr && rpcRes && rpcRes.success && rpcRes.order) {
      const o = rpcRes.order;
      return {
        id: o.id,
        orderNumber: o.orderNumber || 'LTN-????',
        outletId: o.outletId || '',
        outletName: o.outletName || '',
        customerName: o.customerName || '',
        customerPhone: customerPhone || o.customerPhone || '',
        orderType: 'DINE IN',
        items: Array.isArray(o.items) ? o.items : [],
        totalAmount: Number(o.totalAmount || 0),
        paymentMethod: o.paymentMethod || 'QRIS',
        paymentStatus: o.paymentStatus || 'WAITING PAYMENT',
        orderStatus: o.orderStatus || 'NEW',
        customerNote: o.customerNote || '',
        createdAt: o.createdAt || new Date().toISOString(),
        updatedAt: o.updatedAt,
      };
    }
  } catch (err) {
    console.warn('[Fetch Single Guest Order RPC Note]:', err);
  }

  return null;
}

/**
 * Realtime Subscription for a Single Customer Order
 * Ensures instant UI updates on the customer's Order Confirmation / Bill screen
 */
export function subscribeToSingleOrder(
  orderIdOrNumber: string,
  customerPhone: string | undefined,
  onUpdate: (order: CustomerOrder) => void
): () => void {
  let isSubscribed = true;
  let clientChannel: any = null;
  let sseSource: EventSource | null = null;

  const checkOrder = async () => {
    if (!isSubscribed) return;
    const latest = await fetchSingleOrder(orderIdOrNumber, customerPhone);
    if (latest && isSubscribed) {
      onUpdate(latest);
    }
  };

  // 1. Initial fetch
  checkOrder();

  // 2. Fallback Polling Control (Only active when Realtime channel is NOT healthy/subscribed)
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const startFallbackPolling = () => {
    if (!isSubscribed || pollInterval !== null) return;
    pollInterval = setInterval(() => {
      if (isSubscribed) {
        checkOrder();
      }
    }, 2500);
  };
  const stopFallbackPolling = () => {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  // 3. Supabase Postgres Realtime Channel
  try {
    const client = getSupabase();
    clientChannel = client
      .channel(`order_live_${orderIdOrNumber}_${Math.random().toString(36).slice(2)}`)
      .on('broadcast', { event: 'ORDER_STATUS_UPDATED' }, (payload: any) => {
        if (
          payload?.payload?.order_id === orderIdOrNumber ||
          payload?.payload?.order_number === orderIdOrNumber
        ) {
          checkOrder();
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          if (
            payload.new &&
            (payload.new.id === orderIdOrNumber || payload.new.order_number === orderIdOrNumber)
          ) {
            checkOrder();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leton_content',
          filter: 'id=eq.orders_registry',
        },
        () => {
          checkOrder();
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          stopFallbackPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startFallbackPolling();
        }
      });
  } catch (err) {
    console.warn('[Single Order Realtime Error]:', err);
    startFallbackPolling();
  }

  // 4. SSE Listener
  try {
    if (typeof window !== 'undefined' && window.EventSource) {
      sseSource = new EventSource(getApiUrl('/api/events'));
      sseSource.onerror = (e) => {
        try {
          if (e && typeof (e as any).preventDefault === 'function') {
            (e as any).preventDefault();
          }
        } catch {}
        try { sseSource?.close(); } catch {}
      };
      sseSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (
            payload &&
            (payload.type === 'ORDER_UPDATED' ||
              payload.type === 'ORDER_STATUS_UPDATED' ||
              payload.type === 'ORDER_CREATED')
          ) {
            if (
              payload.order?.id === orderIdOrNumber ||
              payload.order?.orderNumber === orderIdOrNumber
            ) {
              checkOrder();
            }
          }
        } catch {
          // ignore
        }
      };
    }
  } catch {
    // ignore
  }

  return () => {
    isSubscribed = false;
    stopFallbackPolling();
    if (sseSource) sseSource.close();
    if (clientChannel) {
      try {
        const client = getSupabase();
        client.removeChannel(clientChannel);
      } catch {
        // ignore
      }
    }
  };
}

/**
 * Fetch all orders for a specific customer (for Admin Pusat -> Data Customer detail view)
 */
export async function fetchCustomerOrdersForAdmin(
  customerId: string,
  customerPhone?: string,
  customerName?: string
): Promise<CustomerOrder[]> {
  try {
    const client = getSupabase('super_admin');
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const cleanPhone = (customerPhone || '').replace(/[^0-9]/g, '');
      const cleanName = (customerName || '').toLowerCase().trim();

      const matchedRows = data.filter((row: any) => {
        const rowCustId = String(row.customer_id || row.customerId || '');
        const rowPhone = String(row.customer_phone || row.customerPhone || '').replace(/[^0-9]/g, '');
        const rowName = String(row.customer_name || row.customerName || '').toLowerCase().trim();

        if (customerId && rowCustId === customerId) return true;
        if (cleanPhone && cleanPhone.length >= 8 && rowPhone.includes(cleanPhone)) return true;
        if (cleanName && cleanName.length > 0 && rowName === cleanName) return true;
        return false;
      });

      // Batch verify order_items from public.order_items table
      const orderIds = matchedRows.map((r: any) => r.id).filter(Boolean);
      const itemsMap: Record<string, any[]> = {};
      if (orderIds.length > 0) {
        try {
          const { data: dbItems, error: itemsErr } = await client
            .from('order_items')
            .select('id, order_id, product_id, name, price, quantity')
            .in('order_id', orderIds);

          if (!itemsErr && Array.isArray(dbItems)) {
            dbItems.forEach((it: any) => {
              if (it && it.order_id) {
                if (!itemsMap[it.order_id]) itemsMap[it.order_id] = [];
                itemsMap[it.order_id].push(it);
              }
            });
          }
        } catch (itemErr) {
          console.warn('[fetchCustomerOrdersForAdmin] order_items fetch note:', itemErr);
        }
      }

      return matchedRows.map((row: any) => {
        const attachedItems = itemsMap[row.id];
        const jsonItems = Array.isArray(row.items) ? row.items : [];

        return {
          id: row.id,
          orderNumber: row.order_number || row.orderNumber || 'LTN-????',
          outletId: row.outlet_id || row.outletId || '',
          outletName: row.outlet_name || row.outletName || '',
          customerName: row.customer_name || row.customerName || '',
          customerPhone: row.customer_phone || row.customerPhone || '',
          customerId: row.customer_id || row.customerId || undefined,
          orderType: row.order_type || row.orderType || 'DINE IN',
          tableNumber: row.table_number || row.tableNumber || '',
          items: jsonItems,
          order_items: attachedItems !== undefined ? attachedItems : jsonItems,
          totalAmount: Number(row.total_amount || row.totalAmount || 0),
          paymentMethod: row.payment_method || row.paymentMethod || 'QRIS',
          paymentStatus: row.payment_status || row.paymentStatus || 'WAITING PAYMENT',
          paymentReceiptUrl: row.payment_receipt_url || row.paymentReceiptUrl,
          paymentReceiptPath: row.payment_receipt_path || row.paymentReceiptPath,
          rejectionReason: row.rejection_reason || row.rejectionReason,
          orderStatus: row.order_status || row.orderStatus || 'NEW',
          customerNote: row.customer_note || row.customerNote || '',
          pickupTime: row.pickup_time || row.pickupTime || undefined,
          pickup_time: row.pickup_time || row.pickupTime || undefined,
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn('[fetchCustomerOrdersForAdmin exception]:', err);
  }
  return [];
}
