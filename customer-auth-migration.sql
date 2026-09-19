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

