-- =========================================================================
-- SECURE ASYNCHRONOUS DATABASE WEBHOOK UNTUK LETON COFFEE BACKGROUND PUSH
-- =========================================================================
-- Desain Keamanan: Menggunakan ekstensi pg_net (net.http_post) yang 100% asinkron
-- dan membaca Kunci Rahasia Webhook secara dinamis dari pengaturan database
-- (app.settings.webhook_secret) tanpa mengekspos plaintext token/key di file SQL.
--
-- PENTING: Sebelum menjalankan script ini, Anda HARUS menetapkan secret key
-- di database Anda dengan menjalankan query ini satu kali terlebih dahulu:
--
-- ALTER DATABASE postgres SET app.settings.webhook_secret = 'ISI_DENGAN_RANDOM_SECURE_STRING_ANDA';
-- =========================================================================

-- 1. Pastikan ekstensi pg_net (asynchronous networking) terpasang di Supabase
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- 2. Buat Fungsi Trigger Webhook Asinkron
CREATE OR REPLACE FUNCTION public.handle_new_order_push_webhook()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  edge_url TEXT := 'https://galwyavdonfzuibrmswt.supabase.co/functions/v1/send-order-push';
  webhook_secret TEXT;
BEGIN
  -- Ambil Kunci Rahasia Webhook secara dinamis dari pengaturan aman database
  -- Ini menghilangkan celah kebocoran plaintext service_role_key di dalam file migrasi SQL.
  BEGIN
    webhook_secret := current_setting('app.settings.webhook_secret', true);
  EXCEPTION WHEN OTHERS THEN
    webhook_secret := NULL;
  END;

  -- Batalkan pengiriman jika secret belum dikonfigurasi di database
  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    RAISE WARNING '[Webhook] Gagal memicu push notification karena app.settings.webhook_secret belum dikonfigurasi di database.';
    RETURN NEW;
  END IF;

  -- Siapkan payload data dalam format webhook standar
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'orders',
    'schema', 'public',
    'record', to_jsonb(NEW)
  );

  -- Kirim HTTP POST secara 100% ASINKRON menggunakan pg_net (tidak memblokir transaksi database)
  PERFORM extensions.net_http_post(
    url := edge_url,
    body := payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Hubungkan Trigger ke tabel public.orders (HANYA UNTUK INSERT PESANAN BARU)
DROP TRIGGER IF EXISTS trigger_new_order_push_webhook ON public.orders;
CREATE TRIGGER trigger_new_order_push_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_order_push_webhook();

-- =========================================================================
-- SELESAI
-- Jalankan script ini pada SQL Editor Supabase Anda untuk mengaktifkan sistem.
-- =========================================================================
