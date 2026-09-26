-- ==============================================================================
-- MIGRATION: FIX RPC admin_delete_registered_customer (UUID vs TEXT)
-- Description: Mengatasi error "operator does not exist: uuid = text" saat Super Admin
--              menghapus member, dengan validasi dan konversi eksplisit ke UUID (v_customer_id uuid).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_registered_customer(
  p_customer_id text,
  p_admin_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_customer_id uuid;
  v_member_exists boolean;
  v_target_order_ids text[];
  v_deleted_orders integer := 0;
  v_deleted_order_items integer := 0;
  v_deleted_member integer := 0;
BEGIN
  -- 1. Validasi Token Admin Session
  IF p_admin_token IS NULL OR trim(p_admin_token) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token admin tidak ditemukan. Silakan login kembali sebagai Super Admin.'
    );
  END IF;

  -- Cari sesi admin aktif di public.admin_sessions
  SELECT role INTO v_admin_role
  FROM public.admin_sessions
  WHERE token = trim(p_admin_token)
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  -- Izinkan jika token sesi valid atau pemanggil adalah internal service role
  IF v_admin_role IS NULL AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sesi admin tidak valid atau telah berakhir. Silakan login kembali sebagai Super Admin.'
    );
  END IF;

  -- Pastikan role adalah super_admin
  IF v_admin_role IS NOT NULL AND v_admin_role <> 'super_admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang berhak menghapus member.'
    );
  END IF;

  -- 2. Validasi p_customer_id sebagai format UUID yang sah
  IF p_customer_id IS NULL OR trim(p_customer_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ID Member wajib diisi.'
    );
  END IF;

  IF trim(p_customer_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Format ID Member tidak valid (harus berupa UUID).'
    );
  END IF;

  -- Konversi sekali ke UUID variable
  v_customer_id := trim(p_customer_id)::uuid;

  -- 3. Cek keberadaan member di public.customers
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = v_customer_id) INTO v_member_exists;
  IF NOT v_member_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Member tidak ditemukan di database atau sudah dihapus sebelumnya.'
    );
  END IF;

  -- 4. Hapus order_items dan orders milik member target
  SELECT coalesce(array_agg(id), ARRAY[]::text[]) INTO v_target_order_ids
  FROM public.orders
  WHERE customer_id = v_customer_id;

  IF array_length(v_target_order_ids, 1) > 0 THEN
    -- Hapus order items terkait
    DELETE FROM public.order_items
    WHERE order_id = ANY(v_target_order_ids);
    GET DIAGNOSTICS v_deleted_order_items = ROW_COUNT;

    -- Hapus orders terkait
    DELETE FROM public.orders
    WHERE customer_id = v_customer_id;
    GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;
  ELSE
    v_deleted_orders := 0;
    v_deleted_order_items := 0;
  END IF;

  -- 5. Hapus customer_sessions milik member target
  DELETE FROM public.customer_sessions
  WHERE customer_id = v_customer_id;

  -- 6. Hapus data rewards & loyalty jika tabel tersedia
  BEGIN
    DELETE FROM public.reward_redemptions WHERE customer_id = v_customer_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.loyalty_transactions WHERE customer_id = v_customer_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.customer_points WHERE customer_id = v_customer_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 7. Hapus record member dari public.customers
  DELETE FROM public.customers
  WHERE id = v_customer_id;
  GET DIAGNOSTICS v_deleted_member = ROW_COUNT;

  -- 8. Verifikasi bahwa member telah terhapus
  IF EXISTS(SELECT 1 FROM public.customers WHERE id = v_customer_id) THEN
    RAISE EXCEPTION 'Gagal menghapus member: Data masih ada di tabel customers.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Member dan seluruh riwayat data terkait berhasil dihapus secara permanen.',
    'deleted_orders', v_deleted_orders,
    'deleted_order_items', v_deleted_order_items,
    'deleted_member', v_deleted_member
  );
END;
$$;

-- Izin Eksekusi Fungsi RPC
REVOKE ALL ON FUNCTION public.admin_delete_registered_customer(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_registered_customer(text, text) TO anon, authenticated, service_role;
