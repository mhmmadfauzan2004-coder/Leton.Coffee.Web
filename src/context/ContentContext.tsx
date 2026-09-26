import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LetonData, AuthState, AdminRole, MenuItem, MenuCategory, CustomizationOption, ProductSizeOption, CustomizationGroup } from '../types';
import { initialLetonData } from '../data/initialData';
import {
  saveSingleMenuItemGranular,
  deleteSingleMenuItemGranular,
  saveSingleCategoryGranular,
  deleteSingleCategoryGranular,
  saveSingleCustomOptionGranular,
  deleteSingleCustomOptionGranular,
} from '../utils/supabaseGranular';
import {
  loadStoredContent,
  saveStoredContent,
  clearStoredContent,
  hasStoredContent,
  sanitizeLoadedData,
  LETON_STORAGE_KEY,
} from '../utils/storage';
import { getApiUrl } from '../utils/api';
import { preloadImage } from '../utils/imagePreloader';
import { findPresetAdmin } from '../data/adminAccounts';
import {
  fetchContentFromSupabase,
  saveContentToSupabase,
  uploadImageToSupabase,
  deleteImageFromSupabase,
  subscribeToSupabaseRealtime,
  isSupabaseConfigured,
  updateSupabaseAuthPassword,
  SUPABASE_STORAGE_BUCKET,
  resetSupabaseClient,
} from '../utils/supabase';

interface ToastInfo {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ContentContextType {
  data: LetonData;
  isLoading: boolean;
  isInitialReady: boolean;
  isDataReady: boolean;
  isRealtimeConnected: boolean;
  lastUpdated: number;
  auth: AuthState;
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  saveData: (newData: LetonData) => Promise<boolean>;
  updateData: (partialOrFn: Partial<LetonData> | ((prev: LetonData) => LetonData)) => Promise<boolean>;
  saveMenuItem: (item: MenuItem) => Promise<boolean>;
  deleteMenuItem: (itemId: string) => Promise<boolean>;
  saveCategory: (category: MenuCategory) => Promise<boolean>;
  deleteCategory: (catId: string) => Promise<boolean>;
  saveCustomOption: (type: 'topping' | 'syrup', option: CustomizationOption) => Promise<boolean>;
  deleteCustomOption: (type: 'topping' | 'syrup', optionId: string) => Promise<boolean>;
  saveMasterSizes: (sizes: ProductSizeOption[]) => Promise<boolean>;
  saveCustomizationGroup: (group: CustomizationGroup) => Promise<boolean>;
  deleteCustomizationGroup: (groupId: string) => Promise<boolean>;
  uploadImage: (file: File, fileNamePrefix?: string) => Promise<string | null>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changeCredentials: (currentPassword: string, newUsername?: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
  completeLoading: () => void;
  resetToDefaults: () => Promise<boolean>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'leton_admin_token';
const USERNAME_STORAGE_KEY = 'leton_admin_user';
export const ROLE_STORAGE_KEY = 'leton_admin_role';
export const OUTLET_STORAGE_KEY = 'leton_admin_outlet';
export const OUTLET_NAME_STORAGE_KEY = 'leton_admin_outlet_name';

// Local default username fallback
export const DEFAULT_ADMIN_USERNAME = 'admin';

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize data strictly from localStorage first (or fallback to initialLetonData if localStorage is empty)
  const [data, setData] = useState<LetonData>(() => {
    return loadStoredContent();
  });

  // Non-blocking readiness flags:
  // isInitialReady is true immediately to allow instant 0-delay loading screen rendering
  const [isInitialReady, setIsInitialReady] = useState<boolean>(true);
  const [isDataReady, setIsDataReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const completeLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Automatically sync any data state changes to LocalStorage immediately
  useEffect(() => {
    if (data && data.siteSettings) {
      saveStoredContent(data);
    }
  }, [data]);

  const [auth, setAuth] = useState<AuthState>(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    const username = typeof window !== 'undefined' ? localStorage.getItem(USERNAME_STORAGE_KEY) : null;
    const storedRole = (typeof window !== 'undefined' ? localStorage.getItem(ROLE_STORAGE_KEY) : null) as AdminRole | null;
    const storedOutlet = typeof window !== 'undefined' ? localStorage.getItem(OUTLET_STORAGE_KEY) : null;
    const storedOutletName = typeof window !== 'undefined' ? localStorage.getItem(OUTLET_NAME_STORAGE_KEY) : null;

    const preset = username ? findPresetAdmin(username) : undefined;
    const role = storedRole || preset?.role || (username === 'admin' ? 'super_admin' : 'super_admin');
    const outletId = storedOutlet || preset?.outletId || undefined;
    const outletName = storedOutletName || preset?.outletName || undefined;

    return {
      isAuthenticated: Boolean(token),
      token: token || null,
      username: username || DEFAULT_ADMIN_USERNAME,
      role,
      outletId,
      outletName,
    };
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch content from Supabase (primary) or server API, preload latest logo, then mark initial ready
  const refreshData = useCallback(async () => {
    try {
      let activeData: LetonData = loadStoredContent();

      let fetched = false;
      // 1. Try Supabase database first if configured (Primary Source of Truth from Admin)
      if (isSupabaseConfigured()) {
        try {
          const supabaseData = await fetchContentFromSupabase();
          if (supabaseData && supabaseData.siteSettings) {
            activeData = sanitizeLoadedData(supabaseData);
            saveStoredContent(activeData);
            fetched = true;
          }
        } catch (sbErr) {
          console.warn('Supabase fetch note:', sbErr);
        }
      }

      // 2. Fallback: Express backend API (reads data/content.json)
      if (!fetched) {
        try {
          const res = await fetch(getApiUrl('/api/content'), { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json && json.siteSettings) {
              activeData = sanitizeLoadedData(json);
              saveStoredContent(activeData);
            }
          }
        } catch (apiErr) {
          // Keep activeData from local storage
        }
      }

      // 3. Update active data state
      setData(activeData);
      setLastUpdated(Date.now());

      // 4. Preload the exact Admin logo image so it is fully decoded in browser memory
      const logoToPreload = activeData.siteSettings?.logoUrl;
      if (logoToPreload) {
        await preloadImage(logoToPreload, 2500);
      }
    } catch (err) {
      console.warn('Network sync notice:', err);
    } finally {
      // 5. Logo and data are now 100% confirmed ready and in browser memory
      setIsInitialReady(true);
      setIsDataReady(true);
    }
  }, []);

  // Multi-tab sync via window storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        (e.key === LETON_STORAGE_KEY || e.key === 'leton_global_data') &&
        e.newValue
      ) {
        try {
          const parsed = JSON.parse(e.newValue);
          const sanitized = sanitizeLoadedData(parsed);
          setData(sanitized);
          setLastUpdated(Date.now());
        } catch (err) {
          console.error('Error syncing storage across tabs:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Realtime Supabase Channel + SSE fallback listener
  useEffect(() => {
    refreshData();

    // 1. Setup Supabase Realtime Channel
    const unsubscribeSupabase = subscribeToSupabaseRealtime(
      (liveData) => {
        setIsRealtimeConnected(true);
        setData((prevData) => {
          // Compare JSON stringified representations to prevent unnecessary re-renders
          if (JSON.stringify(prevData) === JSON.stringify(liveData)) {
            return prevData;
          }
          saveStoredContent(liveData);
          setLastUpdated(Date.now());
          return liveData;
        });
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'ERROR') {
          setIsRealtimeConnected(false);
        }
      }
    );

    // 2. Secondary fallback: Server-Sent Events listener
    let eventSource: EventSource | null = null;
    let retryTimeout: any = null;

    function connectSSE() {
      try {
        if (typeof window === 'undefined' || !window.EventSource) return;
        eventSource = new EventSource(getApiUrl('/api/events'));

        eventSource.onopen = () => {
          setIsRealtimeConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.data && payload.data.siteSettings) {
              const liveData = sanitizeLoadedData(payload.data);
              setData(liveData);
              saveStoredContent(liveData);
              setLastUpdated(Date.now());
            }
          } catch (err) {
            console.warn('Error parsing SSE event:', err);
          }
        };

        eventSource.onerror = (e) => {
          try {
            if (e && typeof (e as any).preventDefault === 'function') {
              (e as any).preventDefault();
            }
          } catch {}
          try {
            eventSource?.close();
          } catch {}
          if (!retryTimeout) {
            retryTimeout = setTimeout(connectSSE, 15000);
          }
        };
      } catch (err) {
        // SSE optional notice
      }
    }

    connectSSE();

    return () => {
      unsubscribeSupabase();
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [refreshData]);

  // Check auth validity on mount (local session preservation)
  useEffect(() => {
    if (auth.token && !auth.token.startsWith('leton_local_')) {
      fetch(getApiUrl('/api/auth/verify'), {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
        .then((res) => res.json())
        .then((result) => {
          if (!result.isAuthenticated) {
            const localToken = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (!localToken) {
              logout();
            }
          }
        })
        .catch(() => {});
    }
  }, [auth.token]);

  // Save content with Instant Optimistic UI + Background Cloud Synchronization + Rollback Protection
  const saveData = async (newData: LetonData): Promise<boolean> => {
    try {
      if (!auth.isAuthenticated) {
        showToast('Sesi login telah berakhir. Silakan login kembali.', 'error');
        logout();
        return false;
      }

      // Enforce Role Restriction: Outlet Admin cannot modify global CMS settings, chapters, or hero
      if (auth.role === 'outlet_admin') {
        const hasSiteSettingsChange = JSON.stringify(newData.siteSettings) !== JSON.stringify(data.siteSettings);
        const hasBranchesChange = JSON.stringify(newData.branches) !== JSON.stringify(data.branches);
        const hasMobileChange = JSON.stringify(newData.mobileService) !== JSON.stringify(data.mobileService);
        const hasAboutChange = JSON.stringify(newData.aboutContent) !== JSON.stringify(data.aboutContent);
        const hasContactChange = JSON.stringify(newData.contactSettings) !== JSON.stringify(data.contactSettings);

        if (hasSiteSettingsChange || hasBranchesChange || hasMobileChange || hasAboutChange || hasContactChange) {
          showToast('Akses Ditolak: Akun Outlet Admin tidak memiliki izin untuk mengubah konten website global.', 'error');
          return false;
        }
      }

      const previousData = data;
      const sanitized = sanitizeLoadedData(newData);

      // 1. OPTIMISTIC UPDATE: Update React state & Local Storage instantly (0ms UI delay)
      setData(sanitized);
      saveStoredContent(sanitized);
      setLastUpdated(Date.now());

      // 2. Direct Cloud Synchronization to Supabase
      if (isSupabaseConfigured()) {
        const sbResult = await saveContentToSupabase(sanitized);
        if (!sbResult.success) {
          console.error('[Supabase Sync Error - Rolling back UI]:', sbResult.error);
          setData(previousData);
          saveStoredContent(previousData);
          setLastUpdated(Date.now());
          showToast('Gagal menyimpan data ke cloud: ' + (sbResult.error || 'Gagal koneksi ke database') + '. Perubahan dibatalkan.', 'error');
          return false;
        }
      }

      // 3. Secondary local backend API sync (fire and forget without blocking)
      fetch(getApiUrl('/api/content'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token || 'leton_local_token'}`,
        },
        body: JSON.stringify(sanitized),
      }).catch(() => {});

      // Preload updated logo in background if changed
      if (sanitized.siteSettings?.logoUrl && sanitized.siteSettings.logoUrl !== previousData.siteSettings?.logoUrl) {
        preloadImage(sanitized.siteSettings.logoUrl).catch(() => {});
      }

      return true;
    } catch (err: any) {
      console.error('Save error in ContentContext:', err);
      showToast('Gagal menyimpan data: ' + (err?.message || 'Error tidak diketahui'), 'error');
      return false;
    }
  };

  // Helper to update a slice of data or functional state update
  const updateData = async (
    partialOrFn: Partial<LetonData> | ((prev: LetonData) => LetonData)
  ): Promise<boolean> => {
    try {
      const nextData: LetonData =
        typeof partialOrFn === 'function'
          ? (partialOrFn as any)(data)
          : { ...data, ...partialOrFn };

      return await saveData(nextData);
    } catch (err: any) {
      console.error('[ContentContext updateData Error]:', err);
      showToast('Gagal memperbarui data: ' + (err?.message || 'Unknown error'), 'error');
      return false;
    }
  };

  // Granular 1-record update for Menu Item (Product)
  const saveMenuItem = async (item: MenuItem): Promise<boolean> => {
    try {
      const existingIdx = data.menuItems.findIndex((i) => i.id === item.id);
      let nextItems = [...data.menuItems];
      let oldImage: string | undefined;

      if (existingIdx >= 0) {
        oldImage = nextItems[existingIdx]?.image;
        nextItems[existingIdx] = item;
      } else {
        nextItems.push(item);
      }
      const nextData = { ...data, menuItems: nextItems };
      const savedSuccess = await saveData(nextData);

      // Cleanup old image from Supabase Storage ONLY AFTER database save succeeds
      if (savedSuccess && oldImage && oldImage !== item.image && isSupabaseConfigured()) {
        deleteImageFromSupabase(oldImage).catch(() => {});
      }

      return savedSuccess;
    } catch (err: any) {
      showToast('Gagal menyimpan item menu: ' + err.message, 'error');
      return false;
    }
  };

  const deleteMenuItem = async (itemId: string): Promise<boolean> => {
    try {
      const nextItems = data.menuItems.filter((i) => i.id !== itemId);
      const nextData = { ...data, menuItems: nextItems };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menghapus item menu: ' + err.message, 'error');
      return false;
    }
  };

  const saveCategory = async (category: MenuCategory): Promise<boolean> => {
    try {
      const existingIdx = data.menuCategories.findIndex((c) => c.id === category.id);
      let nextCats = [...data.menuCategories];
      if (existingIdx >= 0) {
        nextCats[existingIdx] = category;
      } else {
        nextCats.push(category);
      }
      const nextData = { ...data, menuCategories: nextCats };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menyimpan kategori: ' + err.message, 'error');
      return false;
    }
  };

  const deleteCategory = async (catId: string): Promise<boolean> => {
    try {
      const nextCats = data.menuCategories.filter((c) => c.id !== catId);
      const fallbackCat = nextCats[0]?.id || 'general';
      const nextItems = data.menuItems.map((item) =>
        item.categoryId === catId ? { ...item, categoryId: fallbackCat } : item
      );
      const nextData = { ...data, menuCategories: nextCats, menuItems: nextItems };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menghapus kategori: ' + err.message, 'error');
      return false;
    }
  };

  const saveCustomOption = async (type: 'topping' | 'syrup', option: CustomizationOption): Promise<boolean> => {
    try {
      const isTopping = type === 'topping';
      const targetList = isTopping ? data.masterToppings : data.masterSyrups;
      const existingIdx = targetList.findIndex((o) => o.id === option.id);
      let nextList = [...targetList];
      if (existingIdx >= 0) {
        nextList[existingIdx] = option;
      } else {
        nextList.push(option);
      }
      const nextData = isTopping
        ? { ...data, masterToppings: nextList }
        : { ...data, masterSyrups: nextList };
      return await saveData(nextData);
    } catch (err: any) {
      showToast(`Gagal menyimpan ${type}: ` + err.message, 'error');
      return false;
    }
  };

  const deleteCustomOption = async (type: 'topping' | 'syrup', optionId: string): Promise<boolean> => {
    try {
      const isTopping = type === 'topping';
      const targetList = isTopping ? data.masterToppings : data.masterSyrups;
      const nextList = targetList.filter((o) => o.id !== optionId);
      const nextData = isTopping
        ? { ...data, masterToppings: nextList }
        : { ...data, masterSyrups: nextList };
      return await saveData(nextData);
    } catch (err: any) {
      showToast(`Gagal menghapus ${type}: ` + err.message, 'error');
      return false;
    }
  };

  const saveMasterSizes = async (sizes: ProductSizeOption[]): Promise<boolean> => {
    try {
      const nextData = { ...data, masterSizes: sizes };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menyimpan opsi ukuran: ' + err.message, 'error');
      return false;
    }
  };

  const saveCustomizationGroup = async (group: CustomizationGroup): Promise<boolean> => {
    try {
      const groups = data.customizationGroups || [];
      const idx = groups.findIndex((g) => g.id === group.id);
      let nextGroups = [...groups];
      if (idx >= 0) {
        nextGroups[idx] = group;
      } else {
        nextGroups.push(group);
      }
      const nextData = { ...data, customizationGroups: nextGroups };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menyimpan kustomisasi: ' + err.message, 'error');
      return false;
    }
  };

  const deleteCustomizationGroup = async (groupId: string): Promise<boolean> => {
    try {
      const groups = data.customizationGroups || [];
      const nextGroups = groups.filter((g) => g.id !== groupId);
      const nextData = { ...data, customizationGroups: nextGroups };
      return await saveData(nextData);
    } catch (err: any) {
      showToast('Gagal menghapus kustomisasi: ' + err.message, 'error');
      return false;
    }
  };

  // Upload image directly and exclusively to Supabase Storage Bucket ('leton-images')
  const uploadImage = async (file: File, fileNamePrefix: string = 'menu'): Promise<string | null> => {
    try {
      if (!auth.isAuthenticated) {
        showToast('Sesi tidak valid untuk upload gambar. Silakan login terlebih dahulu.', 'error');
        return null;
      }

      // 1. Determine target folder inside 'leton-images' bucket based on label/prefix
      let folder = 'lainnya';
      const prefixLower = fileNamePrefix.toLowerCase();
      if (prefixLower.includes('logo')) {
        folder = 'logo';
      } else if (prefixLower.includes('menu') || prefixLower.includes('produk') || prefixLower.includes('item')) {
        folder = 'menu';
      } else if (prefixLower.includes('cabang') || prefixLower.includes('outlet') || prefixLower.includes('branch') || prefixLower.includes('chapter')) {
        folder = 'cabang';
      } else if (prefixLower.includes('barista')) {
        folder = 'barista';
      } else if (prefixLower.includes('letgo') || prefixLower.includes('let-go') || prefixLower.includes('truck') || prefixLower.includes('mobile')) {
        folder = 'letgo';
      } else if (prefixLower.includes('booth') || prefixLower.includes('open-booth')) {
        folder = 'open-booth';
      } else if (
        prefixLower.includes('cerita') ||
        prefixLower.includes('story') ||
        prefixLower.includes('slider') ||
        prefixLower.includes('slide') ||
        prefixLower.includes('utama') ||
        prefixLower.includes('sekunder') ||
        prefixLower.includes('about') ||
        prefixLower.includes('hero') ||
        prefixLower.includes('bg') ||
        prefixLower.includes('background')
      ) {
        folder = 'cerita';
      }

      // 2. Direct upload to Supabase Storage ('leton-images' bucket)
      if (isSupabaseConfigured()) {
        const supabaseUpload = await uploadImageToSupabase(file, folder, fileNamePrefix);
        if (supabaseUpload.success && supabaseUpload.url) {
          showToast('Foto berhasil diupload ke Supabase Storage!', 'success');
          return supabaseUpload.url;
        } else {
          console.error('Supabase upload failed:', supabaseUpload.error);
          showToast(`Gagal upload ke Supabase Storage: ${supabaseUpload.error}`, 'error');
          return null;
        }
      } else {
        showToast('Gagal upload: Supabase belum dikonfigurasi dengan benar di menu Settings.', 'error');
        return null;
      }
    } catch (err: any) {
      console.error('Upload image exception:', err);
      showToast('Terjadi kesalahan saat memproses foto.', 'error');
      return null;
    }
  };

  // Login supporting Super Admin and Outlet Admins via Cloudflare Edge Backend
  const login = async (inputUser: string, inputPass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedUser = inputUser.trim();
    if (!trimmedUser || !inputPass) {
      return { success: false, error: 'Silakan masukkan username dan password.' };
    }

    try {
      // Authenticate directly with the server (Cloudflare Pages Function / backend API)
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password: inputPass,
        }),
      });

      if (!response.ok) {
        let serverErrorMessage = '';
        try {
          const errJson = await response.json();
          serverErrorMessage = errJson?.error || errJson?.message;
        } catch {}
        return {
          success: false,
          error: serverErrorMessage || `Password atau Username salah, silakan coba lagi. (${response.status})`
        };
      }

      const resData = await response.json();
      const serverToken = resData?.token;

      if (!serverToken) {
        return {
          success: false,
          error: 'Server otentikasi tidak mengembalikan token sesi yang sah.'
        };
      }

      const activeUsername = resData.username || trimmedUser;
      const matchedRole: AdminRole = resData.role === 'outlet_admin' ? 'outlet_admin' : 'super_admin';
      const matchedOutletId = resData.outlet_id || resData.outletId;
      const preset = findPresetAdmin(activeUsername);
      const matchedOutletName = resData.outletName || preset?.outletName;

      // Store official secure session token from server in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, serverToken);
      localStorage.setItem(USERNAME_STORAGE_KEY, activeUsername);
      localStorage.setItem(ROLE_STORAGE_KEY, matchedRole);
      if (matchedOutletId) {
        localStorage.setItem(OUTLET_STORAGE_KEY, matchedOutletId);
      } else {
        localStorage.removeItem(OUTLET_STORAGE_KEY);
      }
      if (matchedOutletName) {
        localStorage.setItem(OUTLET_NAME_STORAGE_KEY, matchedOutletName);
      } else {
        localStorage.removeItem(OUTLET_NAME_STORAGE_KEY);
      }

      // Re-initialize Supabase client headers with the verified role and token
      resetSupabaseClient();

      // Update react auth state with verified credentials
      setAuth({
        isAuthenticated: true,
        token: serverToken,
        username: activeUsername,
        role: matchedRole,
        outletId: matchedOutletId,
        outletName: matchedOutletName,
      });

      const welcomeMsg = matchedRole === 'super_admin'
        ? `Selamat datang, Super Admin Leton Coffee!`
        : `Selamat datang di Admin Outlet ${matchedOutletName || ''}!`;
      showToast(welcomeMsg, 'success');
      return { success: true };
    } catch (authErr: any) {
      console.error('[Admin Login Server Sync Error]:', authErr);
      return {
        success: false,
        error: 'Terjadi kesalahan jaringan saat otentikasi dengan server.'
      };
    }
  };

  // Logout
  const logout = () => {
    if (auth.token) {
      fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USERNAME_STORAGE_KEY);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(OUTLET_STORAGE_KEY);
    localStorage.removeItem(OUTLET_NAME_STORAGE_KEY);
    localStorage.removeItem('leton_admin_orders_cache');
    resetSupabaseClient();
    setAuth({
      isAuthenticated: false,
      token: null,
      username: null,
      role: undefined,
      outletId: undefined,
      outletName: undefined,
    });
    showToast('Berhasil keluar dari Admin.', 'info');
  };

  // Change credentials (updates locally & on server)
  const changeCredentials = async (
    currentPassword: string,
    newUsername?: string,
    newPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth.isAuthenticated) {
        return { success: false, error: 'Silakan login terlebih dahulu' };
      }

      const storedPass = localStorage.getItem('leton_custom_pass');
      if (storedPass && currentPassword !== storedPass) {
        return { success: false, error: 'Password saat ini salah' };
      }

      const updatedUser = newUsername?.trim() || auth.username || DEFAULT_ADMIN_USERNAME;
      const updatedPass = newPassword || currentPassword;

      // 1. Update Supabase Auth user password if new password is provided and Supabase is configured
      if (newPassword && isSupabaseConfigured()) {
        try {
          const supabaseAuthRes = await updateSupabaseAuthPassword(newPassword);
          if (!supabaseAuthRes.success) {
            console.warn('Supabase auth.updateUser response:', supabaseAuthRes.error);
          }
        } catch (supabaseErr) {
          console.warn('Supabase auth.updateUser call error:', supabaseErr);
        }
      }

      localStorage.setItem('leton_custom_user', updatedUser);
      localStorage.setItem('leton_custom_pass', updatedPass);
      localStorage.setItem(USERNAME_STORAGE_KEY, updatedUser);

      setAuth((prev) => ({
        ...prev,
        username: updatedUser,
      }));

      fetch(getApiUrl('/api/auth/change-credentials'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ currentPassword, newUsername: updatedUser, newPassword: updatedPass }),
      }).catch(() => {});

      showToast('Kredensial login berhasil diperbarui!', 'success');
      return { success: true };
    } catch {
      return { success: false, error: 'Gagal memperbarui kredensial' };
    }
  };

  // Reset data to defaults and clear localStorage
  const resetToDefaults = async (): Promise<boolean> => {
    try {
      clearStoredContent();
      setData(initialLetonData);

      if (auth.token) {
        fetch(getApiUrl('/api/reset-defaults'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token}` },
        }).catch(() => {});
      }

      showToast('Data website berhasil direset ke konfigurasi awal.', 'info');
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ContentContext.Provider
      value={{
        data,
        isLoading,
        isInitialReady,
        isDataReady,
        completeLoading,
        isRealtimeConnected,
        lastUpdated,
        auth,
        toasts,
        showToast,
        dismissToast,
        saveData,
        updateData,
        saveMenuItem,
        deleteMenuItem,
        saveCategory,
        deleteCategory,
        saveCustomOption,
        deleteCustomOption,
        saveMasterSizes,
        saveCustomizationGroup,
        deleteCustomizationGroup,
        uploadImage,
        login,
        logout,
        changeCredentials,
        refreshData,
        resetToDefaults,
      }}
    >
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`custom-toast-notification pointer-events-auto p-4 rounded-xl shadow-2xl flex items-start gap-3 backdrop-blur-md border transition-all duration-300 transform translate-y-0 ${
              toast.type === 'success'
                ? 'toast-success bg-[#0B1524]/95 border-[#00E5FF]/40 text-slate-100 shadow-[#00E5FF]/10'
                : toast.type === 'error'
                ? 'toast-error bg-rose-950/95 border-rose-500/40 text-white shadow-rose-950/40'
                : 'toast-info bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/40'
            }`}
          >
            <div
              className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                toast.type === 'success' ? 'bg-[#00E5FF]' : toast.type === 'error' ? 'bg-rose-400' : 'bg-amber-400'
              }`}
            />
            <p className="text-sm font-medium leading-relaxed flex-1">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-white text-xs font-mono px-1 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};
