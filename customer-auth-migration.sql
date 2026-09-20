-- ==============================================================================
-- LETON COFFEE - PURE NON-DESTRUCTIVE CUSTOMER AUTH MIGRATION
-- ==============================================================================
-- ATURAN KETAT:
-- 1. TIDAK ADA DROP TABLE
-- 2. TIDAK ADA DROP COLUMN
-- 3. TIDAK ADA DROP FOREIGN KEY
-- 4. TIDAK ADA PENGUBAHAN CONSTRAINT EXISTING
-- 5. TIDAK MENYENTUH public.profiles
-- 6. TIDAK MENGUBAH orders.user_id
-- 7. TIDAK MENYENTUH public.order_items
-- 8. TIDAK MENGUBAH Admin Auth atau Outlet Auth
-- ==============================================================================

-- 1. EXTENSION PGCRYPTO (Untuk Bcrypt Hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABEL STANDALONE CUSTOMERS (Hanya untuk member/pelanggan)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_lengkap TEXT NOT NULL,
  nomor_hp TEXT NOT NULL,
  tanggal_lahir DATE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index unik untuk pencarian cepat & mencegah duplikasi
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_nama_lower ON public.customers (LOWER(TRIM(nama_lengkap)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_nomor_hp ON public.customers (nomor_hp);

-- 3. TABEL CUSTOMER SESSIONS (Server-Side Secure Session Token)
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON public.customer_sessions (token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON public.customer_sessions (customer_id);

-- 4. TAMBAHKAN HANYA KOLOM customer_id PADA TABEL orders
-- (user_id dan foreign key existing sama sekali tidak disentuh)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);

-- 5. ROW LEVEL SECURITY (RLS) UNTUK TABEL CUSTOMER
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- Mencegah akses langsung via REST client browser ke tabel raw (wajib melalui RPC SECURITY DEFINER)
DROP POLICY IF EXISTS "Deny direct anon access customers" ON public.customers;
CREATE POLICY "Deny direct anon access customers" ON public.customers
FOR ALL TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "Deny direct anon access sessions" ON public.customer_sessions;
CREATE POLICY "Deny direct anon access sessions" ON public.customer_sessions
FOR ALL TO anon, authenticated
USING (false);

-- ==============================================================================
-- 6. RPC FUNCTIONS (SECURITY DEFINER)
-- ==============================================================================

-- A. Register Customer
CREATE OR REPLACE FUNCTION public.customer_register(
  p_nama TEXT,
  p_phone TEXT,
  p_birth_date DATE,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_nama TEXT;
  v_clean_phone TEXT;
  v_customer_id UUID;
  v_session_token TEXT;
  v_hash TEXT;
BEGIN
  v_clean_nama := TRIM(p_nama);
  v_clean_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');

  IF v_clean_nama IS NULL OR LENGTH(v_clean_nama) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap wajib diisi minimal 2 karakter.');
  END IF;

  IF v_clean_phone IS NULL OR LENGTH(v_clean_phone) < 9 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nomor Handphone minimal 9 digit angka.');
  END IF;

  IF p_birth_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tanggal Lahir wajib diisi.');
  END IF;

  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password minimal 6 karakter.');
  END IF;

  -- Cek duplikasi Nama Lengkap (case-insensitive)
  IF EXISTS (SELECT 1 FROM public.customers WHERE LOWER(TRIM(nama_lengkap)) = LOWER(v_clean_nama)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap ini sudah terdaftar. Silakan masuk/login.');
  END IF;

  -- Cek duplikasi Nomor HP
  IF EXISTS (SELECT 1 FROM public.customers WHERE nomor_hp = v_clean_phone) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nomor Handphone ini sudah terdaftar. Silakan masuk/login.');
  END IF;

  -- Hash password menggunakan bcrypt pgcrypto
  v_hash := crypt(p_password, gen_salt('bf', 10));

  -- Insert ke public.customers
  INSERT INTO public.customers (nama_lengkap, nomor_hp, tanggal_lahir, password_hash)
  VALUES (v_clean_nama, v_clean_phone, p_birth_date, v_hash)
  RETURNING id INTO v_customer_id;

  -- Buat session token 64-karakter kriptografis (32 bytes hex)
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- Simpan session (berlaku 30 hari)
  INSERT INTO public.customer_sessions (customer_id, token, expires_at)
  VALUES (v_customer_id, v_session_token, NOW() + INTERVAL '30 days');

  RETURN jsonb_build_object(
    'success', true,
    'token', v_session_token,
    'customer', jsonb_build_object(
      'id', v_customer_id,
      'userId', v_customer_id,
      'namaLengkap', v_clean_nama,
      'nomorHp', v_clean_phone,
      'tanggalLahir', p_birth_date::TEXT
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_register(TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_register(TEXT, TEXT, DATE, TEXT) TO anon, authenticated, service_role;


-- B. Login Customer (Nama Lengkap & Password)
CREATE OR REPLACE FUNCTION public.customer_login(
  p_nama TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_nama TEXT;
  v_customer RECORD;
  v_session_token TEXT;
  v_digits TEXT;
BEGIN
  v_clean_nama := TRIM(p_nama);

  IF v_clean_nama IS NULL OR v_clean_nama = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap wajib diisi.');
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password wajib diisi.');
  END IF;

  v_digits := REGEXP_REPLACE(v_clean_nama, '[^0-9]', '', 'g');

  -- Cari customer berdasarkan Nama Lengkap (case-insensitive) atau nomor HP
  SELECT id, nama_lengkap, nomor_hp, tanggal_lahir, password_hash
  INTO v_customer
  FROM public.customers
  WHERE LOWER(TRIM(nama_lengkap)) = LOWER(v_clean_nama)
     OR (LENGTH(v_digits) >= 9 AND nomor_hp = v_digits)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap atau Password salah.');
  END IF;

  -- Verifikasi hash bcrypt
  IF v_customer.password_hash != crypt(p_password, v_customer.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap atau Password salah.');
  END IF;

  -- Generate token sesi baru
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- Simpan session (berlaku 30 hari)
  INSERT INTO public.customer_sessions (customer_id, token, expires_at)
  VALUES (v_customer.id, v_session_token, NOW() + INTERVAL '30 days');

  RETURN jsonb_build_object(
    'success', true,
    'token', v_session_token,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'userId', v_customer.id,
      'namaLengkap', v_customer.nama_lengkap,
      'nomorHp', v_customer.nomor_hp,
      'tanggalLahir', v_customer.tanggal_lahir::TEXT
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_login(TEXT, TEXT) TO anon, authenticated, service_role;


-- C. Get Session Profile (Verifikasi Token Session Server-Side)
CREATE OR REPLACE FUNCTION public.customer_get_session(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust RECORD;
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  SELECT c.id, c.nama_lengkap, c.nomor_hp, c.tanggal_lahir
  INTO v_cust
  FROM public.customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.token = p_token
    AND s.expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak valid atau telah berakhir.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', v_cust.id,
      'userId', v_cust.id,
      'namaLengkap', v_cust.nama_lengkap,
      'nomorHp', v_cust.nomor_hp,
      'tanggalLahir', v_cust.tanggal_lahir::TEXT
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_get_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_get_session(TEXT) TO anon, authenticated, service_role;


-- D. Logout Customer (Mencabut Token Session)
CREATE OR REPLACE FUNCTION public.customer_logout(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.customer_sessions WHERE token = p_token;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_logout(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_logout(TEXT) TO anon, authenticated, service_role;


-- E. Update Customer Profile (Nama Lengkap & Tanggal Lahir)
CREATE OR REPLACE FUNCTION public.customer_update_profile(
  p_token TEXT,
  p_nama TEXT,
  p_birth_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_clean_nama TEXT;
  v_cust RECORD;
BEGIN
  v_clean_nama := TRIM(p_nama);
  IF v_clean_nama IS NULL OR LENGTH(v_clean_nama) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap wajib diisi minimal 2 karakter.');
  END IF;

  SELECT customer_id INTO v_customer_id
  FROM public.customer_sessions
  WHERE token = p_token AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi login telah berakhir.');
  END IF;

  -- Pastikan nama tidak bentrok dengan customer lain
  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE LOWER(TRIM(nama_lengkap)) = LOWER(v_clean_nama) AND id != v_customer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap sudah digunakan oleh member lain.');
  END IF;

  -- Update tabel public.customers saja
  UPDATE public.customers
  SET nama_lengkap = v_clean_nama,
      tanggal_lahir = p_birth_date,
      updated_at = NOW()
  WHERE id = v_customer_id
  RETURNING id, nama_lengkap, nomor_hp, tanggal_lahir INTO v_cust;

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', v_cust.id,
      'userId', v_cust.id,
      'namaLengkap', v_cust.nama_lengkap,
      'nomorHp', v_cust.nomor_hp,
      'tanggalLahir', v_cust.tanggal_lahir::TEXT
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_update_profile(TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_update_profile(TEXT, TEXT, DATE) TO anon, authenticated, service_role;


-- F. Get Customer Orders (Hanya mengambil orders berdasarkan orders.customer_id = customer.id)
CREATE OR REPLACE FUNCTION public.customer_get_my_orders(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_orders JSONB;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM public.customer_sessions
  WHERE token = p_token AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  WHERE o.customer_id = v_customer_id;

  RETURN v_orders;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_get_my_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_get_my_orders(TEXT) TO anon, authenticated, service_role;

-- 8. ALLOW SUPER ADMIN ACCESS TO CUSTOMERS (POLICY & RPC)
DROP POLICY IF EXISTS "Allow super_admin select customers" ON public.customers;
CREATE POLICY "Allow super_admin select customers" ON public.customers
FOR SELECT TO anon, authenticated
USING (
  public.get_current_admin_role() = 'super_admin'
);

DROP POLICY IF EXISTS "Allow super_admin delete customers" ON public.customers;
CREATE POLICY "Allow super_admin delete customers" ON public.customers
FOR DELETE TO anon, authenticated
USING (
  public.get_current_admin_role() = 'super_admin'
);

DROP POLICY IF EXISTS "Allow super_admin delete customer_sessions" ON public.customer_sessions;
CREATE POLICY "Allow super_admin delete customer_sessions" ON public.customer_sessions
FOR DELETE TO anon, authenticated
USING (
  public.get_current_admin_role() = 'super_admin'
);

CREATE OR REPLACE FUNCTION public.delete_registered_customer_rpc(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Security check: only allow if current admin role is super_admin
  IF public.get_current_admin_role() <> 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat menghapus member.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member tidak ditemukan di database.');
  END IF;

  -- Unlink orders referencing this customer_id so orders are preserved as history
  UPDATE public.orders SET customer_id = NULL WHERE customer_id = p_customer_id;

  -- Delete related customer sessions and loyalty records
  DELETE FROM public.customer_sessions WHERE customer_id = p_customer_id;
  DELETE FROM public.reward_redemptions WHERE customer_id = p_customer_id;
  DELETE FROM public.loyalty_transactions WHERE customer_id = p_customer_id;
  DELETE FROM public.customer_points WHERE customer_id = p_customer_id;

  -- Delete customer record from public.customers
  DELETE FROM public.customers WHERE id = p_customer_id;

  -- Verification check
  IF EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gagal menghapus member: Record masih tersimpan di database.');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Member berhasil dihapus secara permanen.');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_registered_customer_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_registered_customer_rpc(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_registered_customers()
RETURNS TABLE (
  id UUID,
  nama_lengkap TEXT,
  nomor_hp TEXT,
  tanggal_lahir DATE,
  points_balance INTEGER,
  total_points_earned INTEGER,
  total_points_redeemed INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  password_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: only allow if current admin role is super_admin
  IF public.get_current_admin_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat melihat Data Customer.';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.nama_lengkap,
    c.nomor_hp,
    c.tanggal_lahir,
    c.points_balance,
    c.total_points_earned,
    c.total_points_redeemed,
    c.created_at,
    c.updated_at,
    c.password_hash
  FROM public.customers c
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_registered_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_registered_customers() TO anon, authenticated, service_role;

-- 9. REFRESH POSTGREST SCHEMA CACHE SECARA INSTAN
NOTIFY pgrst, 'reload schema';

