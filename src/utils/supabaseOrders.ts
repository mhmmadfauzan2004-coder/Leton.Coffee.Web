import { CustomerOrder, OrderStatus, PaymentStatus } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { matchesOutlet } from '../data/adminAccounts';
import { getApiUrl } from './api';
import { safeSetItem, safeGetItem, stripHeavyBase64Images } from './safeStorage';

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
    const payload = {
      id: orderData.id,
      order_number: orderData.orderNumber,
      outlet_id: orderData.outletId,
      outlet_name: orderData.outletName,
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone || null,
      order_type: orderData.orderType,
      table_number: orderData.tableNumber || null,
      items: orderData.items,
      total_amount: orderData.totalAmount,
      payment_method: orderData.paymentMethod,
      payment_status: orderData.paymentStatus,
      payment_proof_path: receiptProofPath,
      payment_receipt_url: orderData.paymentReceiptUrl || null,
      payment_receipt_path: receiptProofPath,
      rejection_reason: orderData.rejectionReason || null,
      order_status: orderData.orderStatus,
      customer_note: orderData.customerNote || null,
      created_at: orderData.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await client.from('orders').insert(payload);
    if (!insertError) {
      console.log('[Supabase Orders] Order inserted successfully into public.orders:', orderData.orderNumber);

      // Try inserting into order_items table
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
        await client.from('order_items').insert(itemRows);
      } catch (itemErr) {
        console.warn('[Supabase Order Items Note]:', itemErr);
      }
    } else {
      console.warn('[Supabase Order Insert Notice]:', insertError.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Orders Exception]:', err);
  }

  // 2. Cloud Database Backup to 'leton_content' (orders_registry)
  // Ensures persistence even before the user executes the full SQL migration in Supabase
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

  // 3. Post to backend server API /api/orders (Express server fallback)
  try {
    const res = await fetch(getApiUrl('/api/orders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (res.ok) {
      console.log('[Backend API] Order registered on server backend.');
    }
  } catch (err) {
    console.warn('[Backend API Order Note]:', err);
  }

  return {
    success: true,
    order: orderData,
  };
}

/**
 * Fetch all orders for Admin Dashboard & Kitchen Display
 * If targetOutletId is specified and not 'ALL', strictly filters orders for that outlet.
 */
export async function fetchAllOrders(targetOutletId?: string): Promise<CustomerOrder[]> {
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const filterId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  const ordersMap = new Map<string, CustomerOrder>();

  // 1. Try Supabase Database 'orders' table
  try {
    const client = getSupabase(activeRole, filterId);
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data) && data.length > 0) {
      data.forEach((row: any) => {
        const order: CustomerOrder = {
          id: row.id,
          orderNumber: row.order_number || row.orderNumber || 'LTN-????',
          outletId: row.outlet_id || row.outletId || '',
          outletName: row.outlet_name || row.outletName || '',
          customerName: row.customer_name || row.customerName || '',
          customerPhone: row.customer_phone || row.customerPhone || '',
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
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          updatedAt: row.updated_at || row.updatedAt,
        };
        ordersMap.set(order.id, order);
      });
    }
  } catch (err) {
    console.warn('[Fetch Supabase Orders Warning]:', err);
  }

  // 2. Fetch from Supabase 'leton_content' orders_registry
  try {
    const client = getSupabase(activeRole, filterId);
    const { data: regRow } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'orders_registry')
      .maybeSingle();

    if (regRow?.content?.orders && Array.isArray(regRow.content.orders)) {
      regRow.content.orders.forEach((o: CustomerOrder) => {
        if (!ordersMap.has(o.id)) {
          ordersMap.set(o.id, o);
        }
      });
    }
  } catch (regErr) {
    console.warn('[Orders Registry Backup Note]:', regErr);
  }

  // 3. Try Backend API /api/orders
  try {
    const token = typeof window !== 'undefined' ? safeGetItem('leton_admin_token') || '' : '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeRole) headers['x-admin-role'] = activeRole;
    if (filterId) headers['x-outlet-id'] = filterId;

    const res = await fetch(getApiUrl('/api/orders'), { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        json.forEach((o: CustomerOrder) => {
          if (!ordersMap.has(o.id)) {
            ordersMap.set(o.id, o);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Fetch Backend Orders Warning]:', err);
  }

  // 4. Merge with Local Cache / History
  try {
    const cached = safeGetItem(ADMIN_ORDERS_CACHE_KEY);
    if (cached) {
      const parsed: CustomerOrder[] = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        parsed.forEach((o) => {
          if (!ordersMap.has(o.id)) {
            ordersMap.set(o.id, o);
          }
        });
      }
    }
  } catch {
    // ignore
  }

  // Convert map to array sorted by creation date descending
  let allOrders = Array.from(ordersMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  // Apply strict outlet filtering if targetOutletId is specified
  if (filterId) {
    allOrders = allOrders.filter((o) => matchesOutlet(o.outletId, filterId));
  }

  safeSetItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(stripHeavyBase64Images(allOrders).slice(0, 50)));
  return allOrders;
}

/**
 * Update Order Status and/or Payment Status (Verified / Rejected / Completed)
 */
export async function updateOrderStatus(
  orderId: string,
  newOrderStatus: OrderStatus,
  newPaymentStatus?: PaymentStatus,
  rejectionReason?: string
): Promise<boolean> {
  let success = false;

  // 1. Supabase update in 'orders' table
  try {
    const client = getSupabase();
    const updatePayload: any = {
      order_status: newOrderStatus,
      updated_at: new Date().toISOString(),
    };
    if (newPaymentStatus) {
      updatePayload.payment_status = newPaymentStatus;
    }
    if (rejectionReason !== undefined) {
      updatePayload.rejection_reason = rejectionReason;
    }

    const { error } = await client.from('orders').update(updatePayload).eq('id', orderId);
    if (!error) {
      success = true;
    }
  } catch (err) {
    console.warn('[Supabase updateOrderStatus Warning]:', err);
  }

  // 1b. Update in 'orders_registry' inside 'leton_content'
  try {
    const client = getSupabase();
    const { data: regRow } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'orders_registry')
      .maybeSingle();

    if (regRow?.content?.orders && Array.isArray(regRow.content.orders)) {
      const updatedList = regRow.content.orders.map((o: CustomerOrder) => {
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

      await client.from('leton_content').upsert({
        id: 'orders_registry',
        content: { orders: updatedList },
        updated_at: new Date().toISOString(),
      });
      success = true;
    }
  } catch (regErr) {
    console.warn('[Registry updateOrderStatus Note]:', regErr);
  }

  // 2. Backend API update
  try {
    const res = await fetch(getApiUrl(`/api/orders/${orderId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderStatus: newOrderStatus,
        paymentStatus: newPaymentStatus,
        rejectionReason,
      }),
    });
    if (res.ok) success = true;
  } catch (err) {
    console.warn('[Backend updateOrderStatus Warning]:', err);
  }

  // 3. Update local cache
  try {
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
  } catch {
    // ignore
  }

  return true;
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

  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const filterOutletId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  // Function to refresh and notify
  const refresh = async (alertOrder?: CustomerOrder) => {
    if (!isSubscribed) return;
    const orders = await fetchAllOrders(filterOutletId);
    onOrdersChange(orders);
    if (alertOrder && onNewOrderAlert) {
      // Super Admin TIDAK menerima realtime kitchen order dan TIDAK memainkan suara notifikasi order dapur
      if (activeRole !== 'super_admin' && (!filterOutletId || matchesOutlet(alertOrder.outletId, filterOutletId))) {
        onNewOrderAlert(alertOrder);
      }
    }
  };

  // 1. Supabase Postgres Realtime Listener
  try {
    const client = getSupabase(activeRole, filterOutletId);
    clientChannel = client
      .channel('orders_realtime_' + Math.random().toString(36).slice(2))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          console.log('[Supabase Realtime Order Event]:', payload.eventType);
          if (payload.eventType === 'INSERT' && payload.new) {
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
              createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
            };

            if (activeRole !== 'super_admin' && (!filterOutletId || matchesOutlet(newOrder.outletId, filterOutletId))) {
              refresh(newOrder);
            } else {
              refresh();
            }
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
      .subscribe();
  } catch (err) {
    console.warn('[Orders Realtime Subscription Error]:', err);
  }

  // 2. Server-Sent Events (SSE) Listener for Backend events
  try {
    sseSource = new EventSource(getApiUrl('/api/events'));
    sseSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && (payload.type === 'ORDER_CREATED' || payload.type === 'ORDER_UPDATED')) {
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
  } catch (sseErr) {
    // SSE optional notice
  }

  // 3. Backup polling every 5 seconds
  const pollInterval = setInterval(() => {
    if (isSubscribed) {
      refresh();
    }
  }, 5000);

  // Return cleanup
  return () => {
    isSubscribed = false;
    clearInterval(pollInterval);
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
 */
export async function fetchSingleOrder(orderIdOrNumber: string): Promise<CustomerOrder | null> {
  if (!orderIdOrNumber) return null;

  // 1. Try Supabase 'orders' table
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('orders')
      .select('*')
      .or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        orderNumber: data.order_number || data.orderNumber || 'LTN-????',
        outletId: data.outlet_id || data.outletId || '',
        outletName: data.outlet_name || data.outletName || '',
        customerName: data.customer_name || data.customerName || '',
        customerPhone: data.customer_phone || data.customerPhone || '',
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
    console.warn('[Fetch Single Supabase Order Error]:', err);
  }

  // 2. Try 'leton_content' orders_registry
  try {
    const client = getSupabase();
    const { data: regRow } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'orders_registry')
      .maybeSingle();

    if (regRow?.content?.orders && Array.isArray(regRow.content.orders)) {
      const match = regRow.content.orders.find(
        (o: CustomerOrder) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
      );
      if (match) return match;
    }
  } catch (regErr) {
    // ignore
  }

  // 3. Try Backend API
  try {
    const res = await fetch(getApiUrl(`/api/orders/${orderIdOrNumber}`));
    if (res.ok) {
      const found = await res.json();
      if (found && found.id) return found;
    }
  } catch {
    // ignore
  }

  // 4. Try Local Storage Cache
  try {
    const local = safeGetItem(ORDERS_STORAGE_KEY) || safeGetItem(ADMIN_ORDERS_CACHE_KEY);
    if (local) {
      const parsed: CustomerOrder[] = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const found = parsed.find(
          (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
        );
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Realtime Subscription for a Single Customer Order
 * Ensures instant UI updates on the customer's Order Confirmation / Bill screen
 */
export function subscribeToSingleOrder(
  orderIdOrNumber: string,
  onUpdate: (order: CustomerOrder) => void
): () => void {
  let isSubscribed = true;
  let clientChannel: any = null;
  let sseSource: EventSource | null = null;

  const checkOrder = async () => {
    if (!isSubscribed) return;
    const latest = await fetchSingleOrder(orderIdOrNumber);
    if (latest && isSubscribed) {
      onUpdate(latest);
    }
  };

  // 1. Initial fetch
  checkOrder();

  // 2. Supabase Postgres Realtime Channel
  try {
    const client = getSupabase();
    clientChannel = client
      .channel(`order_live_${orderIdOrNumber}_${Math.random().toString(36).slice(2)}`)
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
      .subscribe();
  } catch (err) {
    console.warn('[Single Order Realtime Error]:', err);
  }

  // 3. SSE Listener
  try {
    sseSource = new EventSource(getApiUrl('/api/events'));
    sseSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (
          payload &&
          (payload.type === 'ORDER_UPDATED' || payload.type === 'ORDER_CREATED')
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
  } catch {
    // ignore
  }

  // 4. Polling fallback every 2.5 seconds
  const pollInterval = setInterval(() => {
    if (isSubscribed) {
      checkOrder();
    }
  }, 2500);

  return () => {
    isSubscribed = false;
    clearInterval(pollInterval);
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
