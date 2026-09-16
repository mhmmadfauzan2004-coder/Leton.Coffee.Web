import { AdminAccount, AdminRole } from '../types';

export interface AdminCredential extends AdminAccount {
  password: string;
}

export const PRESET_ADMIN_ACCOUNTS: AdminCredential[] = [
  {
    username: 'admin',
    name: 'Super Admin Leton',
    role: 'super_admin',
    password: 'LetonAdmin2026!',
  },
  {
    username: 'superadmin',
    name: 'Super Admin Leton',
    role: 'super_admin',
    password: 'LetonAdmin2026!',
  },
  {
    username: 'admin_sudirman',
    name: 'Admin Sudirman (Chapter 5)',
    role: 'outlet_admin',
    outletId: 'sudirman',
    outletName: 'Leton Coffee — Jalan Jendral Sudirman',
    password: 'LetonSudirman2026!',
  },
  {
    username: 'sudirman',
    name: 'Admin Sudirman (Chapter 5)',
    role: 'outlet_admin',
    outletId: 'sudirman',
    outletName: 'Leton Coffee — Jalan Jendral Sudirman',
    password: 'LetonSudirman2026!',
  },
  {
    username: 'admin_kelakap',
    name: 'Admin Ratu Sima / Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'ratusima',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
    password: 'LetonKelakap2026!',
  },
  {
    username: 'admin_ratusima',
    name: 'Admin Ratu Sima / Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'ratusima',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
    password: 'LetonKelakap2026!',
  },
  {
    username: 'kelakap',
    name: 'Admin Ratu Sima / Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'ratusima',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
    password: 'LetonKelakap2026!',
  },
  {
    username: 'admin_letgo',
    name: 'Admin LetGo (Depan MPP)',
    role: 'outlet_admin',
    outletId: 'letgo-mpp',
    outletName: 'LetGo — depan MPP',
    password: 'LetonLetgo2026!',
  },
  {
    username: 'letgo',
    name: 'Admin LetGo (Depan MPP)',
    role: 'outlet_admin',
    outletId: 'letgo-mpp',
    outletName: 'LetGo — depan MPP',
    password: 'LetonLetgo2026!',
  },
];

/**
 * Check if an order belongs to a given target outlet ID.
 * Robust against variations like 'letgo' vs 'letgo-mpp', 'ratusima' vs 'kelakap', etc.
 */
export function matchesOutlet(orderOutletId?: string | null, targetOutletId?: string | null): boolean {
  if (!targetOutletId || targetOutletId === 'ALL') return true;
  if (!orderOutletId) return false;

  const o = orderOutletId.toLowerCase().trim();
  const t = targetOutletId.toLowerCase().trim();

  if (o === t) return true;

  // Sudirman check
  if (t === 'sudirman' && o.includes('sudirman')) return true;
  if (o === 'sudirman' && t.includes('sudirman')) return true;

  // Ratusima / Kelakap 7 check
  if (
    (t === 'ratusima' || t === 'kelakap' || t.includes('ratusima') || t.includes('kelakap')) &&
    (o.includes('ratusima') || o.includes('kelakap'))
  ) {
    return true;
  }

  // LetGo check
  if (
    (t === 'letgo' || t === 'letgo-mpp' || t.includes('letgo') || t.includes('mpp')) &&
    (o.includes('letgo') || o.includes('mpp'))
  ) {
    return true;
  }

  return o.includes(t) || t.includes(o);
}

/**
 * Find preset admin account by username
 */
export function findPresetAdmin(username: string): AdminCredential | undefined {
  const normalized = username.trim().toLowerCase();
  return PRESET_ADMIN_ACCOUNTS.find((acc) => acc.username.toLowerCase() === normalized);
}
