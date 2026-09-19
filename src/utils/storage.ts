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
  CustomizationOption,
} from '../types';
import { initialLetonData } from '../data/initialData';
import { DEFAULT_MASTER_TOPPINGS, DEFAULT_MASTER_SYRUPS, DEFAULT_SIZES } from '../data/addOnsData';
import { saveGlobalDataToIdb, loadGlobalDataFromIdb } from './idbStorage';
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  stripHeavyBase64Images,
  pruneStorageCache,
} from './safeStorage';

// Primary Single LocalStorage Key for all global state & photos
export const LETON_GLOBAL_DATA_KEY = 'leton_global_data';
export const LETON_STORAGE_KEY = 'leton_cms_content_v1';
export const LETON_LAST_SYNC_KEY = 'leton_cms_last_sync';
export const LETON_DATA_VERSION_KEY = 'leton_data_version_build';
export const CURRENT_DATA_VERSION = 'v2026.09.18_original_baseline_v1';

// Granular Photo & Section Keys (maintained for legacy compatibility)
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
 * Checks if a given image URL is an explicit placeholder string.
 */
export function isPlaceholderOrUnsplash(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return true;
  const lower = url.toLowerCase();
  return lower.includes('placeholder') || lower.includes('picsum.photos');
}

/**
 * Resolves a valid image URL, prioritizing any user-specified custom URL without forcing seed fallback.
 */
export function resolveCleanImage(customUrl?: string | null, fallbackUrl?: string | null): string {
  if (typeof customUrl === 'string' && customUrl.trim()) {
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

  const cleanedQris = resolveCleanImage(
    raw.siteSettings?.qrisImage,
    initialLetonData.siteSettings.qrisImage || ''
  );

  return {
    siteSettings: {
      ...initialLetonData.siteSettings,
      ...(raw.siteSettings || {}),
      logoUrl: cleanedLogo,
      heroBgImage: cleanedHeroBg,
      qrisImage: cleanedQris,
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
      bgImage: resolveCleanImage(
        raw.mobileService?.bgImage || raw.mobileService?.truckImage,
        initialLetonData.mobileService.bgImage
      ),
      openBoothBgImage: resolveCleanImage(
        raw.mobileService?.openBoothBgImage,
        initialLetonData.mobileService.openBoothBgImage || initialLetonData.mobileService.bgImage
      ),
      truckImage: resolveCleanImage(
        raw.mobileService?.truckImage || raw.mobileService?.bgImage,
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
            const fallbackItem = initialLetonData.menuItems.find((f: any) => f.id === m?.id) || initialLetonData.menuItems[idx];
            return {
              ...fallbackItem,
              ...m,
              image: typeof m?.image === 'string' && m.image.trim() ? m.image.trim() : (fallbackItem?.image || ''),
              hasSize: typeof m?.hasSize === 'boolean' ? m.hasSize : (fallbackItem?.hasSize ?? true),
              sizes: Array.isArray(m?.sizes) && m.sizes.length > 0 ? m.sizes : fallbackItem?.sizes,
              hasTopping: typeof m?.hasTopping === 'boolean' ? m.hasTopping : (fallbackItem?.hasTopping ?? true),
              availableToppingIds: Array.isArray(m?.availableToppingIds) ? m.availableToppingIds : fallbackItem?.availableToppingIds,
              hasSyrup: typeof m?.hasSyrup === 'boolean' ? m.hasSyrup : (fallbackItem?.hasSyrup ?? true),
              availableSyrupIds: Array.isArray(m?.availableSyrupIds) ? m.availableSyrupIds : fallbackItem?.availableSyrupIds,
              customizations: Array.isArray(m?.customizations) ? m.customizations : (fallbackItem?.customizations || []),
            };
          })
        : initialLetonData.menuItems,
    masterToppings:
      Array.isArray(raw.masterToppings) && raw.masterToppings.length > 0
        ? raw.masterToppings
        : (initialLetonData.masterToppings || DEFAULT_MASTER_TOPPINGS),
    masterSyrups:
      Array.isArray(raw.masterSyrups) && raw.masterSyrups.length > 0
        ? raw.masterSyrups
        : (initialLetonData.masterSyrups || DEFAULT_MASTER_SYRUPS),
    masterSizes:
      Array.isArray(raw.masterSizes) && raw.masterSizes.length > 0
        ? raw.masterSizes
        : (initialLetonData.masterSizes || DEFAULT_SIZES),
    customizationGroups:
      Array.isArray(raw.customizationGroups)
        ? raw.customizationGroups
        : (initialLetonData.customizationGroups || []),
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
    safeGetItem(LETON_GLOBAL_DATA_KEY) ||
    safeGetItem(LETON_STORAGE_KEY) ||
    safeGetItem(LETON_KEY_LOGO_URL) ||
    safeGetItem(LETON_KEY_HERO_BG) ||
    safeGetItem(LETON_KEY_BARISTAS) ||
    safeGetItem(LETON_KEY_BRANCHES) ||
    safeGetItem(LETON_KEY_MENU_ITEMS)
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
    // 0. Version Migration: Ensure old placeholder caches are cleaned up safely
    const storedVersion = safeGetItem(LETON_DATA_VERSION_KEY);
    if (storedVersion !== CURRENT_DATA_VERSION) {
      const existingDataStr = safeGetItem(LETON_GLOBAL_DATA_KEY) || safeGetItem(LETON_STORAGE_KEY);
      if (existingDataStr) {
        try {
          const parsed = JSON.parse(existingDataStr);
          const cleaned = sanitizeLoadedData(parsed);
          const lightweight = stripHeavyBase64Images(cleaned);
          safeSetItem(LETON_GLOBAL_DATA_KEY, JSON.stringify(lightweight));
          safeSetItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
          pruneStorageCache();
          return cleaned;
        } catch (e) {
          console.warn('[LocalStorage] Migration parse error, using initialLetonData:', e);
        }
      }
      safeSetItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);
      return initialLetonData;
    }

    let resultData: LetonData | null = null;

    // 1. Check primary global data key
    const globalDataStr = safeGetItem(LETON_GLOBAL_DATA_KEY);
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
    const primary = safeGetItem(LETON_STORAGE_KEY);
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
    const specificLogo = safeGetItem(LETON_KEY_LOGO_URL);
    if (specificLogo && !isPlaceholderOrUnsplash(specificLogo)) {
      resultData.siteSettings.logoUrl = specificLogo.trim();
    } else {
      resultData.siteSettings.logoUrl = initialLetonData.siteSettings.logoUrl;
    }

    const specificHeroBg = safeGetItem(LETON_KEY_HERO_BG);
    if (specificHeroBg && !isPlaceholderOrUnsplash(specificHeroBg)) {
      resultData.siteSettings.heroBgImage = specificHeroBg.trim();
    } else {
      resultData.siteSettings.heroBgImage = initialLetonData.siteSettings.heroBgImage;
    }

    const specificSiteSettings = safeGetItem(LETON_KEY_SITE_SETTINGS);
    if (specificSiteSettings) {
      try {
        resultData.siteSettings = {
          ...resultData.siteSettings,
          ...JSON.parse(specificSiteSettings),
        };
      } catch {}
    }

    const specificBaristas = safeGetItem(LETON_KEY_BARISTAS);
    if (specificBaristas) {
      try {
        const parsed = JSON.parse(specificBaristas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.baristas = parsed;
        }
      } catch {}
    }

    const specificMenuItems = safeGetItem(LETON_KEY_MENU_ITEMS);
    if (specificMenuItems) {
      try {
        const parsed = JSON.parse(specificMenuItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.menuItems = parsed;
        }
      } catch {}
    }

    const specificMenuCats = safeGetItem(LETON_KEY_MENU_CATEGORIES);
    if (specificMenuCats) {
      try {
        const parsed = JSON.parse(specificMenuCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.menuCategories = parsed;
        }
      } catch {}
    }

    const specificBranches = safeGetItem(LETON_KEY_BRANCHES);
    if (specificBranches) {
      try {
        const parsed = JSON.parse(specificBranches);
        if (Array.isArray(parsed) && parsed.length > 0) {
          resultData.branches = parsed;
        }
      } catch {}
    }

    const specificMobile = safeGetItem(LETON_KEY_MOBILE_SERVICE);
    if (specificMobile) {
      try {
        resultData.mobileService = {
          ...resultData.mobileService,
          ...JSON.parse(specificMobile),
        };
      } catch {}
    }

    const specificBaristasContent = safeGetItem(LETON_KEY_BARISTAS_CONTENT);
    if (specificBaristasContent) {
      try {
        resultData.baristasContent = {
          ...resultData.baristasContent,
          ...JSON.parse(specificBaristasContent),
        };
      } catch {}
    }

    const specificAbout = safeGetItem(LETON_KEY_ABOUT_CONTENT);
    if (specificAbout) {
      try {
        resultData.aboutContent = {
          ...resultData.aboutContent,
          ...JSON.parse(specificAbout),
        };
      } catch {}
    }

    const specificContact = safeGetItem(LETON_KEY_CONTACT_SETTINGS);
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
 * Ensures all photos (Logo, Chapters, Baristas, Menu, Hero) are preserved across refreshes in IndexedDB.
 * Uses lightweight stripped representation for LocalStorage to prevent QuotaExceededError.
 */
export function saveStoredContent(data: LetonData): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Asynchronously save FULL unabridged data to IndexedDB (unlimited storage for HD photos)
    saveGlobalDataToIdb(data).catch((err) => {
      console.warn('[IDB] Failed to save full content to IndexedDB:', err);
    });

    // 2. Prepare lightweight data for localStorage (heavy base64 stripped out)
    const lightweightData = stripHeavyBase64Images(data);
    const serialized = JSON.stringify(lightweightData);

    // 3. Store safely in localStorage without triggering quota limits
    safeSetItem(LETON_GLOBAL_DATA_KEY, serialized);
    safeSetItem(LETON_LAST_SYNC_KEY, Date.now().toString());
    safeSetItem(LETON_DATA_VERSION_KEY, CURRENT_DATA_VERSION);

    // Clean up any legacy bloated duplicate keys
    pruneStorageCache();

    return true;
  } catch (err) {
    console.error('[LocalStorage] Failed to save content:', err);
    return false;
  }
}

/**
 * Reset stored data in localStorage & IndexedDB back to default initial data.
 */
export function clearStoredContent(): void {
  if (typeof window === 'undefined') return;

  try {
    safeRemoveItem(LETON_GLOBAL_DATA_KEY);
    safeRemoveItem(LETON_STORAGE_KEY);
    safeRemoveItem(LETON_LAST_SYNC_KEY);
    safeRemoveItem(LETON_KEY_LOGO_URL);
    safeRemoveItem(LETON_KEY_HERO_BG);
    safeRemoveItem(LETON_KEY_SITE_SETTINGS);
    safeRemoveItem(LETON_KEY_BARISTAS);
    safeRemoveItem(LETON_KEY_MENU_ITEMS);
    safeRemoveItem(LETON_KEY_MENU_CATEGORIES);
    safeRemoveItem(LETON_KEY_BRANCHES);
    safeRemoveItem(LETON_KEY_MOBILE_SERVICE);
    safeRemoveItem(LETON_KEY_BARISTAS_CONTENT);
    safeRemoveItem(LETON_KEY_ABOUT_CONTENT);
    safeRemoveItem(LETON_KEY_CONTACT_SETTINGS);
    pruneStorageCache();
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
