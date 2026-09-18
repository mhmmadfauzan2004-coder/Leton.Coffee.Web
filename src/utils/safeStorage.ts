/**
 * Safe LocalStorage Wrapper for Leton Coffee
 * Protects against QuotaExceededError and browser storage limits (usually ~5MB).
 * Ensures smooth operation and delegates high-capacity storage to IndexedDB.
 */

const REDUNDANT_CACHE_KEYS = [
  'leton_cms_content_v1',       // Duplicate of leton_global_data
  'leton_admin_orders_cache',   // Order list cache (refetched from Supabase/IndexedDB)
  'leton_baristas_data',        // Granular key duplicated from global data
  'leton_branches_data',        // Granular key duplicated from global data
  'leton_menu_items',           // Granular key duplicated from global data
  'leton_menu_categories',      // Granular key duplicated from global data
  'leton_mobile_service',       // Granular key duplicated from global data
  'leton_site_settings',        // Granular key duplicated from global data
  'leton_about_content',        // Granular key duplicated from global data
  'leton_contact_settings',     // Granular key duplicated from global data
  'leton_baristas_content',     // Granular key duplicated from global data
];

/**
 * Prune non-critical cache keys to immediately free up space in localStorage.
 */
export function pruneStorageCache(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of REDUNDANT_CACHE_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  } catch {}
}

/**
 * Strips bulky base64 data URIs (>1KB) from object trees before putting them into localStorage.
 * Full images remain safely persisted in IndexedDB and Supabase.
 */
export function stripHeavyBase64Images<T>(val: T): T {
  if (!val || typeof val !== 'object') return val;

  if (Array.isArray(val)) {
    return val.map((item) => stripHeavyBase64Images(item)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === 'string' && v.startsWith('data:image') && v.length > 1024) {
      // Omit bulky base64 from localStorage payload
      result[k] = '';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = stripHeavyBase64Images(v);
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

/**
 * Safely set an item in localStorage with quota error protection and auto-pruning.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[SafeStorage] Quota exceeded when setting "${key}". Pruning caches and retrying...`);
      pruneStorageCache();
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[SafeStorage] Could not store "${key}" after pruning. Size: ${value.length} chars.`);
        return false;
      }
    }

    console.warn(`[SafeStorage] Error setting "${key}":`, err);
    return false;
  }
}

/**
 * Safely get an item from localStorage.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely remove an item from localStorage.
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

// Automatically prune redundant bulky caches once on script execution
if (typeof window !== 'undefined') {
  try {
    pruneStorageCache();
  } catch {}
}
