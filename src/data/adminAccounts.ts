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
    name: 'Admin Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'kelakap_7',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
    password: 'LetonKelakap2026!',
  },
  {
    username: 'admin_ratusima',
    name: 'Admin Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'kelakap_7',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
    password: 'LetonKelakap2026!',
  },
  {
    username: 'kelakap',
    name: 'Admin Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'kelakap_7',
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
 * Robust against variations like 'letgo' vs 'letgo-mpp', 'kelakap_7' vs 'kelakap' vs 'ratusima', etc.
 */
export function matchesOutlet(orderOutletId?: string | null, targetOutletId?: string | null): boolean {
  if (!targetOutletId || targetOutletId === 'ALL' || targetOutletId === 'all') return true;
  if (!orderOutletId) return false;

  const o = orderOutletId.toLowerCase().trim();
  const t = targetOutletId.toLowerCase().trim();

  if (o === t) return true;

  // Sudirman / Chapter 5 check
  const isSudirmanO = o === 'sudirman' || o.includes('sudirman') || o === 'chapter-5' || o === 'chapter_5' || o.includes('chapter 5');
  const isSudirmanT = t === 'sudirman' || t.includes('sudirman') || t === 'chapter-5' || t === 'chapter_5' || t.includes('chapter 5');
  if (isSudirmanO && isSudirmanT) return true;

  // Ratusima / Kelakap 7 / Chapter 6 check
  const isKelakapO = o === 'kelakap_7' || o === 'kelakap' || o === 'ratusima' || o.includes('kelakap') || o.includes('ratusima') || o === 'chapter-6' || o === 'chapter_6' || o.includes('chapter 6');
  const isKelakapT = t === 'kelakap_7' || t === 'kelakap' || t === 'ratusima' || t.includes('kelakap') || t.includes('ratusima') || t === 'chapter-6' || t === 'chapter_6' || t.includes('chapter 6');
  if (isKelakapO && isKelakapT) return true;

  // LetGo check
  const isLetgoO = o === 'letgo' || o === 'letgo-mpp' || o.includes('letgo') || o.includes('mpp');
  const isLetgoT = t === 'letgo' || t === 'letgo-mpp' || t.includes('letgo') || t.includes('mpp');
  if (isLetgoO && isLetgoT) return true;

  return o.includes(t) || t.includes(o);
}

/**
 * Find preset admin account by username
 */
export function findPresetAdmin(username: string): AdminCredential | undefined {
  const normalized = username.trim().toLowerCase();
  return PRESET_ADMIN_ACCOUNTS.find((acc) => acc.username.toLowerCase() === normalized);
}
