-- ==============================================================================
-- LETON COFFEE DUMAI - SUPABASE MIGRATION SCRIPT
-- Tables: outlets, orders, order_items
-- Row Level Security (RLS) & Isolation Policies
-- Storage: Bucket 'leton-images' & Public Upload/View Policies
-- Realtime: Replication enablement
-- ==============================================================================

-- 1. Tabel Outlets (Cabang Leton Coffee)
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

-- Seed Data Outlets
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

-- 2. Tabel Orders (Pesanan Pelanggan Online)
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan seluruh kolom tersedia jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS outlet_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS outlet_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_path TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_path TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Tabel Order Items (Relasi Produk)
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

-- 5. Kebijakan Keamanan RLS Orders
DROP POLICY IF EXISTS "Orders Super Admin Full Access" ON public.orders;
DROP POLICY IF EXISTS "Orders Super Admin Read Only" ON public.orders;
DROP POLICY IF EXISTS "Orders Outlet Admin Access" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Read Open" ON public.orders;

-- a. SUPER ADMIN:
-- Super Admin hanya boleh membaca (SELECT) data order untuk keperluan laporan dan sales analytics,
-- bukan untuk kitchen display ataupun mutasi operasional pesanan dapur.
CREATE POLICY "Orders Super Admin Read Only" ON public.orders
FOR SELECT TO anon, authenticated
USING (
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
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE public.orders.id = order_items.order_id
  )
);

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
