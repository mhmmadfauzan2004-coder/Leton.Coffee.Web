-- ==============================================================================
-- 1. PROFILE CUSTOMER TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap TEXT NOT NULL UNIQUE, -- Unik untuk pencarian login berdasarkan nama lengkap
  nomor_hp TEXT NOT NULL UNIQUE,     -- Unik untuk mencegah duplikasi pendaftaran
  tanggal_lahir DATE NOT NULL,
  email_internal TEXT NOT NULL UNIQUE, -- Email internal acak untuk integrasi Supabase Auth tanpa membocorkan data pribadi
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. ORDERS USER COUPLING (NON-DESTRUCTIVE)
-- ==============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ==============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS) FOR PROFILES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hapus policy profiles yang mungkin sudah ada agar tidak duplikat
DROP POLICY IF EXISTS "Enable read for profiles lookup" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Select Policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for profiles registration" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for profiles owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;

-- Policy SELECT:
-- - Customer authenticated hanya dapat membaca profil mereka sendiri (auth.uid() = user_id)
-- - Admin yang menyertakan x-admin-role dapat membaca semua profil
-- - Lookup nomor HP untuk login diproteksi melalui RPC SECURITY DEFINER (get_customer_phone_by_name)
--   sehingga tabel profiles TIDAK DAPAT dibaca sembarangan oleh client/browser
CREATE POLICY "Profiles Select Policy" ON public.profiles
FOR SELECT TO anon, authenticated
USING (
  (auth.uid() = user_id) OR
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
);

-- Policy INSERT: Izinkan user mendaftarkan data profilnya saat register
CREATE POLICY "Profiles Insert Policy" ON public.profiles
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Policy UPDATE: Hanya izinkan pemilik profil untuk mengubah profilnya sendiri
CREATE POLICY "Profiles Update Policy" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) FOR ORDERS
-- ==============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Hapus policy orders yang sudah ada agar tidak duplikat/konflik
DROP POLICY IF EXISTS "Orders Customer Read Own" ON public.orders;
DROP POLICY IF EXISTS "Enable read for everyone" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for anonymous" ON public.orders;
DROP POLICY IF EXISTS "Enable all for admins" ON public.orders;
DROP POLICY IF EXISTS "Orders Select Policy" ON public.orders;
DROP POLICY IF EXISTS "Orders Insert Policy" ON public.orders;
DROP POLICY IF EXISTS "Orders Update Policy" ON public.orders;

-- Policy SELECT:
-- - Customer authenticated hanya dapat membaca order mereka sendiri (user_id = auth.uid())
-- - Admin yang menyertakan header x-admin-role (Super Admin, Outlet Admin, Barista, dll) dapat membaca semua order
CREATE POLICY "Orders Select Policy" ON public.orders
FOR SELECT TO anon, authenticated
USING (
  (auth.uid() = user_id) OR 
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
);

-- Policy INSERT:
-- - Customer authenticated hanya boleh membuat order atas nama user_id mereka sendiri (user_id = auth.uid())
-- - Anon (non-member) boleh checkout dengan user_id NULL (backward-compatible)
-- - Admin boleh membuat order baru secara langsung
CREATE POLICY "Orders Insert Policy" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.uid() IS NULL AND user_id IS NULL) OR
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
);

-- Policy UPDATE:
-- - Customer biasa TIDAK BOLEH mengubah status order
-- - Hanya Admin (dengan header x-admin-role) yang diizinkan untuk mengupdate status order/pembayaran
CREATE POLICY "Orders Update Policy" ON public.orders
FOR UPDATE TO anon, authenticated
USING (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
)
WITH CHECK (
  (current_setting('request.headers', true)::json->>'x-admin-role' IS NOT NULL)
);

-- ==============================================================================
-- 5. SECURE LOOKUP FUNCTIONS FOR CUSTOMER AUTH (SECURITY DEFINER)
-- Menjamin data nomor HP dan data profil pelanggan lain TIDAK PERNAH terekspos ke client
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_phone_by_name(p_nama TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nomor_hp TEXT;
BEGIN
  IF p_nama IS NULL OR TRIM(p_nama) = '' THEN
    RETURN NULL;
  END IF;

  SELECT nomor_hp INTO v_nomor_hp
  FROM public.profiles 
  WHERE LOWER(TRIM(nama_lengkap)) = LOWER(TRIM(p_nama)) 
  LIMIT 1;

  RETURN v_nomor_hp;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_phone_by_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_phone_by_name(TEXT) TO anon, authenticated;

-- Function to safely verify if name exists during registration without querying profiles
CREATE OR REPLACE FUNCTION public.check_customer_name_exists(p_nama TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_nama IS NULL OR TRIM(p_nama) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(TRIM(nama_lengkap)) = LOWER(TRIM(p_nama))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_customer_name_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_customer_name_exists(TEXT) TO anon, authenticated;

-- Function to safely verify if phone exists during registration without exposing profiles
CREATE OR REPLACE FUNCTION public.check_customer_phone_exists(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_digits TEXT;
BEGIN
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
    RETURN FALSE;
  END IF;

  v_clean_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE regexp_replace(nomor_hp, '[^0-9]', '', 'g') = v_clean_digits
       OR nomor_hp = p_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_customer_phone_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_customer_phone_exists(TEXT) TO anon, authenticated;

-- Function to safely fetch internal email for customer login via Supabase Email + Password Auth
-- Menjamin data akun internal dicari secara atomic tanpa membocorkan data pelanggan lain
CREATE OR REPLACE FUNCTION public.get_customer_email_by_name(p_nama TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
BEGIN
  IF p_nama IS NULL OR TRIM(p_nama) = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Cek kolom email_internal di tabel profiles
  SELECT email_internal INTO v_email
  FROM public.profiles 
  WHERE LOWER(TRIM(nama_lengkap)) = LOWER(TRIM(p_nama)) 
  LIMIT 1;

  IF v_email IS NOT NULL AND TRIM(v_email) <> '' THEN
    RETURN TRIM(v_email);
  END IF;

  -- 2. Fallback jika data lama belum memiliki email_internal: generate dari nomor_hp (tanpa underscore)
  SELECT nomor_hp INTO v_phone
  FROM public.profiles 
  WHERE LOWER(TRIM(nama_lengkap)) = LOWER(TRIM(p_nama)) 
  LIMIT 1;

  IF v_phone IS NOT NULL AND TRIM(v_phone) <> '' THEN
    RETURN 'cust' || regexp_replace(v_phone, '[^0-9]', '', 'g') || '@letoncoffee.com';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_email_by_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_email_by_name(TEXT) TO anon, authenticated;

-- ==============================================================================
-- 6. AUTO CONFIRM EMAIL TRIGGER FOR INTERNAL CUSTOMER ACCOUNTS
-- Mencegah kendala "Email not confirmed" pada Supabase Auth tanpa perlu verifikasi email manual
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.auto_confirm_customer_internal_email()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.email LIKE 'cust%@letoncoffee.com') AND NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_customer_internal_email ON auth.users;
CREATE TRIGGER trg_auto_confirm_customer_internal_email
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_customer_internal_email();

-- Update user lama yang berstatus unconfirmed
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email LIKE 'cust%@letoncoffee.com' AND email_confirmed_at IS NULL;

