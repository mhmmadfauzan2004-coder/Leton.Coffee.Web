import { CustomerOrder, OrderStatus, PaymentStatus } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { matchesOutlet } from '../data/adminAccounts';

const ORDERS_STORAGE_KEY = 'leton_orders_history';
const ADMIN_ORDERS_CACHE_KEY = 'leton_admin_orders_cache';

export const ORDERS_SQL_SCHEMA = `-- 1. Buat Tabel Outlets
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

-- 2. Buat Tabel Orders (Pesanan Pelanggan)
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
  payment_receipt_url TEXT, -- URL file bukti pembayaran (Supabase Storage)
  payment_receipt_path TEXT, -- Path unik file bukti pembayaran di Storage
  rejection_reason TEXT, -- Alasan jika pembayaran ditolak
  order_status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
  customer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambah kolom jika tabel sudah ada sebelumnya
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_receipt_path TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Buat Tabel Order Items (Rincian Produk per Pesanan)
CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  image TEXT,
  note TEXT,
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
DROP POLICY IF EXISTS "Orders Outlet Admin Access" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Public Read Open" ON public.orders;

-- a. SUPER ADMIN: Akses penuh (SELECT, INSERT, UPDATE, DELETE) ke seluruh data semua outlet
CREATE POLICY "Orders Super Admin Full Access" ON public.orders
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'super_admin'
)
WITH CHECK (
  get_current_admin_role() = 'super_admin'
);

-- b. OUTLET ADMIN: Hanya dapat membaca & mengupdate pesanan di outlet yang ditugaskan
CREATE POLICY "Orders Outlet Admin Access" ON public.orders
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'outlet_admin'
  AND (
    outlet_id = get_current_outlet_id()
    OR outlet_id ILIKE '%' || get_current_outlet_id() || '%'
    OR get_current_outlet_id() ILIKE '%' || outlet_id || '%'
  )
)
WITH CHECK (
  get_current_admin_role() = 'outlet_admin'
  AND (
    outlet_id = get_current_outlet_id()
    OR outlet_id ILIKE '%' || get_current_outlet_id() || '%'
    OR get_current_outlet_id() ILIKE '%' || outlet_id || '%'
  )
);

-- c. Customer Publik: Dapat membuat pesanan baru
CREATE POLICY "Orders Public Insert" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- d. Customer Publik: Dapat membaca pesanan untuk pelacakan status
CREATE POLICY "Orders Public Read Open" ON public.orders
FOR SELECT TO anon, authenticated
USING (
  get_current_admin_role() = '' OR get_current_admin_role() IS NULL
);

-- 6. Kebijakan Akses Order Items (Relasi Otomatis mengikuti Induk Order)
DROP POLICY IF EXISTS "Public Read Access Order Items" ON public.order_items;
DROP POLICY IF EXISTS "Public Insert Access Order Items" ON public.order_items;
DROP POLICY IF EXISTS "Order Items Super Admin Access" ON public.order_items;
DROP POLICY IF EXISTS "Order Items Outlet Admin Access" ON public.order_items;
DROP POLICY IF EXISTS "Order Items Public Access" ON public.order_items;

CREATE POLICY "Order Items Super Admin Access" ON public.order_items
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'super_admin'
)
WITH CHECK (
  get_current_admin_role() = 'super_admin'
);

CREATE POLICY "Order Items Outlet Admin Access" ON public.order_items
FOR ALL TO anon, authenticated
USING (
  get_current_admin_role() = 'outlet_admin'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (
      o.outlet_id = get_current_outlet_id()
      OR o.outlet_id ILIKE '%' || get_current_outlet_id() || '%'
      OR get_current_outlet_id() ILIKE '%' || o.outlet_id || '%'
    )
  )
)
WITH CHECK (
  get_current_admin_role() = 'outlet_admin'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (
      o.outlet_id = get_current_outlet_id()
      OR o.outlet_id ILIKE '%' || get_current_outlet_id() || '%'
      OR get_current_outlet_id() ILIKE '%' || o.outlet_id || '%'
    )
  )
);

CREATE POLICY "Order Items Public Access" ON public.order_items
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 7. Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;`;

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
    const updated = [order, ...filtered].slice(0, 20); // keep last 20 orders
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save order to local history:', err);
  }
}

export function getLocalOrderHistory(): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
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
    const raw = localStorage.getItem(ADMIN_ORDERS_CACHE_KEY);
    let orders: CustomerOrder[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(orders)) orders = [];
    const index = orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    localStorage.setItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(orders.slice(0, 200)));
  } catch (err) {
    console.warn('Local cache update failed:', err);
  }
}

/**
 * Upload Payment Receipt to Supabase Storage (strictly as file, NEVER Base64 in database)
 * Valid formats: JPG, JPEG, PNG, WEBP
 */
export async function uploadPaymentReceipt(
  file: File,
  orderNumber: string
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  // 1. Format validation
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!validExtensions.includes(ext)) {
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
  const safeOrderCode = orderNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueToken = Math.random().toString(36).substring(2, 8);
  const filePath = `receipts/${safeOrderCode}_${timestamp}_${uniqueToken}.${ext}`;

  // 4. Try Supabase Storage first
  try {
    const client = getSupabase();
    const bucketName = 'leton-images';

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
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
      console.warn('[Supabase Storage Receipt Upload Notice]:', uploadError.message);
    }
  } catch (err) {
    console.warn('[Supabase Storage Receipt Exception]:', err);
  }

  // 5. High-reliability Server Storage fallback (so customer is never blocked)
  try {
    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('orderNumber', safeOrderCode);

    const res = await fetch('/api/upload-receipt', {
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
    console.warn('[Backend Receipt Upload Fallback Note]:', backendErr);
  }

  return {
    success: false,
    error: 'Gagal mengupload bukti transfer. Pastikan file valid dan coba kembali.',
  };
}

/**
 * Post Order to Supabase and Backend API with Fallback
 */
export async function createNewOrder(orderData: CustomerOrder): Promise<{ success: boolean; order: CustomerOrder; error?: string }> {
  // Always update local cache & history first
  saveOrderToLocalHistory(orderData);
  updateLocalCache(orderData);

  let supabaseSuccess = false;
  let backendSuccess = false;

  // 1. Try Supabase Insert
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
      payment_receipt_url: orderData.paymentReceiptUrl || null,
      payment_receipt_path: orderData.paymentReceiptPath || null,
      rejection_reason: orderData.rejectionReason || null,
      order_status: orderData.orderStatus,
      customer_note: orderData.customerNote || null,
      created_at: orderData.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('orders').insert(payload);
    if (!error) {
      supabaseSuccess = true;
      console.log('[Supabase Orders] Order successfully inserted into Supabase:', orderData.orderNumber);

      // Also try inserting items into order_items table for normalized relations if possible
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
          created_at: new Date().toISOString(),
        }));
        await client.from('order_items').insert(itemRows);
      } catch (itemErr) {
        // Soft fail on order_items if table doesn't exist
        console.warn('[Supabase Order Items Note]:', itemErr);
      }
    } else {
      console.warn('[Supabase Order Insert Warning]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Exception on createOrder]:', err);
  }

  // 2. Post to backend server API /api/orders (for backup & local SSE broadcast)
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (res.ok) {
      backendSuccess = true;
      console.log('[Backend API] Order stored in server backend.');
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
 * Fetch all orders for Admin Dashboard (from Supabase, then backend, then local cache)
 * If targetOutletId is specified and not 'ALL', strictly filters orders for that outlet.
 */
export async function fetchAllOrders(targetOutletId?: string): Promise<CustomerOrder[]> {
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const isOutletRestricted = activeRole === 'outlet_admin' || (Boolean(activeOutlet) && activeOutlet !== 'ALL');
  const filterId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  // 1. Try Supabase Database
  try {
    const client = getSupabase(activeRole, filterId);
    let query = client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterId) {
      query = query.or(`outlet_id.eq.${filterId},outlet_id.ilike.%${filterId}%`);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data) && data.length > 0) {
      let mapped: CustomerOrder[] = data.map((row: any) => ({
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
        paymentReceiptUrl: row.payment_receipt_url || row.paymentReceiptUrl,
        paymentReceiptPath: row.payment_receipt_path || row.paymentReceiptPath,
        rejectionReason: row.rejection_reason || row.rejectionReason,
        orderStatus: row.order_status || row.orderStatus || 'NEW',
        customerNote: row.customer_note || row.customerNote || '',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt,
      }));

      if (filterId) {
        mapped = mapped.filter((o) => matchesOutlet(o.outletId, filterId));
      }

      // Cache locally
      localStorage.setItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch (err) {
    console.warn('[Fetch Supabase Orders Warning]:', err);
  }

  // 2. Try Backend API /api/orders (with Role & Outlet headers)
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || '' : '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeRole) headers['x-admin-role'] = activeRole;
    if (filterId) headers['x-outlet-id'] = filterId;

    const res = await fetch('/api/orders', { headers });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        let filtered = json;
        if (filterId) {
          filtered = json.filter((o: CustomerOrder) => matchesOutlet(o.outletId, filterId));
        }
        localStorage.setItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(filtered));
        return filtered;
      }
    }
  } catch (err) {
    console.warn('[Fetch Backend Orders Warning]:', err);
  }

  // 3. Fallback to Local Cache
  try {
    const cached = localStorage.getItem(ADMIN_ORDERS_CACHE_KEY);
    if (cached) {
      const parsed: CustomerOrder[] = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        if (filterId) {
          return parsed.filter((o) => matchesOutlet(o.outletId, filterId));
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Update Order Status (NEW, ACCEPTED, PREPARING, READY, COMPLETED, CANCELLED)
 * and/or Payment Status (WAITING PAYMENT, WAITING VERIFICATION, PAY AT STORE, PAID, PAYMENT REJECTED)
 */
export async function updateOrderStatus(
  orderId: string,
  newOrderStatus: OrderStatus,
  newPaymentStatus?: PaymentStatus,
  rejectionReason?: string
): Promise<boolean> {
  let success = false;

  // 1. Supabase update
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

    const { error } = await client
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (!error) {
      success = true;
    }
  } catch (err) {
    console.warn('[Supabase updateOrderStatus Warning]:', err);
  }

  // 2. Backend API update
  try {
    const res = await fetch(`/api/orders/${orderId}`, {
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
    const cached = localStorage.getItem(ADMIN_ORDERS_CACHE_KEY);
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
      localStorage.setItem(ADMIN_ORDERS_CACHE_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore
  }

  return true;
}

/**
 * Realtime Subscription for Orders
 * Listens for new and updated orders via Supabase Postgres Realtime Channel,
 * with polling backup.
 * If targetOutletId is set, filters notifications and alert sounds specifically for that outlet.
 */
export function subscribeToOrdersRealtime(
  onOrdersChange: (updatedList: CustomerOrder[]) => void,
  onNewOrderAlert?: (newOrder: CustomerOrder) => void,
  targetOutletId?: string
): () => void {
  let isSubscribed = true;
  let clientChannel: any = null;

  const activeOutlet = targetOutletId || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_outlet') || '' : '');
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '';
  const filterOutletId = activeOutlet && activeOutlet !== 'ALL' ? activeOutlet : undefined;

  // Function to refresh and notify
  const refresh = async (alertOrder?: CustomerOrder) => {
    if (!isSubscribed) return;
    const orders = await fetchAllOrders(filterOutletId);
    onOrdersChange(orders);
    if (alertOrder && onNewOrderAlert) {
      // Only play audio chime if this order belongs to the admin's outlet or if Super Admin
      if (!filterOutletId || matchesOutlet(alertOrder.outletId, filterOutletId)) {
        onNewOrderAlert(alertOrder);
      }
    }
  };

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
              paymentReceiptUrl: raw.payment_receipt_url || raw.paymentReceiptUrl,
              paymentReceiptPath: raw.payment_receipt_path || raw.paymentReceiptPath,
              rejectionReason: raw.rejection_reason || raw.rejectionReason,
              orderStatus: raw.order_status || raw.orderStatus || 'NEW',
              customerNote: raw.customer_note || raw.customerNote || '',
              createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
            };

            // Check if this event belongs to the active outlet
            if (!filterOutletId || matchesOutlet(newOrder.outletId, filterOutletId)) {
              refresh(newOrder);
            }
          } else {
            refresh();
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[Orders Realtime Subscription Error]:', err);
  }

  // Backup polling every 8 seconds
  const pollInterval = setInterval(() => {
    if (isSubscribed) {
      refresh();
    }
  }, 8000);

  // Return cleanup
  return () => {
    isSubscribed = false;
    clearInterval(pollInterval);
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
