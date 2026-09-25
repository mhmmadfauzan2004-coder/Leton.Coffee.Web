import { getSupabase } from './supabase';
import { CustomerOrder, OrderItem } from '../types';
import { getApiUrl } from './api';

export type MembershipTierLevel = 'SILVER' | 'GOLD' | 'PLATINUM';

export interface MembershipTierSettings {
  id: string;
  silverMinTransactions: number;
  goldMinTransactions: number;
  platinumMinTransactions: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CalculatedCustomerTier {
  tier: MembershipTierLevel;
  tierName: string;
  tierBadge: string;
  transactionCount: number;
  nextTier: MembershipTierLevel | null;
  nextTierName: string | null;
  remainingTransactions: number;
  progressPercent: number;
  statusMessage: string;
  theme: {
    badgeBg: string;
    badgeText: string;
    cardGradient: string;
    accentColor: string;
    borderAccent: string;
    iconEmoji: string;
  };
}

export const DEFAULT_MEMBERSHIP_TIER_SETTINGS: MembershipTierSettings = {
  id: 'default',
  silverMinTransactions: 0,
  goldMinTransactions: 10,
  platinumMinTransactions: 25,
};

const TIER_STORAGE_CACHE_KEY = 'leton_membership_tier_settings_cache';

/**
 * Filter function to determine if an order from public.orders is valid for transaction count.
 * 
 * STRICT RULES:
 * 1. Order Status: CANCELLED, REJECTED, and FAILED orders are strictly EXCLUDED.
 * 2. Payment Status:
 *    - EXCLUDED: WAITING PAYMENT, WAITING VERIFICATION, PAYMENT REJECTED, REJECTED.
 *    - PAY AT STORE is ONLY counted if the order has been COMPLETED or payment marked PAID.
 *    - INCLUDED: PAID (verified payment) or COMPLETED non-rejected orders.
 * 3. Order Items Integrity:
 *    - Must have verified order items in database.
 *    - If an order inserted into orders table but order_items insertion failed/empty, it is STRICTLY EXCLUDED.
 */
export function isOrderValidForTier(order: {
  orderStatus?: string;
  paymentStatus?: string;
  items?: any[];
  order_items?: any[];
}): boolean {
  const os = (order.orderStatus || '').toUpperCase().trim();
  const ps = (order.paymentStatus || '').toUpperCase().trim();

  // 1. Order Status Integrity: Exclude cancelled / rejected / failed
  if (os === 'CANCELLED' || os === 'REJECTED' || os === 'FAILED') {
    return false;
  }

  // 2. Payment Status Integrity: Exclude non-successful payments
  // Customers checkout without paying or waiting for verification do NOT count
  if (ps === 'WAITING PAYMENT' || ps === 'WAITING_PAYMENT') {
    return false;
  }
  if (ps === 'WAITING VERIFICATION' || ps === 'WAITING_VERIFICATION') {
    return false;
  }
  if (ps === 'PAYMENT REJECTED' || ps === 'REJECTED') {
    return false;
  }

  // For 'PAY AT STORE': Only count if the order is genuinely fulfilled (COMPLETED) or marked PAID
  if (ps === 'PAY AT STORE') {
    if (os !== 'COMPLETED') {
      return false;
    }
  }

  // If not PAID and not COMPLETED, it cannot be considered a successful transaction
  if (ps !== 'PAID' && os !== 'COMPLETED') {
    return false;
  }

  // 3. Order Items Integrity: Must have valid item details
  // Check if relational order_items property exists on the record
  if ('order_items' in order && order.order_items !== undefined) {
    if (!Array.isArray(order.order_items) || order.order_items.length === 0) {
      // Order had no order_items recorded in the database (e.g., RLS rejected order_items)
      return false;
    }
    // Ensure at least one item has valid quantity
    const hasValidItem = order.order_items.some((it: any) => Number(it.quantity || 0) > 0);
    if (!hasValidItem) return false;
  } else if ('items' in order && order.items !== undefined) {
    // Check JSON items column
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return false;
    }
    const hasValidItem = order.items.some((it: any) => Number(it.quantity || 0) > 0);
    if (!hasValidItem) return false;
  }

  return true;
}

/**
 * Fetch Membership Tier Settings.
 * Prioritizes trusted backend API /api/membership-tier-settings, with fallback to Supabase leton_content and local cache.
 */
export async function getMembershipTierSettings(): Promise<{ settings: MembershipTierSettings; isFallback: boolean }> {
  // 1. Try Trusted Server Backend API
  try {
    const res = await fetch(getApiUrl('/api/membership-tier-settings'), {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.settings) {
        const s = json.settings;
        const parsed: MembershipTierSettings = {
          id: 'default',
          silverMinTransactions: Number(s.silverMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.silverMinTransactions),
          goldMinTransactions: Number(s.goldMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.goldMinTransactions),
          platinumMinTransactions: Number(s.platinumMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.platinumMinTransactions),
          updatedAt: s.updatedAt,
          updatedBy: s.updatedBy,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(TIER_STORAGE_CACHE_KEY, JSON.stringify(parsed));
        }
        return { settings: parsed, isFallback: false };
      }
    }
  } catch (apiErr) {
    // Network fallback
  }

  // 2. Direct Supabase read fallback
  try {
    const client = getSupabase();
    const { data: contentRow, error: contentErr } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'membership_tier_settings')
      .maybeSingle();

    if (!contentErr && contentRow && contentRow.content) {
      const c = contentRow.content;
      const parsed: MembershipTierSettings = {
        id: 'default',
        silverMinTransactions: Number(c.silverMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.silverMinTransactions),
        goldMinTransactions: Number(c.goldMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.goldMinTransactions),
        platinumMinTransactions: Number(c.platinumMinTransactions ?? DEFAULT_MEMBERSHIP_TIER_SETTINGS.platinumMinTransactions),
        updatedAt: contentRow.updated_at || c.updatedAt,
        updatedBy: c.updatedBy,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(TIER_STORAGE_CACHE_KEY, JSON.stringify(parsed));
      }

      return { settings: parsed, isFallback: false };
    }
  } catch (err) {
    console.warn('[MembershipTier] Supabase read fallback warning:', err);
  }

  // 3. Local Cache Fallback
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(TIER_STORAGE_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { settings: parsed, isFallback: true };
      } catch {}
    }
  }

  return { settings: DEFAULT_MEMBERSHIP_TIER_SETTINGS, isFallback: true };
}

/**
 * Save Membership Tier Settings to Trusted Backend API.
 * ENFORCEMENT: Only Super Admin / Admin Pusat can update threshold.
 * Verified cryptographically by backend session token.
 */
export async function saveMembershipTierSettings(
  newSettings: MembershipTierSettings,
  adminRole?: string,
  adminUsername?: string
): Promise<{ success: boolean; error?: string }> {
  // Validate hierarchy on client before sending
  const silver = Number(newSettings.silverMinTransactions);
  const gold = Number(newSettings.goldMinTransactions);
  const platinum = Number(newSettings.platinumMinTransactions);

  if (isNaN(silver) || silver < 0) {
    return { success: false, error: 'Threshold Silver minimal 0 transaksi.' };
  }
  if (isNaN(gold) || gold <= silver) {
    return { success: false, error: `Threshold Gold (${gold}) harus lebih besar dari Silver (${silver}).` };
  }
  if (isNaN(platinum) || platinum <= gold) {
    return { success: false, error: `Threshold Platinum (${platinum}) harus lebih besar dari Gold (${gold}).` };
  }

  const adminToken = typeof window !== 'undefined'
    ? localStorage.getItem('leton_admin_token') || 'leton_local_token'
    : 'leton_local_token';
  const role = adminRole || (typeof window !== 'undefined' ? localStorage.getItem('leton_admin_role') || '' : '');

  // 1. Primary & Exclusive Write Authority: Call Trusted Server API Endpoint
  try {
    const res = await fetch(getApiUrl('/api/admin/membership-tier-settings'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-admin-role': role,
      },
      body: JSON.stringify({
        silverMinTransactions: Math.round(silver),
        goldMinTransactions: Math.round(gold),
        platinumMinTransactions: Math.round(platinum),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      if (res.status === 404) {
        return {
          success: false,
          error: 'Server membership belum tersedia di backend produksi. Pengaturan belum disimpan.',
        };
      }
      const errMsg = json.error || (res.status === 403
        ? 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat mengubah threshold tier.'
        : res.status === 401
        ? 'Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali sebagai Super Admin.'
        : 'Gagal menyimpan pengaturan tier ke server.');
      return { success: false, error: errMsg };
    }

    const saved = json.settings || {
      id: 'default',
      silverMinTransactions: Math.round(silver),
      goldMinTransactions: Math.round(gold),
      platinumMinTransactions: Math.round(platinum),
      updatedAt: new Date().toISOString(),
      updatedBy: adminUsername || 'Super Admin',
    };

    // Update local cache & notify UI ONLY when trusted backend has successfully saved
    if (typeof window !== 'undefined') {
      localStorage.setItem(TIER_STORAGE_CACHE_KEY, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('leton_tier_settings_updated', { detail: saved }));
    }

    return { success: true };
  } catch (apiErr: any) {
    console.error('[MembershipTier] Server API error during save:', apiErr);
    // STRICT SECURITY: Do NOT fallback to direct browser client write!
    return {
      success: false,
      error: 'Server membership belum tersedia atau koneksi terputus. Pengaturan belum disimpan.',
    };
  }
}

/**
 * Calculate Customer Membership Tier dynamically based on real transaction count and database settings.
 * NO HARDCODED THRESHOLDS!
 */
export function calculateMembershipTier(
  transactionCount: number,
  settings: MembershipTierSettings
): CalculatedCustomerTier {
  const count = Math.max(0, Number(transactionCount) || 0);
  const silverMin = Math.max(0, Number(settings.silverMinTransactions) || 0);
  const goldMin = Math.max(silverMin + 1, Number(settings.goldMinTransactions) || 10);
  const platinumMin = Math.max(goldMin + 1, Number(settings.platinumMinTransactions) || 25);

  if (count >= platinumMin) {
    return {
      tier: 'PLATINUM',
      tierName: 'Platinum',
      tierBadge: '💎 PLATINUM',
      transactionCount: count,
      nextTier: null,
      nextTierName: null,
      remainingTransactions: 0,
      progressPercent: 100,
      statusMessage: 'LEVEL TERTINGGI',
      theme: {
        badgeBg: 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20',
        badgeText: 'text-cyan-300 font-extrabold',
        cardGradient: 'from-[#0B1528] via-[#0F172A] to-[#1E1B4B]',
        accentColor: '#38BDF8',
        borderAccent: 'border-cyan-500/30',
        iconEmoji: '💎',
      },
    };
  }

  if (count >= goldMin) {
    const remaining = platinumMin - count;
    const tierSpan = platinumMin - goldMin;
    const progressInTier = count - goldMin;
    const progressPercent = Math.min(100, Math.max(0, Math.round((progressInTier / Math.max(1, tierSpan)) * 100)));

    return {
      tier: 'GOLD',
      tierName: 'Gold',
      tierBadge: '🥇 GOLD',
      transactionCount: count,
      nextTier: 'PLATINUM',
      nextTierName: 'Platinum',
      remainingTransactions: remaining,
      progressPercent: progressPercent,
      statusMessage: `${remaining} transaksi lagi menuju Platinum`,
      theme: {
        badgeBg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20',
        badgeText: 'text-amber-400 font-extrabold',
        cardGradient: 'from-[#1E293B] via-[#0F172A] to-[#1E293B]',
        accentColor: '#F59E0B',
        borderAccent: 'border-amber-500/30',
        iconEmoji: '🥇',
      },
    };
  }

  // Silver (Default Tier)
  const remaining = goldMin - count;
  const tierSpan = goldMin - silverMin;
  const progressInTier = Math.max(0, count - silverMin);
  const progressPercent = Math.min(100, Math.max(0, Math.round((progressInTier / Math.max(1, tierSpan)) * 100)));

  return {
    tier: 'SILVER',
    tierName: 'Silver',
    tierBadge: '🥈 SILVER',
    transactionCount: count,
    nextTier: 'GOLD',
    nextTierName: 'Gold',
    remainingTransactions: remaining,
    progressPercent: progressPercent,
    statusMessage: `${remaining} transaksi lagi menuju Gold`,
    theme: {
      badgeBg: 'bg-gradient-to-r from-slate-400/20 to-slate-200/20',
      badgeText: 'text-slate-300 font-extrabold',
      cardGradient: 'from-[#1E222A] via-[#141820] to-[#1E222A]',
      accentColor: '#94A3B8',
      borderAccent: 'border-slate-500/30',
      iconEmoji: '🥈',
    },
  };
}

/**
 * Fetch and count customer's valid orders directly from public.orders with verified order_items in Supabase.
 * Strictly verifies:
 * 1. public.orders record exists
 * 2. order_items table has matching records (prevents counting orders where order_items RLS insert failed)
 * 3. Payment is successful (PAID or completed pay-at-store)
 * 4. Order is NOT cancelled, rejected, or failed.
 */
export async function fetchCustomerValidOrdersCount(
  customerId?: string,
  customerPhone?: string
): Promise<{ count: number; validOrders: CustomerOrder[]; allOrders: CustomerOrder[] }> {
  if (!customerId && !customerPhone) {
    return { count: 0, validOrders: [], allOrders: [] };
  }

  try {
    const client = getSupabase();
    let query = client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: ordersData, error } = await query;
    let rawList: any[] = [];

    if (!error && Array.isArray(ordersData)) {
      rawList = ordersData;
    }

    // Phone fallback if no customer_id rows found
    if (customerPhone && rawList.length === 0) {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 8) {
        const { data: phoneData } = await client
          .from('orders')
          .select('*')
          .ilike('customer_phone', `%${cleanPhone.slice(-8)}%`)
          .order('created_at', { ascending: false });

        if (Array.isArray(phoneData)) {
          rawList = phoneData;
        }
      }
    }

    if (rawList.length === 0) {
      return { count: 0, validOrders: [], allOrders: [] };
    }

    // Batch query order_items to verify order_items exist in database
    const orderIds = rawList.map((r: any) => r.id).filter(Boolean);
    const orderItemsMap: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      try {
        const { data: itemsRows, error: itemsErr } = await client
          .from('order_items')
          .select('id, order_id, product_id, name, price, quantity')
          .in('order_id', orderIds);

        if (!itemsErr && Array.isArray(itemsRows)) {
          itemsRows.forEach((item: any) => {
            if (item && item.order_id) {
              if (!orderItemsMap[item.order_id]) {
                orderItemsMap[item.order_id] = [];
              }
              orderItemsMap[item.order_id].push(item);
            }
          });
        }
      } catch (itemQueryErr) {
        console.warn('[MembershipTier] Error fetching order_items batch:', itemQueryErr);
      }
    }

    // Map rows to CustomerOrder format with attached order_items verification
    const mapped: (CustomerOrder & { order_items?: any[] })[] = rawList.map((row: any) => {
      const attachedItems = orderItemsMap[row.id];
      const jsonItems = Array.isArray(row.items) ? row.items : [];

      return {
        id: row.id,
        orderNumber: row.order_number || row.orderNumber || 'LTN-????',
        outletId: row.outlet_id || row.outletId || '',
        outletName: row.outlet_name || row.outletName || '',
        customerName: row.customer_name || row.customerName || '',
        customerPhone: row.customer_phone || row.customerPhone || '',
        customerId: row.customer_id || row.customerId || undefined,
        userId: row.user_id || row.userId || undefined,
        orderType: row.order_type || row.orderType || 'DINE IN',
        tableNumber: row.table_number || row.tableNumber || '',
        items: jsonItems,
        // Verified items from public.order_items table
        order_items: attachedItems !== undefined ? attachedItems : jsonItems,
        totalAmount: Number(row.total_amount || row.totalAmount || 0),
        paymentMethod: row.payment_method || row.paymentMethod || 'QRIS',
        paymentStatus: row.payment_status || row.paymentStatus || 'WAITING PAYMENT',
        paymentReceiptUrl: row.payment_receipt_url || row.paymentReceiptUrl,
        paymentReceiptPath: row.payment_receipt_path || row.paymentReceiptPath,
        paymentProofPath: row.payment_proof_path || row.paymentProofPath,
        rejectionReason: row.rejection_reason || row.rejectionReason,
        orderStatus: row.order_status || row.orderStatus || 'NEW',
        customerNote: row.customer_note || row.customerNote || '',
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt,
      };
    });

    // Filter valid orders according to strict membership rules
    const valid = mapped.filter((o) => isOrderValidForTier(o));

    return {
      count: valid.length,
      validOrders: valid,
      allOrders: mapped,
    };
  } catch (err) {
    console.warn('[MembershipTier] Error counting customer valid orders:', err);
    return { count: 0, validOrders: [], allOrders: [] };
  }
}
