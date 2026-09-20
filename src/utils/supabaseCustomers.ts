import { getSupabase } from './supabase';
import { getApiUrl } from './api';

export interface RegisteredCustomer {
  id: string;
  namaLengkap: string;
  nomorHp: string;
  tanggalLahir?: string;
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
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/**
 * Fetch all registered customers directly from Supabase `customers` table.
 * Strictly no localStorage used.
 */
export async function fetchRegisteredCustomers(adminRole?: string): Promise<RegisteredCustomer[]> {
  try {
    // 1. Direct Supabase Query
    const client = getSupabase(adminRole);
    const { data, error } = await client
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, tanggal_lahir, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(normalizeCustomerRow);
    }

    if (error) {
      console.warn('[Supabase fetchRegisteredCustomers notice]:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase fetchRegisteredCustomers exception]:', err);
  }

  // 2. Direct Server-Side API Proxy Fallback (queries Supabase with service/admin context)
  try {
    const res = await fetch(getApiUrl('/api/admin/customers'), {
      headers: {
        'x-admin-role': adminRole || 'super_admin',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.customers)) {
        return json.customers.map(normalizeCustomerRow);
      }
    }
  } catch (err) {
    console.warn('[API /api/admin/customers fallback exception]:', err);
  }

  return [];
}

/**
 * Realtime Postgres changes subscription on the `public.customers` table.
 * When a new customer registers or updates, immediately dispatches the updated customer list.
 */
export function subscribeToCustomersRealtime(
  onUpdate: (customers: RegisteredCustomer[]) => void,
  adminRole?: string
): () => void {
  const client = getSupabase(adminRole);
  const channelName = `customers_realtime_${Math.random().toString(36).substring(2, 9)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customers',
      },
      async () => {
        try {
          const freshList = await fetchRegisteredCustomers(adminRole);
          onUpdate(freshList);
        } catch (err) {
          console.warn('[Realtime Customer Refresh warning]:', err);
        }
      }
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
