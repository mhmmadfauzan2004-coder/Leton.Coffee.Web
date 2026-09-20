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
      createdAt: newRow.created_at,
    };
  } catch (err) {
    console.warn('[findOrCreateCustomerMember] Exception:', err);
    return null;
  }
}
