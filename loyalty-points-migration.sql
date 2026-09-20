-- ==============================================================================
-- LETON COFFEE LOYALTY POINT SYSTEM - DATABASE MIGRATION SCRIPT
-- Pure, non-destructive, and idempotent SQL script for Supabase Production
-- ==============================================================================

-- 1. Tabel Loyalty Settings (Konfigurasi Admin)
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  earning_amount_per_point NUMERIC NOT NULL DEFAULT 10000,
  calculation_basis TEXT NOT NULL DEFAULT 'SUBTOTAL', -- 'SUBTOTAL' | 'TOTAL'
  expiration_mode TEXT NOT NULL DEFAULT 'NEVER', -- 'NEVER' | 'DAYS'
  expiration_days INTEGER NOT NULL DEFAULT 365,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Settings jika belum ada
INSERT INTO public.loyalty_settings (id, is_active, earning_amount_per_point, calculation_basis, expiration_mode, expiration_days)
VALUES ('default', true, 10000, 'SUBTOTAL', 'NEVER', 365)
ON CONFLICT (id) DO NOTHING;


-- 2. Tabel Loyalty Rewards (Katalog Reward / Benefit Voucher)
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- 'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL' | 'FREE_ITEM'
  reward_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  redeem_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Rewards jika belum ada
INSERT INTO public.loyalty_rewards (id, name, description, points_required, reward_type, reward_value, is_active)
VALUES 
  ('rwd-1', 'Potongan Rp5.000', 'Diskon langsung Rp5.000 untuk transaksi berikutnya.', 15, 'DISCOUNT_NOMINAL', 5000, true),
  ('rwd-2', 'Potongan Rp10.000', 'Diskon langsung Rp10.000 untuk transaksi berikutnya.', 28, 'DISCOUNT_NOMINAL', 10000, true),
  ('rwd-3', 'Free Redvelvet Leton', 'Klaim 1x Cup Redvelvet Leton gratis.', 40, 'FREE_ITEM', 22000, true)
ON CONFLICT (id) DO NOTHING;


-- 3. Sinkronisasi Kolom Loyalty pada Tabel public.customers Existing
-- Pastikan kolom saldo poin dasar selalu tersedia di tabel customers utama
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_redeemed INTEGER NOT NULL DEFAULT 0;


-- 4. Tabel Baru: customer_points (Sebagai Source of Truth Saldo Poin Customer)
CREATE TABLE IF NOT EXISTS public.customer_points (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  nomor_hp TEXT NOT NULL,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  total_points_redeemed INTEGER NOT NULL DEFAULT 0,
  current_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger untuk otomatis menyinkronkan data profil customers existing ke customer_points jika ada customer baru
CREATE OR REPLACE FUNCTION public.sync_customer_points_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_points (customer_id, nomor_hp, total_points_earned, total_points_redeemed, current_balance)
  VALUES (NEW.id, NEW.nomor_hp, 0, 0, 0)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_points_insert ON public.customers;
CREATE TRIGGER trg_sync_customer_points_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_points_on_insert();

-- Migrasikan data pelanggan lama yang sudah ada di public.customers ke public.customer_points
INSERT INTO public.customer_points (customer_id, nomor_hp, total_points_earned, total_points_redeemed, current_balance)
SELECT id, nomor_hp, total_points_earned, total_points_redeemed, points_balance
FROM public.customers
ON CONFLICT (customer_id) DO UPDATE SET
  total_points_earned = EXCLUDED.total_points_earned,
  total_points_redeemed = EXCLUDED.total_points_redeemed,
  current_balance = EXCLUDED.current_balance;


-- 5. Tabel Loyalty Transactions (Ledger Transaksi Poin - Immutable)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'EARN' | 'REDEEM' | 'MANUAL_ADD' | 'MANUAL_SUB' | 'EXPIRED'
  points INTEGER NOT NULL, -- Positif untuk penambahan saldo, Negatif untuk pengurangan saldo
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  reference_reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reason TEXT,
  admin_username TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 6. DUPLICATE EARNING PROTECTION (Constraint & Index Unik)
-- Indeks unik parsial ini menjamin bahwa satu order_id HANYA BISA mendapatkan 1x transaksi bertipe 'EARN'.
-- Jika ada request konkuren atau pemanggilan fungsi process_order_points_earning berulang kali,
-- database akan secara otomatis menolak operasi insert baru dengan error duplicate key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_earn_per_order 
ON public.loyalty_transactions (reference_order_id) 
WHERE (transaction_type = 'EARN');


-- 7. Tabel Reward Redemptions (Kupon / Voucher Pelanggan)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC NOT NULL,
  points_spent INTEGER NOT NULL,
  voucher_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'USED' | 'EXPIRED'
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ
);


-- ==============================================================================
-- 8. CORE RPC FUNCTIONS (Security Definer)
-- ==============================================================================

-- A. Penyesuaian Saldo Poin Pelanggan (Atomic & Safe Adjustment)
CREATE OR REPLACE FUNCTION public.adjust_customer_points(
  p_customer_id UUID,
  p_points INTEGER, -- Bisa positif (EARN / MANUAL_ADD) atau negatif (REDEEM / MANUAL_SUB)
  p_type TEXT,
  p_reason TEXT,
  p_ref_order_id TEXT DEFAULT NULL,
  p_ref_reward_id TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_bal INTEGER := 0;
  v_new_bal INTEGER := 0;
  v_tx_id TEXT;
  v_earned_inc INTEGER := 0;
  v_redeemed_inc INTEGER := 0;
  v_customer_exists BOOLEAN;
BEGIN
  -- 1. Validasi keberadaan customer
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) INTO v_customer_exists;
  IF NOT v_customer_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer tidak ditemukan.');
  END IF;

  -- Pastikan record customer_points terbuat jika belum ada (idempotensi)
  INSERT INTO public.customer_points (customer_id, nomor_hp, total_points_earned, total_points_redeemed, current_balance)
  SELECT id, nomor_hp, 0, 0, 0 FROM public.customers WHERE id = p_customer_id
  ON CONFLICT (customer_id) DO NOTHING;

  -- 2. Lock baris saldo customer_points & customers untuk mencegah race condition
  SELECT current_balance INTO v_current_bal
  FROM public.customer_points
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  -- Hitung saldo baru
  v_new_bal := v_current_bal + p_points;

  -- Cegah saldo menjadi negatif
  IF v_new_bal < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo poin tidak mencukupi untuk penukaran ini.');
  END IF;

  -- Tentukan penambahan akumulasi
  IF p_points > 0 THEN
    v_earned_inc := p_points;
  ELSE
    v_redeemed_inc := ABS(p_points);
  END IF;

  -- 3. Update tabel customer_points (Source of Truth)
  UPDATE public.customer_points
  SET 
    current_balance = v_new_bal,
    total_points_earned = total_points_earned + v_earned_inc,
    total_points_redeemed = total_points_redeemed + v_redeemed_inc,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;

  -- 4. Sinkronisasikan ke tabel public.customers utama (agar kompatibel dengan query existing)
  UPDATE public.customers
  SET 
    points_balance = v_new_bal,
    total_points_earned = total_points_earned + v_earned_inc,
    total_points_redeemed = total_points_redeemed + v_redeemed_inc,
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Generate ID Transaksi unik
  v_tx_id := 'TX-' || floor(random() * 900000 + 100000)::text;

  -- 5. Catat ke Ledger Mutasi
  INSERT INTO public.loyalty_transactions (
    id, customer_id, transaction_type, points, balance_before, balance_after,
    reference_order_id, reference_reward_id, reason, admin_username, expires_at, created_at
  ) VALUES (
    v_tx_id, p_customer_id, p_type, p_points, v_current_bal, v_new_bal,
    p_ref_order_id, p_ref_reward_id, p_reason, p_admin, p_expires_at, NOW()
  );

  RETURN jsonb_build_object(
    'success', true, 
    'transaction_id', v_tx_id, 
    'points_balance', v_new_bal,
    'points_adjusted', p_points
  );
END;
$$;


-- B. Proses Earning Poin Otomatis dari Order PAID / COMPLETED
CREATE OR REPLACE FUNCTION public.process_order_points_earning(
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_exists BOOLEAN;
  v_customer_id UUID;
  v_total_amount NUMERIC;
  v_payment_status TEXT;
  v_order_status TEXT;
  
  v_is_active BOOLEAN;
  v_earning_amount NUMERIC;
  v_calc_basis TEXT;
  v_expiration_mode TEXT;
  v_expiration_days INTEGER;
  
  v_points_to_earn INTEGER;
  v_already_earned BOOLEAN;
  v_expires_at TIMESTAMPTZ := NULL;
  v_res JSONB;
BEGIN
  -- 1. Proteksi Duplikasi Tingkat Pertama: Cek mutasi ledger yang sudah tercatat
  SELECT EXISTS(
    SELECT 1 FROM public.loyalty_transactions 
    WHERE reference_order_id = p_order_id AND transaction_type = 'EARN'
  ) INTO v_already_earned;

  IF v_already_earned THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin untuk pesanan ini sudah pernah diproses.');
  END IF;

  -- 2. Validasi keberadaan order di database
  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pesanan tidak ditemukan.');
  END IF;

  SELECT customer_id, total_amount, payment_status, order_status
  INTO v_customer_id, v_total_amount, v_payment_status, v_order_status
  FROM public.orders
  WHERE id = p_order_id;

  -- Pastikan order terkait dengan customer_id member yang valid
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pesanan tidak ditautkan ke member customer_id.');
  END IF;

  -- Verifikasi status pembayaran dan status order
  IF v_payment_status <> 'PAID' AND v_order_status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin hanya diberikan untuk pesanan dengan status pembayaran PAID atau status pesanan COMPLETED.');
  END IF;

  -- 3. Ambil konfigurasi Loyalty Settings terkini
  SELECT is_active, earning_amount_per_point, calculation_basis, expiration_mode, expiration_days
  INTO v_is_active, v_earning_amount, v_calc_basis, v_expiration_mode, v_expiration_days
  FROM public.loyalty_settings
  WHERE id = 'default';

  IF v_is_active IS NULL OR NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sistem Loyalty Point sedang dinonaktifkan oleh Admin.');
  END IF;

  -- 4. Hitung jumlah poin yang diperoleh
  v_points_to_earn := floor(v_total_amount / v_earning_amount)::integer;

  IF v_points_to_earn <= 0 THEN
    RETURN jsonb_build_object('success', true, 'points_earned', 0, 'message', 'Nominal transaksi belum mencapai batas minimum perolehan poin.');
  END IF;

  -- Hitung masa kedaluwarsa poin jika fitur kedaluwarsa aktif
  IF v_expiration_mode = 'DAYS' THEN
    v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;
  END IF;

  -- 5. Tambahkan poin secara aman melalui RPC adjust_customer_points
  v_res := public.adjust_customer_points(
    v_customer_id,
    v_points_to_earn,
    'EARN',
    'Penambahan otomatis dari Pesanan #' || p_order_id,
    p_order_id,
    NULL,
    NULL,
    v_expires_at
  );

  RETURN v_res;
EXCEPTION 
  -- Proteksi duplikasi tingkat kedua (Unique Index Constraint Guard)
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin untuk pesanan ini sudah berhasil diproses di thread lain.');
END;
$$;


-- C. Redeem Reward Poin (Atomic & Row-Locked Redemption)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_customer_id UUID,
  p_reward_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_required INTEGER;
  v_reward_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
  v_is_active BOOLEAN;
  v_current_bal INTEGER;
  
  v_voucher_code TEXT;
  v_redemption_id TEXT;
  v_tx_res JSONB;
BEGIN
  -- 1. Ambil detail reward yang diinginkan
  SELECT name, points_required, reward_type, reward_value, is_active
  INTO v_reward_name, v_points_required, v_reward_type, v_reward_value, v_is_active
  FROM public.loyalty_rewards
  WHERE id = p_reward_id;

  IF v_reward_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward tidak ditemukan di katalog.');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward ini sedang tidak aktif.');
  END IF;

  -- 2. Validasi saldo poin customer
  SELECT current_balance INTO v_current_bal
  FROM public.customer_points
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF v_current_bal IS NULL OR v_current_bal < v_points_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo poin Anda tidak mencukupi untuk menukar reward ini.');
  END IF;

  -- 3. Kurangi poin secara atomic melalui adjust_customer_points
  v_tx_res := public.adjust_customer_points(
    p_customer_id,
    -v_points_required,
    'REDEEM',
    'Penukaran voucher reward: ' || v_reward_name,
    NULL,
    p_reward_id,
    NULL
  );

  IF NOT (v_tx_res->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_tx_res->>'error', 'Gagal memotong saldo poin.'));
  END IF;

  -- 4. Generate Kode Voucher unik dan acak
  v_voucher_code := 'LTY-' || upper(substring(md5(random()::text) from 1 for 8));
  v_redemption_id := 'VCH-' || floor(random() * 900000 + 100000)::text;

  -- 5. Masukkan ke tabel reward_redemptions (Voucher Aktif)
  INSERT INTO public.reward_redemptions (
    id, customer_id, reward_id, reward_name, reward_type, reward_value, 
    points_spent, voucher_code, status, created_at, expires_at
  ) VALUES (
    v_redemption_id, p_customer_id, p_reward_id, v_reward_name, v_reward_type, v_reward_value,
    v_points_required, v_voucher_code, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days'
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'reward_name', v_reward_name,
    'voucher_code', v_voucher_code,
    'points_spent', v_points_required,
    'points_balance', (v_tx_res->>'points_balance')::integer
  );
END;
$$;


-- D. RPC Penyesuaian Manual Khusus untuk Admin Pusat
CREATE OR REPLACE FUNCTION public.adjust_customer_points_manual_rpc(
  p_customer_id UUID,
  p_points INTEGER,
  p_type TEXT,
  p_reason TEXT,
  p_admin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validasi tipe penyesuaian manual
  IF p_type <> 'MANUAL_ADD' AND p_type <> 'MANUAL_SUB' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipe manual adjustment tidak valid.');
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan penyesuaian manual wajib diisi dengan jelas.');
  END IF;

  -- Panggil fungsi inti penyesuaian saldo
  RETURN public.adjust_customer_points(
    p_customer_id,
    p_points,
    p_type,
    p_reason,
    NULL,
    NULL,
    p_admin,
    NULL
  );
END;
$$;


-- ==============================================================================
-- 9. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel loyalty
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada untuk mencegah kegagalan idempotensi
DROP POLICY IF EXISTS "Allow read settings to all" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Allow read rewards to all" ON public.loyalty_rewards;
DROP POLICY IF EXISTS "Allow read customer_points to owner" ON public.customer_points;
DROP POLICY IF EXISTS "Allow read transactions to owner" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Allow read redemptions to owner" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Superadmin manage settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Superadmin manage rewards" ON public.loyalty_rewards;
DROP POLICY IF EXISTS "Superadmin manage customer_points" ON public.customer_points;
DROP POLICY IF EXISTS "Superadmin manage transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Superadmin manage redemptions" ON public.reward_redemptions;


-- A. POLICIES: LOYALTY SETTINGS & REWARDS
-- Semua pengguna (termasuk pelanggan publik) boleh membaca katalog reward dan konfigurasi loyalty
CREATE POLICY "Allow read settings to all" ON public.loyalty_settings FOR SELECT USING (true);
CREATE POLICY "Allow read rewards to all" ON public.loyalty_rewards FOR SELECT USING (true);

-- Hanya Super Admin yang berwenang memodifikasi katalog reward dan setting loyalty
CREATE POLICY "Superadmin manage settings" ON public.loyalty_settings 
  FOR ALL USING (public.get_current_admin_role() = 'super_admin');

CREATE POLICY "Superadmin manage rewards" ON public.loyalty_rewards 
  FOR ALL USING (public.get_current_admin_role() = 'super_admin');


-- B. POLICIES: CUSTOMER BALANCE & TRANSACTION HISTORY (Sesuai Akses Publik Bebas Baca di Leton)
-- Agar kompatibel dengan klien frontend Leton existing yang memfilter data per customer_id secara langsung,
-- akses membaca (SELECT) diperbolehkan bagi semua pengguna publik (anon & authenticated),
-- sementara hak menulis (INSERT, UPDATE, DELETE) dikunci total hanya untuk Super Admin dan fungsi internal database (Security Definer).
CREATE POLICY "Allow read customer_points to all" ON public.customer_points 
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read transactions to all" ON public.loyalty_transactions 
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read redemptions to all" ON public.reward_redemptions 
  FOR SELECT TO anon, authenticated USING (true);

-- Super Admin berwenang mengelola modifikasi ledger secara global
CREATE POLICY "Superadmin manage customer_points" ON public.customer_points 
  FOR ALL USING (public.get_current_admin_role() = 'super_admin');

CREATE POLICY "Superadmin manage transactions" ON public.loyalty_transactions 
  FOR ALL USING (public.get_current_admin_role() = 'super_admin');

CREATE POLICY "Superadmin manage redemptions" ON public.reward_redemptions 
  FOR ALL USING (public.get_current_admin_role() = 'super_admin');


-- ==============================================================================
-- 10. REPLIKASI REALTIME SUPABASE LOYALTY TABLES
-- ==============================================================================
-- Aktifkan Realtime Publikasi untuk pembaruan instan saldo & voucher di layar pelanggan
alter publication supabase_realtime add table public.customer_points;
alter publication supabase_realtime add table public.reward_redemptions;
alter publication supabase_realtime add table public.loyalty_transactions;
