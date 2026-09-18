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
import { saveGlobalDataToIdb, loadGlobalDataFromIdb } from './idbStorage';

// Primary Single LocalStorage Key for all global state & photos
export const LETON_GLOBAL_DATA_KEY = 'leton_global_data';
export const LETON_STORAGE_KEY = 'leton_cms_content_v1';
export const LETON_LAST_SYNC_KEY = 'leton_cms_last_sync';
export const LETON_DATA_VERSION_KEY = 'leton_data_version_build';
export const CURRENT_DATA_VERSION = 'v2026.09.18_original_baseline_v1';

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
 * Checks if a given image URL is a temporary placeholder, stock, or unsplash URL.
 */
export function isPlaceholderOrUnsplash(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('images.unsplash.com') ||
    lower.includes('placeholder') ||
    lower.includes('picsum.photos')
  );
}

/**
 * Resolves a valid non-placeholder image, falling back to the original authentic asset.
 */
export function resolveCleanImage(customUrl?: string | null, fallbackUrl?: string | null): string {
  if (customUrl && !isPlaceholderOrUnsplash(customUrl)) {
    return customUrl.trim();
  }
  return fallbackUrl || '';
}

/**
 * Deep merge raw data with initial default data to ensure all fields exist safely and authentic photos are preserved.
 */
export function sanitizeLoadedData(raw: any): LetonData {
  if (!raw || typeof raw !== 'object') {
    return initialLetonData;
  }

  const cleanedLogo = resolveCleanImage(
    raw.siteSettings?.logoUrl,
    initialLetonData.siteSettings.logoUrl
  );

  const cleanedHeroBg = resolveCleanImage(
    raw.siteSettings?.heroBgImage,
    initialLetonData.siteSettings.heroBgImage
  );

  return {
    siteSettings: {
      ...initialLetonData.siteSettings,
      ...(raw.siteSettings || {}),
      logoUrl: cleanedLogo,
      heroBgImage: cleanedHeroBg,
    },
    branches:
      Array.isArray(raw.branches) && raw.branches.length > 0
        ? raw.branches.map((b: any, idx: number) => {
            const fallbackBranch = initialLetonData.branches[idx] || initialLetonData.branches[0];
            const cleanBg = resolveCleanImage(b?.bgImage, fallbackBranch?.bgImage);
            const rawGallery = Array.isArray(b?.galleryImages) ? b.galleryImages : [];
            const cleanGallery = rawGallery
              .map((img: string, gIdx: number) =>
                resolveCleanImage(img, fallbackBranch?.galleryImages?.[gIdx])
              )
              .filter((img: string) => img && !isPlaceholderOrUnsplash(img));

            return {
              ...fallbackBranch,
              ...b,
              bgImage: cleanBg,
              bgOverlay: typeof b?.bgOverlay === 'number' ? b.bgOverlay : 45,
              galleryImages: cleanGallery.length > 0 ? cleanGallery : (fallbackBranch?.galleryImages || []),
            };
          })
        : initialLetonData.branches,
    mobileService: {
      ...initialLetonData.mobileService,
      ...(raw.mobileService || {}),
      bgImage: resolveCleanImage(raw.mobileService?.bgImage, initialLetonData.mobileService.bgImage),
      openBoothBgImage: resolveCleanImage(
        raw.mobileService?.openBoothBgImage,
        initialLetonData.mobileService.openBoothBgImage || initialLetonData.mobileService.bgImage
      ),
      truckImage: resolveCleanImage(
        raw.mobileService?.truckImage,
        initialLetonData.mobileService.truckImage || initialLetonData.mobileService.bgImage
      ),
      locations:
        Array.isArray(raw.mobileService?.locations) && raw.mobileService.locations.length > 0
          ? raw.mobileService.locations
          : initialLetonData.mobileService.locations,
      openBoothTitle: raw.mobileService?.openBoothTitle || initialLetonData.mobileService.openBoothTitle,
      openBoothSubtitle: raw.mobileService?.openBoothSubtitle || initialLetonData.mobileService.openBoothSubtitle,
      openBoothDescription: raw.mobileService?.openBoothDescription || initialLetonData.mobileService.openBoothDescription,
      galleryImages:
        Array.isArray(raw.mobileService?.galleryImages) && raw.mobileService.galleryImages.length > 0
          ? raw.mobileService.galleryImages
              .map((img: string, idx: number) =>
                resolveCleanImage(img, initialLetonData.mobileService?.galleryImages?.[idx])
              )
              .filter((img: string) => img && !isPlaceholderOrUnsplash(img))
          : initialLetonData.mobileService.galleryImages,
      letGoGalleryImages:
        Array.isArray(raw.mobileService?.letGoGalleryImages) && raw.mobileService.letGoGalleryImages.length > 0
          ? raw.mobileService.letGoGalleryImages
              .map((img: string, idx: number) =>
                resolveCleanImage(img, initialLetonData.mobileService?.letGoGalleryImages?.[idx])
              )
              .filter((img: string) => img && !isPlaceholderOrUnsplash(img))
          : initialLetonData.mobileService.letGoGalleryImages,
    },
    menuCategories:
      Array.isArray(raw.menuCategories) && raw.menuCategories.length > 0
        ? raw.menuCategories
        : initialLetonData.menuCategories,
    menuItems:
      Array.isArray(raw.menuItems) && raw.menuItems.length > 0
        ? raw.menuItems.map((m: any, idx: number) => {
            const fallbackItem = initialLetonData.menuItems[idx];
            return {
              ...fallbackItem,
              ...m,
              image: resolveCleanImage(m?.image, fallbackItem?.image),
            };
          })
        : initialLetonData.menuItems,
    baristas:
      Array.isArray(raw.baristas) && raw.baristas.length > 0
        ? raw.baristas.map((b: any, idx: number) => {
            const fallbackBarista = initialLetonData.baristas[idx];
            return {
              ...fallbackBarista,
              ...b,
              image: resolveCleanImage(b?.image, fallbackBarista?.image),
            };
          })
        : initialLetonData.baristas,
    baristasContent: {
      ...initialLetonData.baristasContent,
      ...(raw.baristasContent || {}),
    },
    aboutContent: {
      ...initialLetonData.aboutContent,
      ...(raw.aboutContent || {}),
      mainImage: resolveCleanImage(raw.aboutContent?.mainImage, initialLetonData.aboutContent.mainImage),
      sliderImages:
        Array.isArray(raw.aboutContent?.sliderImages) && raw.aboutContent.sliderImages.length > 0
          ? raw.aboutContent.sliderImages
              .map((img: string, idx: number) =>
                resolveCleanImage(img, initialLetonData.aboutContent?.sliderImages?.[idx])
              )
              .filter((img: string) => img && !isPlaceholderOrUnsplash(img))
          : initialLetonData.aboutContent.sliderImages,
      facts:
        Array.isArray(raw.aboutContent?.facts) && raw.aboutContent.facts.length > 0
          ? raw.aboutContent.facts.map((f: any) => {
              if (
                f?.value === '1,200+' ||
                (typeof f?.label === 'string' && f.label.toLowerCase().includes('cangkir'))
              ) {
                return { ...f, label: 'Established Coffee Brand', value: 'Since 2020' };
              }
              return f;
            })
          : initialLetonData.aboutContent.facts,
    },
    contactSettings: {
      ...initialLetonData.contactSettings,
      ...(raw.contactSettings || {}),
    },
  };
}

/**
 * Checks whether custom content or photos exist in localStorage
 */
export function hasStoredContent(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem(LETON_GLOBAL_DATA_KEY) ||
    localStorage.getItem(LETON_STORAGE_KEY) ||
    localStorage.getItem(LETON_KEY_LOGO_URL) ||
    localStorage.getItem(LETON_KEY_HERO_BG) ||
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
    // 0. Version Migration: Ensure old placeholder caches are cleaned up across Chrome and Safari
    const storedVersion = localStorage.getItem(LETON_DATA_VERSION_KEY);
    if (storedVersion !== CURRENT_DATA_VERSION) {
      const existingDataStr = localStorage.getItem(LETON_GLOBAL_DATA_KEY) || localStorage.getItem(LETON_STORAGE_KEY);
      if (existingDataStr) {
        try {
          const parsed = JSON.parse(existingDataStr);
          const cleaned = sanitizeLoadedData(parsed);
          const serialized = JSON.stringify(cleaned);
          localStorage.setItem(LETON_GLOBAL_DATA_KEY, serialized);
          localStorage.setItem(LETON_STORAGE_KEY, serialized);
          localStorage.setItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
          return cleaned;
        } catch (e) {
          console.warn('[LocalStorage] Migration parse error, using initialLetonData:', e);
        }
      }
      localStorage.setItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
      return initialLetonData;
    }

    let resultData: LetonData | null = null;

    // 1. Check primary global data key
    const globalDataStr = localStorage.getItem(LETON_GLOBAL_DATA_KEY);
    if (globalDataStr) {
      try {
        const parsed = JSON.parse(globalDataStr);
        if (parsed && typeof parsed === 'object') {
          return sanitizeLoadedData(parsed);
        }
      } catch (e) {
        console.warn('Error parsing leton_global_data:', e);
      }
    }

    // 2. Check legacy storage key if primary was empty
    const primary = localStorage.getItem(LETON_STORAGE_KEY);
    if (primary) {
      try {
        const parsed = JSON.parse(primary);
        if (parsed && typeof parsed === 'object') {
          return sanitizeLoadedData(parsed);
        }
      } catch (e) {
        console.warn('Error parsing leton_cms_content_v1:', e);
      }
    }

    // Fallback starting from initial data base
    resultData = { ...initialLetonData };

    // 3. Granular check only if no global JSON existed
    const specificLogo = localStorage.getItem(LETON_KEY_LOGO_URL);
    if (specificLogo && !isPlaceholderOrUnsplash(specificLogo)) {
      resultData.siteSettings.logoUrl = specificLogo.trim();
    } else {
      resultData.siteSettings.logoUrl = initialLetonData.siteSettings.logoUrl;
    }

    const specificHeroBg = localStorage.getItem(LETON_KEY_HERO_BG);
    if (specificHeroBg && !isPlaceholderOrUnsplash(specificHeroBg)) {
      resultData.siteSettings.heroBgImage = specificHeroBg.trim();
    } else {
      resultData.siteSettings.heroBgImage = initialLetonData.siteSettings.heroBgImage;
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

    return resultData;
  } catch (err) {
    console.warn('[LocalStorage] Error reading stored Leton content:', err);
    return initialLetonData;
  }
}

/**
 * Save CMS content permanently to browser localStorage and IndexedDB.
 * Ensures all photos (Logo, Chapters, Baristas, Menu, Hero) are preserved across refreshes.
 * Handles storage quota limits gracefully.
 */
export function saveStoredContent(data: LetonData): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = JSON.stringify(data);
    
    // Save to primary global data key
    try {
      localStorage.setItem(LETON_GLOBAL_DATA_KEY, serialized);
      localStorage.setItem(LETON_STORAGE_KEY, serialized);
      localStorage.setItem(LETON_LAST_SYNC_KEY, Date.now().toString());
      localStorage.setItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    } catch (quotaErr) {
      console.warn('[LocalStorage] Quota limit reached, saving granular entries and to IndexedDB:', quotaErr);
    }

    // Save individual keys for explicit access
    try {
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
    } catch (granularErr) {
      console.warn('[LocalStorage] Granular storage notice:', granularErr);
    }

    // Asynchronously save to IndexedDB as high-capacity safety vault
    saveGlobalDataToIdb(data).catch(() => {});

    return true;
  } catch (err) {
    console.error('[LocalStorage] Failed to save content to localStorage:', err);
    return false;
  }
}

/**
 * Reset stored data in localStorage & IndexedDB back to default initial data.
 */
export function clearStoredContent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LETON_GLOBAL_DATA_KEY);
    localStorage.removeItem(LETON_STORAGE_KEY);
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
 * Produces crisp, lightweight images (~40KB-120KB) that fit easily in localStorage
 */
export async function optimizeImageFile(file: File, maxDimension = 1000, quality = 0.78): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve('');
        return;
      }

      // If file is SVG, return as-is
      if (file.type === 'image/svg+xml') {
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
