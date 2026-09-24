-- ==============================================================================
-- LETON COFFEE - CUSTOMER LOGIN BY PHONE SUPABASE RPC FUNCTION
-- ==============================================================================
-- NON-DESTRUCTIVE: TIDAK MENGUBAH / MENGHAPUS DATA APAPUN
-- ==============================================================================

-- 1. Pastikan ekstensi pgcrypto aktif
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Function public.customer_login_by_phone
CREATE OR REPLACE FUNCTION public.customer_login_by_phone(
  p_phone TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone TEXT;
  v_normalized_phone TEXT;
  v_customer RECORD;
  v_session_token TEXT;
  v_balance INTEGER := 0;
  v_earned INTEGER := 0;
  v_redeemed INTEGER := 0;
BEGIN
  -- Validasi input
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nomor HP atau password salah.');
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nomor HP atau password salah.');
  END IF;

  -- 1. Bersihkan semua karakter non-angka
  v_clean_phone := REGEXP_REPLACE(TRIM(p_phone), '[^0-9]', '', 'g');

  -- 2. Normalisasi format nomor HP ke 08xxxxxxxxxx
  -- Mendukung format: 085761519565, 6285761519565, +6285761519565, 85761519565
  IF v_clean_phone LIKE '628%' THEN
    v_normalized_phone := '08' || SUBSTRING(v_clean_phone FROM 4);
  ELSIF v_clean_phone LIKE '08%' THEN
    v_normalized_phone := v_clean_phone;
  ELSIF v_clean_phone LIKE '8%' THEN
    v_normalized_phone := '0' || v_clean_phone;
  ELSE
    v_normalized_phone := v_clean_phone;
  END IF;

  -- 3. Cari customer berdasarkan nomor_hp (cek format normalisasi dan raw clean)
  SELECT id, nama_lengkap, nomor_hp, tanggal_lahir, password_hash,
         COALESCE(points_balance, 0) AS points_balance,
         COALESCE(total_points_earned, 0) AS total_points_earned,
         COALESCE(total_points_redeemed, 0) AS total_points_redeemed
  INTO v_customer
  FROM public.customers
  WHERE nomor_hp = v_normalized_phone
     OR nomor_hp = v_clean_phone
     OR nomor_hp = TRIM(p_phone)
  LIMIT 1;

  -- 4. Jika customer tidak ditemukan
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nomor HP atau password salah.');
  END IF;

  -- 5. Verifikasi password menggunakan bcrypt / pgcrypto
  IF v_customer.password_hash IS NULL OR v_customer.password_hash != crypt(p_password, v_customer.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nomor HP atau password salah.');
  END IF;

  -- 6. Generate server-side session token kriptografis (32 bytes random hex = 64 karakter)
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- 7. Simpan session token (berlaku 30 hari)
  INSERT INTO public.customer_sessions (customer_id, token, expires_at)
  VALUES (v_customer.id, v_session_token, NOW() + INTERVAL '30 days');

  -- 8. Hitung / ambil saldo points dari customer_points jika tersedia
  BEGIN
    SELECT COALESCE(current_balance, 0), COALESCE(total_points_earned, 0), COALESCE(total_points_redeemed, 0)
    INTO v_balance, v_earned, v_redeemed
    FROM public.customer_points
    WHERE customer_id = v_customer.id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_balance := v_customer.points_balance;
    v_earned := v_customer.total_points_earned;
    v_redeemed := v_customer.total_points_redeemed;
  END;

  IF v_balance = 0 AND v_earned = 0 AND v_redeemed = 0 THEN
    v_balance := v_customer.points_balance;
    v_earned := v_customer.total_points_earned;
    v_redeemed := v_customer.total_points_redeemed;
  END IF;

  -- 9. Return metadata yang aman (JANGAN return password / password_hash)
  RETURN jsonb_build_object(
    'success', true,
    'token', v_session_token,
    'customer_id', v_customer.id,
    'nama_lengkap', v_customer.nama_lengkap,
    'nomor_hp', v_customer.nomor_hp,
    'tanggal_lahir', v_customer.tanggal_lahir::TEXT,
    'points_balance', v_balance,
    'total_points_earned', v_earned,
    'total_points_redeemed', v_redeemed,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'userId', v_customer.id,
      'namaLengkap', v_customer.nama_lengkap,
      'nomorHp', v_customer.nomor_hp,
      'tanggalLahir', v_customer.tanggal_lahir::TEXT,
      'pointsBalance', v_balance,
      'totalPointsEarned', v_earned,
      'totalPointsRedeemed', v_redeemed
    )
  );
END;
$$;

-- Security Hardening & Permissions
REVOKE ALL ON FUNCTION public.customer_login_by_phone(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_login_by_phone(TEXT, TEXT) TO anon, authenticated, service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
