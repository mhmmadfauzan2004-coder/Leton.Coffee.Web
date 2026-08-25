import {
  LetonData,
  BaristaItem,
  MenuItem,
  MenuCategory,
  BranchItem,
  MobileService,
  AboutContent,
  ContactSettings,
  SiteSettings,
  BaristasSectionContent,
} from '../types';
import { initialLetonData } from '../data/initialData';

// Primary & Explicit LocalStorage Keys
export const LETON_GLOBAL_DATA_KEY = 'leton_global_data';
export const LETON_STORAGE_KEY = 'leton_cms_content_v1';
export const LETON_BACKUP_KEY = 'leton_cached_content';
export const LETON_LAST_SYNC_KEY = 'leton_cms_last_sync';

// Granular Photo & Section Keys for direct persistence
export const LETON_KEY_LOGO_URL = 'leton_logo_url';
export const LETON_KEY_HERO_BG = 'leton_hero_bg_image';
export const LETON_KEY_BARISTAS = 'leton_baristas_data';
export const LETON_KEY_MENU_ITEMS = 'leton_menu_items';
export const LETON_KEY_MENU_CATEGORIES = 'leton_menu_categories';
export const LETON_KEY_BRANCHES = 'leton_branches_data';
export const LETON_KEY_MOBILE_SERVICE = 'leton_mobile_service';
export const LETON_KEY_SITE_SETTINGS = 'leton_site_settings';
export const LETON_KEY_BARISTAS_CONTENT = 'leton_baristas_content';
export const LETON_KEY_ABOUT_CONTENT = 'leton_about_content';
export const LETON_KEY_CONTACT_SETTINGS = 'leton_contact_settings';

/**
 * Deep merge raw data with initial default data to ensure all fields exist safely.
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
 * Checks whether custom content exists in localStorage
 */
export function hasStoredContent(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem(LETON_GLOBAL_DATA_KEY) ||
    localStorage.getItem(LETON_STORAGE_KEY) ||
    localStorage.getItem(LETON_BACKUP_KEY) ||
    localStorage.getItem(LETON_KEY_LOGO_URL) ||
    localStorage.getItem(LETON_KEY_BARISTAS) ||
    localStorage.getItem(LETON_KEY_BRANCHES) ||
    localStorage.getItem(LETON_KEY_MENU_ITEMS)
  );
}

/**
 * Retrieve saved CMS content from browser localStorage.
 * Always reads from localStorage first before any mock data.
 * If data exists in localStorage, it will NEVER be overwritten by defaults.
 */
export function loadStoredContent(): LetonData {
  if (typeof window === 'undefined') {
    return initialLetonData;
  }

  try {
    let resultData: LetonData | null = null;

    // 1. Check primary global data key first
    const globalDataStr = localStorage.getItem(LETON_GLOBAL_DATA_KEY);
    if (globalDataStr) {
      try {
        const parsed = JSON.parse(globalDataStr);
        if (parsed && typeof parsed === 'object') {
          resultData = sanitizeLoadedData(parsed);
        }
      } catch (e) {
        console.warn('Error parsing leton_global_data:', e);
      }
    }

    // 2. Check primary storage key
    if (!resultData) {
      const primary = localStorage.getItem(LETON_STORAGE_KEY);
      if (primary) {
        try {
          const parsed = JSON.parse(primary);
          if (parsed && typeof parsed === 'object') {
            resultData = sanitizeLoadedData(parsed);
          }
        } catch (e) {
          console.warn('Error parsing leton_cms_content_v1:', e);
        }
      }
    }

    // 3. Check backup key
    if (!resultData) {
      const backup = localStorage.getItem(LETON_BACKUP_KEY);
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (parsed && typeof parsed === 'object') {
            resultData = sanitizeLoadedData(parsed);
          }
        } catch (e) {
          console.warn('Error parsing leton_cached_content:', e);
        }
      }
    }

    // If no full object found, start from initial data base
    if (!resultData) {
      resultData = { ...initialLetonData };
    }

    // 4. Granular overlay check - Ensure any individual photos or sections are restored
    const specificLogo = localStorage.getItem(LETON_KEY_LOGO_URL);
    if (specificLogo && specificLogo.trim()) {
      resultData.siteSettings.logoUrl = specificLogo;
    }

    const specificHeroBg = localStorage.getItem(LETON_KEY_HERO_BG);
    if (specificHeroBg && specificHeroBg.trim()) {
      resultData.siteSettings.heroBgImage = specificHeroBg;
    }

    const specificSiteSettings = localStorage.getItem(LETON_KEY_SITE_SETTINGS);
    if (specificSiteSettings) {
      try {
        resultData.siteSettings = {
          ...resultData.siteSettings,
          ...JSON.parse(specificSiteSettings),
        };
      } catch {}
    }

    const specificBaristas = localStorage.getItem(LETON_KEY_BARISTAS);
    if (specificBaristas) {
      try {
        const parsed = JSON.parse(specificBaristas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.baristas = parsed;
        }
      } catch {}
    }

    const specificMenuItems = localStorage.getItem(LETON_KEY_MENU_ITEMS);
    if (specificMenuItems) {
      try {
        const parsed = JSON.parse(specificMenuItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.menuItems = parsed;
        }
      } catch {}
    }

    const specificMenuCats = localStorage.getItem(LETON_KEY_MENU_CATEGORIES);
    if (specificMenuCats) {
      try {
        const parsed = JSON.parse(specificMenuCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.menuCategories = parsed;
        }
      } catch {}
    }

    const specificBranches = localStorage.getItem(LETON_KEY_BRANCHES);
    if (specificBranches) {
      try {
        const parsed = JSON.parse(specificBranches);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.branches = parsed;
        }
      } catch {}
    }

    const specificMobile = localStorage.getItem(LETON_KEY_MOBILE_SERVICE);
    if (specificMobile) {
      try {
        resultData.mobileService = {
          ...resultData.mobileService,
          ...JSON.parse(specificMobile),
        };
      } catch {}
    }

    const specificBaristasContent = localStorage.getItem(LETON_KEY_BARISTAS_CONTENT);
    if (specificBaristasContent) {
      try {
        resultData.baristasContent = {
          ...resultData.baristasContent,
          ...JSON.parse(specificBaristasContent),
        };
      } catch {}
    }

    const specificAbout = localStorage.getItem(LETON_KEY_ABOUT_CONTENT);
    if (specificAbout) {
      try {
        resultData.aboutContent = {
          ...resultData.aboutContent,
          ...JSON.parse(specificAbout),
        };
      } catch {}
    }

    const specificContact = localStorage.getItem(LETON_KEY_CONTACT_SETTINGS);
    if (specificContact) {
      try {
        resultData.contactSettings = {
          ...resultData.contactSettings,
          ...JSON.parse(specificContact),
        };
      } catch {}
    }

    // Return the persistent data
    return resultData;
  } catch (err) {
    console.warn('[LocalStorage] Error reading stored Leton content:', err);
    return initialLetonData;
  }
}

/**
 * Save CMS content permanently to browser localStorage with full and granular keys.
 * Ensures all photos (Logo, Chapters, Baristas, Menu, Hero) are preserved across refreshes.
 */
export function saveStoredContent(data: LetonData): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = JSON.stringify(data);
    
    // Save to primary global data key and backup keys
    localStorage.setItem(LETON_GLOBAL_DATA_KEY, serialized);
    localStorage.setItem(LETON_STORAGE_KEY, serialized);
    localStorage.setItem(LETON_BACKUP_KEY, serialized);
    localStorage.setItem(LETON_LAST_SYNC_KEY, Date.now().toString());

    // Save individual keys for explicit access
    if (data.siteSettings?.logoUrl) {
      localStorage.setItem(LETON_KEY_LOGO_URL, data.siteSettings.logoUrl);
    }
    if (data.siteSettings?.heroBgImage) {
      localStorage.setItem(LETON_KEY_HERO_BG, data.siteSettings.heroBgImage);
    }
    if (data.siteSettings) {
      localStorage.setItem(LETON_KEY_SITE_SETTINGS, JSON.stringify(data.siteSettings));
    }
    if (Array.isArray(data.baristas)) {
      localStorage.setItem(LETON_KEY_BARISTAS, JSON.stringify(data.baristas));
    }
    if (Array.isArray(data.menuItems)) {
      localStorage.setItem(LETON_KEY_MENU_ITEMS, JSON.stringify(data.menuItems));
    }
    if (Array.isArray(data.menuCategories)) {
      localStorage.setItem(LETON_KEY_MENU_CATEGORIES, JSON.stringify(data.menuCategories));
    }
    if (Array.isArray(data.branches)) {
      localStorage.setItem(LETON_KEY_BRANCHES, JSON.stringify(data.branches));
    }
    if (data.mobileService) {
      localStorage.setItem(LETON_KEY_MOBILE_SERVICE, JSON.stringify(data.mobileService));
    }
    if (data.baristasContent) {
      localStorage.setItem(LETON_KEY_BARISTAS_CONTENT, JSON.stringify(data.baristasContent));
    }
    if (data.aboutContent) {
      localStorage.setItem(LETON_KEY_ABOUT_CONTENT, JSON.stringify(data.aboutContent));
    }
    if (data.contactSettings) {
      localStorage.setItem(LETON_KEY_CONTACT_SETTINGS, JSON.stringify(data.contactSettings));
    }

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
    localStorage.removeItem(LETON_GLOBAL_DATA_KEY);
    localStorage.removeItem(LETON_STORAGE_KEY);
    localStorage.removeItem(LETON_BACKUP_KEY);
    localStorage.removeItem(LETON_LAST_SYNC_KEY);
    localStorage.removeItem(LETON_KEY_LOGO_URL);
    localStorage.removeItem(LETON_KEY_HERO_BG);
    localStorage.removeItem(LETON_KEY_SITE_SETTINGS);
    localStorage.removeItem(LETON_KEY_BARISTAS);
    localStorage.removeItem(LETON_KEY_MENU_ITEMS);
    localStorage.removeItem(LETON_KEY_MENU_CATEGORIES);
    localStorage.removeItem(LETON_KEY_BRANCHES);
    localStorage.removeItem(LETON_KEY_MOBILE_SERVICE);
    localStorage.removeItem(LETON_KEY_BARISTAS_CONTENT);
    localStorage.removeItem(LETON_KEY_ABOUT_CONTENT);
    localStorage.removeItem(LETON_KEY_CONTACT_SETTINGS);
  } catch (err) {
    console.warn('[LocalStorage] Failed to clear stored content:', err);
  }
}

/**
 * Smart image compressor to safely resize uploaded files for local persistence
 */
export async function optimizeImageFile(file: File, maxDimension = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve('');
        return;
      }

      // If file is SVG or very small (< 100KB), return as-is
      if (file.type === 'image/svg+xml' || file.size < 100 * 1024) {
        resolve(src);
        return;
      }

      const img = new Image();
      img.src = src;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(src);
      };
    };
    reader.onerror = () => {
      resolve('');
    };
  });
}
