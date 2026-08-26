import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LetonData, AuthState } from '../types';
import { initialLetonData } from '../data/initialData';
import {
  loadStoredContent,
  saveStoredContent,
  clearStoredContent,
  hasStoredContent,
  sanitizeLoadedData,
  LETON_STORAGE_KEY,
} from '../utils/storage';
import { getApiUrl } from '../utils/api';
import {
  fetchContentFromSupabase,
  saveContentToSupabase,
  uploadImageToSupabase,
  subscribeToSupabaseRealtime,
  isSupabaseConfigured,
  SUPABASE_STORAGE_BUCKET,
} from '../utils/supabase';

interface ToastInfo {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ContentContextType {
  data: LetonData;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  lastUpdated: number;
  auth: AuthState;
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  saveData: (newData: LetonData) => Promise<boolean>;
  uploadImage: (file: File) => Promise<string | null>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changeCredentials: (currentPassword: string, newUsername?: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
  resetToDefaults: () => Promise<boolean>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'leton_admin_token';
const USERNAME_STORAGE_KEY = 'leton_admin_user';

// Local hardcoded default credentials
export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'LetonAdmin2026!';

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize data strictly from localStorage first (or fallback to initialLetonData if localStorage is empty)
  const [data, setData] = useState<LetonData>(() => {
    return loadStoredContent();
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Automatically sync any data state changes to LocalStorage immediately
  useEffect(() => {
    if (data && data.siteSettings) {
      saveStoredContent(data);
    }
  }, [data]);

  const [auth, setAuth] = useState<AuthState>(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    const username = typeof window !== 'undefined' ? localStorage.getItem(USERNAME_STORAGE_KEY) : null;
    return {
      isAuthenticated: Boolean(token),
      token: token || null,
      username: username || DEFAULT_ADMIN_USERNAME,
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

  // Fetch content from Supabase (primary) or server API and hydrate state
  const refreshData = useCallback(async () => {
    try {
      // 1. Try Supabase database first
      const supabaseData = await fetchContentFromSupabase();
      if (supabaseData && supabaseData.siteSettings) {
        const sanitizedData = sanitizeLoadedData(supabaseData);
        setData(sanitizedData);
        saveStoredContent(sanitizedData);
        setLastUpdated(Date.now());
        setIsLoading(false);
        return;
      }

      // 2. Fallback to Express backend API
      const res = await fetch(getApiUrl('/api/content'), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.siteSettings) {
          const sanitizedServerData = sanitizeLoadedData(json);
          setData(sanitizedServerData);
          saveStoredContent(sanitizedServerData);
          setLastUpdated(Date.now());
        }
      }
    } catch (err) {
      console.warn('Network sync notice (using local cache):', err);
    } finally {
      setIsLoading(false);
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
        setData(liveData);
        saveStoredContent(liveData);
        setLastUpdated(Date.now());
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
            console.error('Error parsing SSE event:', err);
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          retryTimeout = setTimeout(connectSSE, 10000);
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

  // Save content permanently to Supabase Database, server API, and local storage cache
  const saveData = async (newData: LetonData): Promise<boolean> => {
    try {
      if (!auth.isAuthenticated) {
        showToast('Sesi login telah berakhir. Silakan login kembali.', 'error');
        logout();
        return false;
      }

      const sanitized = sanitizeLoadedData(newData);

      // 1. Save directly to Supabase Database (Primary)
      let supabaseSaved = false;
      const supabaseRes = await saveContentToSupabase(sanitized);
      if (supabaseRes.success) {
        supabaseSaved = true;
      }

      // 2. Also send to Express backend API (Secondary fallback)
      let serverSaved = false;
      try {
        const res = await fetch(getApiUrl('/api/content'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token || 'leton_local_token'}`,
          },
          body: JSON.stringify(sanitized),
        });

        const json = await res.json().catch(() => ({ success: true }));
        if (res.ok && json.success) {
          serverSaved = true;
        }
      } catch (networkErr) {
        // Optional backend fallback notice
      }

      // 3. Update local state and storage cache
      setData(sanitized);
      saveStoredContent(sanitized);
      setLastUpdated(Date.now());

      if (supabaseSaved) {
        showToast('Perubahan berhasil disimpan permanen ke Supabase Database & tersinkron Realtime!', 'success');
      } else if (serverSaved) {
        showToast('Perubahan berhasil disimpan permanen ke server backend!', 'success');
      } else {
        showToast('Perubahan disimpan di browser.', 'info');
      }
      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('Gagal menyimpan data.', 'error');
      return false;
    }
  };

  // Upload image to Supabase Storage Bucket ('leton-images') with fallback to server
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!auth.isAuthenticated) {
        showToast('Sesi tidak valid untuk upload gambar. Silakan login terlebih dahulu.', 'error');
        return null;
      }

      // 1. Try uploading to Supabase Storage ('leton-images' bucket)
      const supabaseUpload = await uploadImageToSupabase(file);
      if (supabaseUpload.success && supabaseUpload.url) {
        showToast('Foto berhasil diupload ke Supabase Storage!', 'success');
        return supabaseUpload.url;
      }

      // 2. Fallback to Express backend disk storage
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(getApiUrl('/api/upload-image'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token || 'leton_local_token'}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && (json.url || json.fullUrl)) {
        showToast('Foto berhasil diupload ke server!', 'success');
        return json.url || json.fullUrl;
      } else {
        const errorMsg = supabaseUpload.error || json.error || 'Gagal mengupload foto.';
        showToast(errorMsg, 'error');
        return null;
      }
    } catch (err: any) {
      console.warn('Upload error:', err);
      showToast('Terjadi kesalahan saat upload foto. Pastikan koneksi dan Supabase Storage aktif.', 'error');
      return null;
    }
  };

  // Local Hardcoded Login with immediate feedback
  const login = async (inputUser: string, inputPass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedUser = inputUser.trim();
    
    // Check against local hardcoded credentials
    const isHardcodedValid =
      (trimmedUser === DEFAULT_ADMIN_USERNAME || trimmedUser.toLowerCase() === 'admin') &&
      inputPass === DEFAULT_ADMIN_PASSWORD;

    // Also check if custom local credentials match
    const storedUser = localStorage.getItem('leton_custom_user');
    const storedPass = localStorage.getItem('leton_custom_pass');
    const isCustomValid = Boolean(storedUser && storedPass && trimmedUser === storedUser && inputPass === storedPass);

    if (isHardcodedValid || isCustomValid) {
      const token = `leton_local_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const activeUsername = isCustomValid ? storedUser! : DEFAULT_ADMIN_USERNAME;

      // Store in localStorage for persistent session
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USERNAME_STORAGE_KEY, activeUsername);

      // Instantly update Auth state to render CMS Dashboard
      setAuth({
        isAuthenticated: true,
        token,
        username: activeUsername,
      });

      // Synchronize with server in background if available
      fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: activeUsername, password: inputPass }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d && d.token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, d.token);
            setAuth((prev) => ({ ...prev, token: d.token }));
          }
        })
        .catch(() => {});

      showToast(`Selamat datang di CMS Leton Coffee, ${activeUsername}!`, 'success');
      return { success: true };
    }

    return {
      success: false,
      error: 'Password atau Username salah, silakan coba lagi.',
    };
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
    setAuth({
      isAuthenticated: false,
      token: null,
      username: null,
    });
    showToast('Berhasil keluar dari Admin CMS.', 'info');
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

      const storedPass = localStorage.getItem('leton_custom_pass') || DEFAULT_ADMIN_PASSWORD;
      if (currentPassword !== storedPass && currentPassword !== DEFAULT_ADMIN_PASSWORD) {
        return { success: false, error: 'Password saat ini salah' };
      }

      const updatedUser = newUsername?.trim() || auth.username || DEFAULT_ADMIN_USERNAME;
      const updatedPass = newPassword || currentPassword;

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
        isRealtimeConnected,
        lastUpdated,
        auth,
        toasts,
        showToast,
        dismissToast,
        saveData,
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
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl flex items-start gap-3 backdrop-blur-md border transition-all duration-300 transform translate-y-0 ${
              toast.type === 'success'
                ? 'bg-[#0B1524]/95 border-[#00E5FF]/40 text-slate-100 shadow-[#00E5FF]/10'
                : toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/40 text-white shadow-rose-950/40'
                : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/40'
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
