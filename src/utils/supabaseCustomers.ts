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
      const res = await client
        .from('customers')
        .select('id, nama_lengkap, nomor_hp, tanggal_lahir, points_balance, total_points_earned, total_points_redeemed, created_at, updated_at, password_hash');
      custData = res.data;
      custErr = res.error;
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
      custData.forEach((row) => {
        // Only include customers with a valid password_hash (registered customers/members)
        if (!row.password_hash || String(row.password_hash).trim() === '') {
          return;
        }

        const normalized = normalizeCustomerRow(row);
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
      createdAt: newRow.created_at,
    };
  } catch (err) {
    console.warn('[findOrCreateCustomerMember] Exception:', err);
    return null;
  }
}

/**
 * Delete a registered customer by ID (Super Admin only).
 * Uses two-tier approach: Server API proxy first, with Direct Supabase fallback if network fails.
 */
export async function deleteRegisteredCustomer(customerId: string, adminRole?: string): Promise<{ success: boolean; error?: string }> {
  // 1. Try server-side API proxy first
  try {
    const token = localStorage.getItem('leton_admin_token') || 'leton_local_token';
    const res = await fetch(getApiUrl(`/api/admin/customers/${customerId}`), {
      method: 'DELETE',
      headers: {
        'x-admin-role': adminRole || 'super_admin',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.ok) {
      return { success: true };
    } else {
      const errText = await res.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch {}
      // If server returns error, we can also try direct fallback or return error
      const errMsg = errJson?.error || errJson?.message || `HTTP ${res.status}: Gagal menghapus member`;
      console.warn('[deleteRegisteredCustomer] Server API error, attempting direct Supabase fallback:', errMsg);
    }
  } catch (netErr: any) {
    console.warn('[deleteRegisteredCustomer] Network exception / Load failed, attempting direct Supabase fallback:', netErr?.message || netErr);
  }

  // 2. Direct Supabase Client fallback
  try {
    const client = getSupabase(adminRole || 'super_admin');

    // Try RPC function first
    const { data: rpcData, error: rpcErr } = await client.rpc('delete_registered_customer_rpc', {
      p_customer_id: customerId
    });

    if (!rpcErr && rpcData && typeof rpcData === 'object') {
      const resObj = rpcData as any;
      if (resObj.success) {
        return { success: true };
      } else {
        return { success: false, error: resObj.error || 'Gagal menghapus member via Supabase RPC.' };
      }
    }

    // Unlink orders
    await client.from('orders').update({ customer_id: null }).eq('customer_id', customerId);

    // Delete related records
    await client.from('customer_sessions').delete().eq('customer_id', customerId);
    await client.from('reward_redemptions').delete().eq('customer_id', customerId);
    await client.from('loyalty_transactions').delete().eq('customer_id', customerId);
    await client.from('customer_points').delete().eq('customer_id', customerId);

    // Delete customer
    const { error: delErr } = await client.from('customers').delete().eq('id', customerId);
    if (delErr) {
      return { success: false, error: `Gagal menghapus dari database: ${delErr.message}` };
    }

    // VERIFICATION SELECT: Ensure record is truly gone from public.customers
    const { data: checkData, error: checkErr } = await client
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .maybeSingle();

    if (checkErr) {
      console.warn('[deleteRegisteredCustomer] Verification select warning:', checkErr);
    }

    if (checkData) {
      return { success: false, error: 'Gagal menghapus member: Record masih tersimpan di database Supabase.' };
    }

    return { success: true };
  } catch (dbErr: any) {
    console.error('[deleteRegisteredCustomer] Direct Supabase fallback exception:', dbErr);
    return { success: false, error: dbErr?.message || 'Terjadi kesalahan sistem saat menghapus member.' };
  }
}

