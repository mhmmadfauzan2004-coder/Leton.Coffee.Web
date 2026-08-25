import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LetonData, AuthState } from '../types';
import { initialLetonData } from '../data/initialData';

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

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<LetonData>(initialLetonData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const username = localStorage.getItem(USERNAME_STORAGE_KEY);
    return {
      isAuthenticated: Boolean(token),
      token,
      username: username || 'admin',
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

  // Fetch content from server
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/content', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.siteSettings) {
          setData(json);
          setLastUpdated(Date.now());
        }
      }
    } catch (err) {
      console.warn('Could not fetch initial content, using cached data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime Server-Sent Events listener
  useEffect(() => {
    refreshData();

    let eventSource: EventSource | null = null;
    let retryTimeout: any = null;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          setIsRealtimeConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.data && payload.data.siteSettings) {
              setData(payload.data);
              setLastUpdated(Date.now());
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        };

        eventSource.onerror = () => {
          setIsRealtimeConnected(false);
          eventSource?.close();
          // Retry connection after 4 seconds
          retryTimeout = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.warn('SSE connection failed:', err);
      }
    }

    connectSSE();

    // Secondary background periodic check as fallback
    const interval = setInterval(() => {
      refreshData();
    }, 15000);

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(interval);
    };
  }, [refreshData]);

  // Check auth validity on mount
  useEffect(() => {
    if (auth.token) {
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
        .then((res) => res.json())
        .then((result) => {
          if (!result.isAuthenticated) {
            logout();
          }
        })
        .catch(() => {});
    }
  }, [auth.token]);

  // Save content to backend
  const saveData = async (newData: LetonData): Promise<boolean> => {
    try {
      if (!auth.token) {
        showToast('Sesi login telah berakhir. Silakan login kembali.', 'error');
        logout();
        return false;
      }

      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(newData),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setData(newData);
        setLastUpdated(Date.now());
        showToast('Perubahan berhasil disimpan & disinkronkan secara real-time!', 'success');
        return true;
      } else {
        showToast(json.error || 'Gagal menyimpan perubahan. Silakan coba lagi.', 'error');
        return false;
      }
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('Koneksi terputus saat menyimpan data.', 'error');
      return false;
    }
  };

  // Upload image to server
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!auth.token) {
        showToast('Sesi tidak valid untuk upload gambar.', 'error');
        return null;
      }

      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && json.url) {
        showToast('Foto berhasil diupload!', 'success');
        return json.url;
      } else {
        showToast(json.error || 'Gagal mengupload gambar.', 'error');
        return null;
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast('Terjadi kesalahan jaringan saat upload foto.', 'error');
      return null;
    }
  };

  // Login
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
        localStorage.setItem(USERNAME_STORAGE_KEY, json.username);
        setAuth({
          isAuthenticated: true,
          token: json.token,
          username: json.username,
        });
        showToast(`Selamat datang, ${json.username}!`, 'success');
        return { success: true };
      } else {
        return { success: false, error: json.error || 'Username atau password salah' };
      }
    } catch {
      return { success: false, error: 'Gagal terhubung ke server autentikasi' };
    }
  };

  // Logout
  const logout = () => {
    if (auth.token) {
      fetch('/api/auth/logout', {
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
    showToast('Berhasil logout dari Admin CMS.', 'info');
  };

  // Change credentials
  const changeCredentials = async (
    currentPassword: string,
    newUsername?: string,
    newPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth.token) {
        return { success: false, error: 'Silakan login terlebih dahulu' };
      }

      const res = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ currentPassword, newUsername, newPassword }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (json.token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
          localStorage.setItem(USERNAME_STORAGE_KEY, json.username);
          setAuth({
            isAuthenticated: true,
            token: json.token,
            username: json.username,
          });
        }
        showToast('Kredensial login berhasil diperbarui!', 'success');
        return { success: true };
      } else {
        return { success: false, error: json.error || 'Gagal mengganti kredensial' };
      }
    } catch {
      return { success: false, error: 'Kesalahan saat menghubungi server' };
    }
  };

  // Reset data to defaults
  const resetToDefaults = async (): Promise<boolean> => {
    try {
      if (!auth.token) return false;
      const res = await fetch('/api/reset-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(initialLetonData);
        showToast('Data website berhasil direset ke konfigurasi awal.', 'info');
        return true;
      }
      return false;
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
