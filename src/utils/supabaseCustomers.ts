import { getSupabase } from './supabase';
import { getApiUrl } from './api';

export interface RegisteredCustomer {
  id: string;
  namaLengkap: string;
  nomorHp: string;
  tanggalLahir?: string;
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  status: 'ACTIVE' | 'INACTIVE';
  inactiveAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Normalize raw Supabase row into RegisteredCustomer object.
 */
function normalizeCustomerRow(row: any): RegisteredCustomer {
  return {
    id: String(row.id || ''),
    namaLengkap: String(
      row.nama_lengkap ||
        row.namaLengkap ||
        row.nama ||
        row.full_name ||
        'Pelanggan Leton'
    ),
    nomorHp: String(
      row.nomor_hp ||
        row.nomorHp ||
        row.phone ||
        row.handphone ||
        '-'
    ),
    tanggalLahir: row.tanggal_lahir || row.tanggalLahir || '',
    pointsBalance: Number(row.points_balance || row.pointsBalance || 0),
    totalPointsEarned: Number(row.total_points_earned || row.totalPointsEarned || 0),
    totalPointsRedeemed: Number(row.total_points_redeemed || row.totalPointsRedeemed || 0),
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    inactiveAt: row.inactive_at || row.inactiveAt || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/**
 * Fetch all registered customers directly from Supabase.
 * Queries Supabase production database via server-side API proxy / direct Supabase client.
 * Strictly no localStorage used as source of truth.
 */
export async function fetchRegisteredCustomers(adminRole?: string): Promise<RegisteredCustomer[]> {
  // 1. Primary: Server-Side API Proxy (queries Supabase production database with admin role)
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl('/api/admin/customers'), {
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.customers)) {
        return json.customers.map(normalizeCustomerRow);
      } else if (json && json.error) {
        throw new Error(json.error);
      }
    } else {
      const errText = await res.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch {}
      throw new Error(errJson?.error || errJson?.message || `HTTP ${res.status}: Gagal memuat customer`);
    }
  } catch (err: any) {
    console.warn('[API /api/admin/customers exception]:', err);
    // Keep trying direct query fallback but warn
  }

  // 2. Direct Supabase Query fallback
  try {
    const client = getSupabase(adminRole || 'super_admin');

    const customerMap = new Map<string, RegisteredCustomer>();

    let custData: any[] | null = null;
    let custErr: any = null;

    // Direct select first
    try {
      const [res, loyRes] = await Promise.all([
        client.from('customers').select('id, nama_lengkap, nomor_hp, tanggal_lahir, points_balance, total_points_earned, total_points_redeemed, created_at, updated_at, password_hash'),
        client.from('leton_content').select('*').eq('id', 'loyalty_registry').maybeSingle(),
      ]);
      custData = res.data;
      custErr = res.error;
      var regBalances = loyRes?.data?.content?.balances || {};
    } catch (e: any) {
      custErr = e;
    }

    // Try RPC fallback if direct select is empty or fails (due to RLS USING(false))
    if (custErr || !custData || custData.length === 0) {
      console.warn('[supabaseCustomers] Direct query empty or failed. Trying security-definer RPC...');
      try {
        const { data: rpcData, error: rpcErr } = await client.rpc('get_registered_customers');
        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          custData = rpcData;
          custErr = null;
        } else if (rpcErr) {
          console.warn('[supabaseCustomers RPC error]:', rpcErr.message);
        }
      } catch (rpcEx: any) {
        console.warn('[supabaseCustomers RPC exception]:', rpcEx.message || rpcEx);
      }
    }

    if (custErr) {
      console.error('[Supabase direct customers fetch error]:', custErr);
      throw new Error(custErr.message || custErr);
    }

    if (Array.isArray(custData)) {
      const reg = typeof regBalances !== 'undefined' ? regBalances : {};
      custData.forEach((row) => {
        // Only include customers with a valid password_hash (registered customers/members)
        if (!row.password_hash || String(row.password_hash).trim() === '') {
          return;
        }

        const normalized = normalizeCustomerRow(row);
        if (row.id && reg[row.id]) {
          normalized.pointsBalance = Number(reg[row.id].pointsBalance || 0);
          normalized.totalPointsEarned = Number(reg[row.id].totalPointsEarned || 0);
          normalized.totalPointsRedeemed = Number(reg[row.id].totalPointsRedeemed || 0);
        }
        const cleanPhone = normalized.nomorHp.replace(/[^0-9]/g, '');
        const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : (normalized.id || normalized.namaLengkap.toLowerCase());
        if (key) customerMap.set(key, normalized);
      });
    }

    const merged = Array.from(customerMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (merged.length > 0) {
      return merged;
    }
  } catch (err: any) {
    console.error('[Supabase direct fetch exception]:', err);
    throw err;
  }

  return [];
}

/**
 * Realtime Postgres changes subscription on both `public.customers` and `public.orders` tables.
 * When a new customer registers or updates, immediately dispatches the updated customer list.
 */
export function subscribeToCustomersRealtime(
  onUpdate: (customers: RegisteredCustomer[]) => void,
  adminRole?: string
): () => void {
  const client = getSupabase(adminRole || 'super_admin');
  const channelName = `customers_realtime_${Math.random().toString(36).substring(2, 9)}`;

  const refreshList = async () => {
    try {
      const freshList = await fetchRegisteredCustomers(adminRole || 'super_admin');
      onUpdate(freshList);
    } catch (err) {
      console.warn('[Realtime Customer Refresh warning]:', err);
    }
  };

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customers',
      },
      refreshList
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      refreshList
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // ignore
    }
  };
}

/**
 * Finds an existing registered customer by phone or name, or creates a new customer row in Supabase `customers` table.
 * Used when a customer chooses "Jadi Member" during checkout.
 * Ensures no duplicate customers are created and new members immediately show up in Admin Pusat -> Data Customer.
 */
export async function findOrCreateCustomerMember(
  namaLengkap: string,
  nomorHp: string
): Promise<RegisteredCustomer | null> {
  const cleanNama = (namaLengkap || '').trim();
  const cleanPhone = (nomorHp || '').replace(/[^0-9]/g, '');
  const rawPhone = (nomorHp || '').trim();
  const client = getSupabase();

  try {
    // 1. Check if customer with this phone number already exists
    if (cleanPhone && cleanPhone.length >= 8) {
      const { data: phoneMatches } = await client
        .from('customers')
        .select('*');

      if (Array.isArray(phoneMatches) && phoneMatches.length > 0) {
        const foundByPhone = phoneMatches.find((c: any) => {
          const cPhone = String(c.nomor_hp || c.nomorHp || '').replace(/[^0-9]/g, '');
          return cPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone));
        });
        if (foundByPhone) {
          return normalizeCustomerRow(foundByPhone);
        }
      }
    }

    // 2. Check if customer with exact matching name exists
    if (cleanNama) {
      const { data: nameMatches } = await client
        .from('customers')
        .select('*');

      if (Array.isArray(nameMatches) && nameMatches.length > 0) {
        const foundByName = nameMatches.find((c: any) => {
          const cName = String(c.nama_lengkap || c.namaLengkap || '').toLowerCase().trim();
          return cName === cleanNama.toLowerCase();
        });
        if (foundByName) {
          return normalizeCustomerRow(foundByName);
        }
      }
    }

    // 3. Create a new member in the existing Supabase `customers` table
    const newId = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newRow = {
      id: newId,
      nama_lengkap: cleanNama,
      nomor_hp: cleanPhone || rawPhone || '-',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await client
      .from('customers')
      .insert(newRow)
      .select('*')
      .maybeSingle();

    if (!error && inserted) {
      return normalizeCustomerRow(inserted);
    }

    // Fallback object if insert succeeds without returned payload
    return {
      id: newId,
      namaLengkap: cleanNama,
      nomorHp: cleanPhone || rawPhone || '-',
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
      status: 'ACTIVE',
      createdAt: newRow.created_at,
    };
  } catch (err) {
    console.warn('[findOrCreateCustomerMember] Exception:', err);
    return null;
  }
}

/**
 * Delete a registered customer by ID (Super Admin only).
 * Sends DELETE request directly to Server API Proxy which executes delete_registered_customer_rpc via backend service_role.
 */
export async function deleteRegisteredCustomer(customerId: string, adminRole?: string): Promise<{ success: boolean; error?: string }> {
  const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
  const endpoint = getApiUrl(`/api/admin/customers/${encodeURIComponent(customerId)}`);

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });

    const errText = await res.text();
    let resJson: any = null;
    try { resJson = JSON.parse(errText); } catch {}

    if (res.ok && resJson?.success !== false) {
      return { success: true };
    }

    const serverMsg = resJson?.error || resJson?.message || errText;
    const realError = serverMsg
      ? `HTTP ${res.status}: ${serverMsg}`
      : `HTTP ${res.status} (${res.statusText}): Gagal menghapus member dari database backend.`;

    console.warn('[deleteRegisteredCustomer] Backend API returned error:', realError);
    return { success: false, error: realError };
  } catch (netErr: any) {
    const rawMsg = netErr?.message || String(netErr);
    let connError = `Gagal terhubung ke backend API (${endpoint}): ${rawMsg}`;
    if (rawMsg === 'Load failed' || rawMsg === 'Failed to fetch' || netErr?.name === 'TypeError') {
      connError = `Gagal terhubung ke backend API Cloud Run (${endpoint}). Periksa koneksi internet atau pembatasan CORS.`;
    }
    console.warn('[deleteRegisteredCustomer] Network exception:', netErr);
    return { success: false, error: connError };
  }
}

/**
 * Fetch Member Inactivity Settings & Statistics (Super Admin)
 */
export async function fetchMemberInactivitySettings(adminRole?: string): Promise<any> {
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl('/api/admin/member-inactivity/settings'), {
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[fetchMemberInactivitySettings] Exception:', err);
  }
  return {
    success: false,
    settings: {
      inactivityPeriodDays: 60,
      gracePeriodDays: 7,
      autoCleanupEnabled: true,
    },
  };
}

/**
 * Save Member Inactivity Settings (Super Admin)
 */
export async function saveMemberInactivitySettings(
  settings: {
    inactivityPeriodDays: number;
    gracePeriodDays: number;
    autoCleanupEnabled: boolean;
  },
  adminRole?: string
): Promise<{ success: boolean; settings?: any; error?: string }> {
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl('/api/admin/member-inactivity/settings'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const json = await res.json();
      return json;
    } else {
      const json = await res.json().catch(() => ({}));
      return { success: false, error: json.error || 'Gagal menyimpan pengaturan.' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke server.' };
  }
}

/**
 * Trigger Member Inactivity & Cleanup Worker Manually (Super Admin)
 */
export async function triggerMemberInactivityCleanup(adminRole?: string): Promise<any> {
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl('/api/admin/member-inactivity/cleanup'), {
      method: 'POST',
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (res.ok) {
      return await res.json();
    } else {
      const json = await res.json().catch(() => ({}));
      return { success: false, error: json.error || 'Gagal menjalankan cleanup member.' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Fetch Candidates for Inactivity & Deletion (Super Admin)
 */
export async function fetchMemberInactivityCandidates(adminRole?: string): Promise<any> {
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl('/api/admin/member-inactivity/candidates'), {
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[fetchMemberInactivityCandidates] Exception:', err);
  }
  return {
    success: false,
    inactiveCandidates: [],
    deletionCandidates: [],
  };
}

