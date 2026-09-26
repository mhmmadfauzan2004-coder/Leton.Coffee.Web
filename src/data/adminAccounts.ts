import { AdminAccount } from '../types';

export const PRESET_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    username: 'admin',
    name: 'Super Admin Leton',
    role: 'super_admin',
  },
  {
    username: 'sudirman',
    name: 'Admin Sudirman (Chapter 5)',
    role: 'outlet_admin',
    outletId: 'sudirman',
    outletName: 'Leton Coffee — Jalan Jendral Sudirman',
  },
  {
    username: 'kelakap',
    name: 'Admin Kelakap 7 (Chapter 6)',
    role: 'outlet_admin',
    outletId: 'kelakap_7',
    outletName: 'Leton Coffee — Ratusima / Kelakap 7',
  },
];

/**
 * Check if an order belongs to a given target outlet ID.
 * Robust against variations like 'kelakap_7' vs 'kelakap' vs 'ratusima', etc.
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

  return o.includes(t) || t.includes(o);
}

/**
 * Find preset admin account by username for UI display metadata
 */
export function findPresetAdmin(username: string): AdminAccount | undefined {
  const normalized = username.trim().toLowerCase();
  return PRESET_ADMIN_ACCOUNTS.find((acc) => acc.username.toLowerCase() === normalized);
}
