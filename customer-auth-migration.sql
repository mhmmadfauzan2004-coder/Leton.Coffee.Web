-- ==============================================================================
-- LETON COFFEE - CUSTOMER AUTHENTICATION MIGRATION (NO FAKE EMAIL / STANDALONE AUTH)
-- ==============================================================================
-- 1. Pgcrypto extension untuk hashing bcrypt yang aman
-- 2. Tabel public.customers untuk menyimpan data customer & password hash
-- 3. Tabel public.customer_sessions untuk mengelola server-side token session
-- 4. RPC Functions (SECURITY DEFINER) untuk Register, Login, Session, Profile, & Orders
-- 5. Row Level Security (RLS) policies
-- ==============================================================================

-- 1. EXTENSION PGCRYPTO
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABEL CUSTOMERS (SEPARATE FROM AUTH.USERS)
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

-- 3. TABEL CUSTOMER SESSIONS (SERVER-SIDE SECURE SESSIONS)
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON public.customer_sessions (token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON public.customer_sessions (customer_id);

-- 4. NON-DESTRUCTIVE ADJUSTMENT TO EXISTING PROFILES & ORDERS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nama_lengkap TEXT,
  full_name TEXT,
  nomor_hp TEXT,
  phone_number TEXT,
  tanggal_lahir DATE,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure profiles user_id is nullable if existing table had NOT NULL
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nomor_hp TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Ensure orders has user_id and customer_id without restrictive foreign key to auth.users
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'orders' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%user_id%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Deny direct anon/browser access to customers and sessions table (all access must go through SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Deny direct anon access customers" ON public.customers;
CREATE POLICY "Deny direct anon access customers" ON public.customers
FOR ALL TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "Deny direct anon access sessions" ON public.customer_sessions;
CREATE POLICY "Deny direct anon access sessions" ON public.customer_sessions
FOR ALL TO anon, authenticated
USING (false);

-- Profiles RLS
DROP POLICY IF EXISTS "Profiles Select Policy" ON public.profiles;
CREATE POLICY "Profiles Select Policy" ON public.profiles
FOR SELECT TO anon, authenticated
USING (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL) OR
  (user_id IS NOT NULL AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
CREATE POLICY "Profiles Insert Policy" ON public.profiles
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Orders RLS
DROP POLICY IF EXISTS "Orders Select Policy" ON public.orders;
CREATE POLICY "Orders Select Policy" ON public.orders
FOR SELECT TO anon, authenticated
USING (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL) OR
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (user_id IS NULL)
);

DROP POLICY IF EXISTS "Orders Insert Policy" ON public.orders;
CREATE POLICY "Orders Insert Policy" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Orders Update Policy" ON public.orders;
CREATE POLICY "Orders Update Policy" ON public.orders
FOR UPDATE TO anon, authenticated
USING (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
)
WITH CHECK (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
);

-- ==============================================================================
-- 6. SECURITY DEFINER RPC FUNCTIONS FOR CUSTOMER AUTH
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
    RETURN jsonb_build_object('success', false, 'error', 'Nomor Handphone minimal 9 digit.');
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

  -- Insert customer
  INSERT INTO public.customers (nama_lengkap, nomor_hp, tanggal_lahir, password_hash)
  VALUES (v_clean_nama, v_clean_phone, p_birth_date, v_hash)
  RETURNING id INTO v_customer_id;

  -- Simpan mirror di profiles untuk backward-compatibility
  BEGIN
    INSERT INTO public.profiles (id, user_id, nama_lengkap, full_name, nomor_hp, phone_number, tanggal_lahir, birth_date)
    VALUES (v_customer_id, v_customer_id, v_clean_nama, v_clean_nama, v_clean_phone, v_clean_phone, p_birth_date, p_birth_date)
    ON CONFLICT (id) DO UPDATE SET
      nama_lengkap = EXCLUDED.nama_lengkap,
      full_name = EXCLUDED.full_name,
      nomor_hp = EXCLUDED.nomor_hp,
      phone_number = EXCLUDED.phone_number,
      tanggal_lahir = EXCLUDED.tanggal_lahir,
      birth_date = EXCLUDED.birth_date,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
  END;

  -- Buat token sesi 64-karakter kriptografis
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- Simpan sesi di customer_sessions (berlaku 30 hari)
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
GRANT EXECUTE ON FUNCTION public.customer_register(TEXT, TEXT, DATE, TEXT) TO anon, authenticated;


-- B. Login Customer (Menggunakan Nama Lengkap & Password)
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

  -- Simpan sesi
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
GRANT EXECUTE ON FUNCTION public.customer_login(TEXT, TEXT) TO anon, authenticated;


-- C. Get Session Profile (Verifikasi Session Token Server-Side)
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
GRANT EXECUTE ON FUNCTION public.customer_get_session(TEXT) TO anon, authenticated;


-- D. Logout Customer
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
GRANT EXECUTE ON FUNCTION public.customer_logout(TEXT) TO anon, authenticated;


-- E. Update Customer Profile
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
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap wajib diisi.');
  END IF;

  SELECT customer_id INTO v_customer_id
  FROM public.customer_sessions
  WHERE token = p_token AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi login telah berakhir.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE LOWER(TRIM(nama_lengkap)) = LOWER(v_clean_nama) AND id != v_customer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama Lengkap sudah digunakan oleh member lain.');
  END IF;

  UPDATE public.customers
  SET nama_lengkap = v_clean_nama,
      tanggal_lahir = p_birth_date,
      updated_at = NOW()
  WHERE id = v_customer_id
  RETURNING id, nama_lengkap, nomor_hp, tanggal_lahir INTO v_cust;

  BEGIN
    UPDATE public.profiles
    SET nama_lengkap = v_clean_nama,
        full_name = v_clean_nama,
        tanggal_lahir = p_birth_date,
        birth_date = p_birth_date,
        updated_at = NOW()
    WHERE id = v_customer_id OR user_id = v_customer_id;
  EXCEPTION WHEN OTHERS THEN
  END;

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
GRANT EXECUTE ON FUNCTION public.customer_update_profile(TEXT, TEXT, DATE) TO anon, authenticated;


-- F. Get Customer Orders (Hanya mengambil order milik customer yang bersangkutan)
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
    RETURN jsonb_build_object('success', false, 'error', 'Sesi login tidak valid.', 'orders', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  WHERE o.user_id = v_customer_id OR o.customer_id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_get_my_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_get_my_orders(TEXT) TO anon, authenticated;
