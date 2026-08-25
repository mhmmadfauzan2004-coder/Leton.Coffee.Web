import { LetonData } from '../types';
import { initialLetonData } from '../data/initialData';

export const LETON_STORAGE_KEY = 'leton_cms_content_v1';
export const LETON_BACKUP_KEY = 'leton_cached_content';
export const LETON_LAST_SYNC_KEY = 'leton_cms_last_sync';

/**
 * Deep merge loaded data from localStorage with initial default data
 * to ensure all fields, arrays, and properties exist safely.
 */
export function sanitizeLoadedData(raw: any): LetonData {
  if (!raw || typeof raw !== 'object') {
    return initialLetonData;
  }

  return {
    siteSettings: {
      ...initialLetonData.siteSettings,
      ...(raw.siteSettings || {}),
    },
    branches:
      Array.isArray(raw.branches) && raw.branches.length > 0
        ? raw.branches
        : initialLetonData.branches,
    mobileService: {
      ...initialLetonData.mobileService,
      ...(raw.mobileService || {}),
    },
    menuCategories:
      Array.isArray(raw.menuCategories) && raw.menuCategories.length > 0
        ? raw.menuCategories
        : initialLetonData.menuCategories,
    menuItems:
      Array.isArray(raw.menuItems) && raw.menuItems.length > 0
        ? raw.menuItems
        : initialLetonData.menuItems,
    baristas:
      Array.isArray(raw.baristas) && raw.baristas.length > 0
        ? raw.baristas
        : initialLetonData.baristas,
    baristasContent: {
      ...initialLetonData.baristasContent,
      ...(raw.baristasContent || {}),
    },
    aboutContent: {
      ...initialLetonData.aboutContent,
      ...(raw.aboutContent || {}),
    },
    contactSettings: {
      ...initialLetonData.contactSettings,
      ...(raw.contactSettings || {}),
    },
  };
}

/**
 * Retrieve saved CMS content from browser localStorage.
 * Defaults to `initialLetonData` ONLY if localStorage is empty or corrupted.
 */
export function loadStoredContent(): LetonData {
  if (typeof window === 'undefined') {
    return initialLetonData;
  }

  try {
    // 1. Check primary storage key
    const primary = localStorage.getItem(LETON_STORAGE_KEY);
    if (primary) {
      const parsed = JSON.parse(primary);
      return sanitizeLoadedData(parsed);
    }

    // 2. Check legacy / backup key
    const backup = localStorage.getItem(LETON_BACKUP_KEY);
    if (backup) {
      const parsed = JSON.parse(backup);
      const sanitized = sanitizeLoadedData(parsed);
      // Migrate to primary key
      saveStoredContent(sanitized);
      return sanitized;
    }
  } catch (err) {
    console.warn('[LocalStorage] Error reading stored Leton content:', err);
  }

  // Fallback to default initial data
  return initialLetonData;
}

/**
 * Save CMS content permanently to browser localStorage.
 * Ensures data is preserved across page refreshes, browser reopens, and redeployments.
 */
export function saveStoredContent(data: LetonData): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(LETON_STORAGE_KEY, serialized);
    localStorage.setItem(LETON_BACKUP_KEY, serialized);
    localStorage.setItem(LETON_LAST_SYNC_KEY, Date.now().toString());
    return true;
  } catch (err) {
    console.error('[LocalStorage] Failed to save content to localStorage:', err);
    return false;
  }
}

/**
 * Reset stored data in localStorage back to default initial data.
 */
export function clearStoredContent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LETON_STORAGE_KEY);
    localStorage.removeItem(LETON_BACKUP_KEY);
    localStorage.removeItem(LETON_LAST_SYNC_KEY);
  } catch (err) {
    console.warn('[LocalStorage] Failed to clear stored content:', err);
  }
}

/**
 * Checks whether custom content exists in localStorage
 */
export function hasStoredContent(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem(LETON_STORAGE_KEY) ||
    localStorage.getItem(LETON_BACKUP_KEY)
  );
}
