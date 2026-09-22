import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { DashboardOverview } from './DashboardOverview';
import { HomeEditor } from './HomeEditor';
import { ChapterEditor } from './ChapterEditor';
import { LetGoEditor } from './LetGoEditor';
import { OpenBoothEditor } from './OpenBoothEditor';
import { MenuManager } from './MenuManager';
import { AboutEditor } from './AboutEditor';
import { StorySliderManager } from './StorySliderManager';
import { BaristaManager } from './BaristaManager';
import { ContactEditor } from './ContactEditor';
import { SettingsEditor } from './SettingsEditor';
import { QrisPaymentEditor } from './QrisPaymentEditor';
import { OrderManager } from './OrderManager';
import { StockManager } from './StockManager';
import { SalesReportManager } from './SalesReportManager';
import { LoyaltyManager } from './LoyaltyManager';
import { CustomerManager } from './CustomerManager';
import {
  isPushSupported,
  getPushSubscription,
  subscribeAdminPush,
  unsubscribeAdminPush,
  testAdminPush,
  fetchPushDebugInfo
} from '../../utils/pushSubscription';
import {
  LayoutDashboard,
  Home,
  MapPin,
  Truck,
  Store,
  UtensilsCrossed,
  Users,
  UserCheck,
  Info,
  Images,
  Phone,
  Settings,
  QrCode,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Radio,
  ShoppingBag,
  TrendingUp,
  Boxes,
  ShieldCheck,
  Building2,
  Lock,
  Search,
  Calendar,
  Coffee,
  Gift,
  Bell,
  BellOff,
} from 'lucide-react';

interface AdminLayoutProps {
  onBackToPublic: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToPublic }) => {
  const { data, auth, logout, isRealtimeConnected } = useContent();
  const isOutletAdmin = auth.role === 'outlet_admin';
  const assignedOutletName = auth.outletName || (isOutletAdmin ? 'Outlet Ditugaskan' : 'Semua Cabang');

  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash || '';
    if (hash.includes('tab=orders') || hash.includes('/orders') || hash.includes('orderId')) {
      return 'orders';
    }
    return isOutletAdmin ? 'orders' : 'dashboard';
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Auto-switch to orders tab when deep linked via Web Push notification click
  useEffect(() => {
    const handleUrlCheck = () => {
      const hash = window.location.hash || '';
      if (hash.includes('tab=orders') || hash.includes('/orders') || hash.includes('orderId')) {
        setActiveTab('orders');
      }
    };

    handleUrlCheck();
    window.addEventListener('hashchange', handleUrlCheck);
    window.addEventListener('popstate', handleUrlCheck);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        setActiveTab('orders');
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('hashchange', handleUrlCheck);
      window.removeEventListener('popstate', handleUrlCheck);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Web Push states
  const [isPushCapable, setIsPushCapable] = useState<boolean>(false);
  const [isPushActive, setIsPushActive] = useState<boolean>(false);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [showDebugModal, setShowDebugModal] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState<boolean>(false);

  const resolvedOutletId = auth.outletId || (
    auth.username?.toLowerCase().includes('sudirman') ? 'sudirman' :
    (auth.username?.toLowerCase().includes('kelakap') || auth.username?.toLowerCase().includes('ratusima')) ? 'kelakap_7' :
    auth.username?.toLowerCase().includes('letgo') ? 'letgo-mpp' :
    (isOutletAdmin ? 'sudirman' : 'all')
  );

  const handleOpenDebugModal = async () => {
    setShowDebugModal(true);
    setIsLoadingDebug(true);
    try {
      const data = await fetchPushDebugInfo();
      setDebugData(data);
    } catch (e: any) {
      setDebugData({ error: e?.message || 'Gagal memuat log debug' });
    } finally {
      setIsLoadingDebug(false);
    }
  };

  const handleTestPush = async () => {
    if (isTestingPush) return;
    setIsTestingPush(true);
    setTestPushStatus(null);

    try {
      const res = await testAdminPush(auth.username, resolvedOutletId, auth.role);
      if (res.success) {
        setTestPushStatus('Test berhasil dikirim');
        alert('Test berhasil dikirim! Periksa perangkat Anda (pastikan browser di-background atau ditutup untuk melihat system notification).');
        setTimeout(() => setTestPushStatus(null), 3500);
      } else {
        alert(`Test gagal dikirim:\n${res.error || 'Terjadi kesalahan sistem.'}`);
        setTestPushStatus(null);
      }
    } catch (err: any) {
      alert(`Test gagal:\n${err?.message || String(err)}`);
      setTestPushStatus(null);
    } finally {
      setIsTestingPush(false);
    }
  };

  useEffect(() => {
    const checkPushSupport = async () => {
      const capable = isPushSupported();
      setIsPushCapable(capable);
      if (capable) {
        const sub = await getPushSubscription();
        setIsPushActive(!!sub && Notification.permission === 'granted');
        
        // Auto-refresh/register if already active to ensure backend subscription is up to date with correct outlet
        if (sub && Notification.permission === 'granted' && auth.username) {
          try {
            await subscribeAdminPush(auth.username, resolvedOutletId, auth.role);
          } catch (e) {
            console.warn('[WebPush] Auto-refresh subscription failed:', e);
          }
        }
      }
    };
    checkPushSupport();
  }, [auth.username, isOutletAdmin, auth.outletId, resolvedOutletId, auth.role]);

  const handleTogglePushNotifications = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WebPush UI] Notification toggle button triggered via event type:', e.type);
    
    if (isSubscribing) {
      console.warn('[WebPush UI] Already processing subscription. Ignoring trigger.');
      return;
    }

    setIsSubscribing(true);
    try {
      if (isPushActive) {
        console.log('[WebPush UI] User requested unsubscription.');
        const success = await unsubscribeAdminPush();
        if (success) {
          setIsPushActive(false);
          alert('Notifikasi pesanan dinonaktifkan untuk perangkat ini.');
        } else {
          alert('Gagal mematikan notifikasi. Silakan coba lagi.');
        }
      } else {
        console.log('[WebPush UI] User requested subscription. Checking browser capabilities...');
        const res = await subscribeAdminPush(auth.username || 'Admin', resolvedOutletId, auth.role);
        
        console.log('[WebPush UI] Subscription result response:', res);
        if (res.success) {
          setIsPushActive(true);
          alert('Selamat! Perangkat Anda berhasil didaftarkan. Anda akan menerima notifikasi sistem untuk setiap pesanan baru!');
        } else {
          if (res.error === 'PERMISSION_DENIED') {
            alert('Izin Notifikasi Ditolak!\n\nUntuk menerima notifikasi pesanan baru, Anda harus mengizinkan permission notifikasi di HP Anda:\n1. Buka pengaturan browser atau ikon gembok di sebelah URL.\n2. Ubah Izin Notifikasi menjadi "Izinkan/Allow".');
          } else {
            alert(`Gagal mengaktifkan notifikasi:\n${res.error || 'Terjadi kesalahan sistem.'}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[WebPush UI] Error handling toggle event:', err);
      alert(`Error: ${err?.message || String(err)}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  useEffect(() => {
    if (isOutletAdmin && !['orders', 'stock', 'dashboard'].includes(activeTab)) {
      setActiveTab('orders');
    }
  }, [isOutletAdmin, activeTab]);

  const mainSystemItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'sales', label: 'LAPORAN SALES', icon: TrendingUp },
    { id: 'orders', label: 'AUDIT PESANAN', icon: ShoppingBag },
    { id: 'customers', label: 'DATA CUSTOMER', icon: UserCheck },
    { id: 'stock', label: 'KONTROL STOK', icon: Boxes },
    { id: 'menu', label: 'MENU & KATEGORI', icon: UtensilsCrossed },
    { id: 'loyalty', label: 'LOYALTY / POINT', icon: Gift },
  ];

  const contentItems = [
    { id: 'home', label: 'HOME / HERO', icon: Home },
    { id: 'qris-payment', label: 'QRIS PAYMENT', icon: QrCode },
    { id: 'chapter-5', label: 'CHAPTER 5 (SUDIRMAN)', icon: MapPin },
    { id: 'chapter-6', label: 'CHAPTER 6 (KELAKAP)', icon: MapPin },
    { id: 'let-go', label: "LET'GO MOBILE", icon: Truck },
    { id: 'open-booth', label: 'LETON OPEN BOOTH', icon: Store },
    { id: 'baristas', label: 'TIM BARISTA', icon: Users },
    { id: 'about', label: 'ABOUT STORY', icon: Info },
    { id: 'story-slider', label: 'FOTO SLIDER STORY', icon: Images },
    { id: 'contact', label: 'KONTAK & FOOTER', icon: Phone },
    { id: 'settings', label: 'PENGATURAN & AKUN', icon: Settings },
  ];

  const outletAdminNavItems = [
    { id: 'orders', label: 'PESANAN MASUK', icon: ShoppingBag },
    { id: 'stock', label: 'KONTROL STOK', icon: Boxes },
    { id: 'dashboard', label: 'RINGKASAN OUTLET', icon: LayoutDashboard },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-[#172033] flex flex-col lg:flex-row">
      {/* ---------------------------------------------------- */}
      {/* SIDEBAR (Desktop)                                    */}
      {/* ---------------------------------------------------- */}
      <aside className="hidden lg:flex w-72 flex-col justify-between bg-white border-r border-[#E0F2FE] p-5 shrink-0 h-screen sticky top-0 shadow-[0_1px_12px_rgba(0,0,0,0.03)] z-30">
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Brand Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#E0F2FE]">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center font-display font-black text-xl shadow-sm">
              L
            </div>
            <div>
              <h1 className="font-display font-black text-base tracking-wider text-[#172033] uppercase leading-none">
                {data.siteSettings.brandName || 'LETON COFFEE'}
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-[#0284C7] uppercase font-bold block mt-1">
                DUMAI SPECIALTY COFFEE
              </span>
            </div>
          </div>

          {/* Active Role & Context Card */}
          <div className="p-3 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE]">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#E0F2FE] text-[#0284C7]">
                {isOutletAdmin ? 'OUTLET ADMIN' : 'SUPER ADMIN'}
              </span>
              <ShieldCheck className="w-4 h-4 text-[#0284C7]" />
            </div>
            <p className="text-xs font-bold text-[#172033] mt-2 truncate flex items-center gap-1.5">
              {isOutletAdmin ? <Building2 className="w-3.5 h-3.5 text-[#0284C7] shrink-0" /> : null}
              <span>{assignedOutletName}</span>
            </p>
            <p className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate">
              User: <strong className="text-[#172033]">{auth.username}</strong>
            </p>
          </div>

          {/* Real-time Status Badge */}
          <div className="p-2.5 rounded-xl bg-white border border-[#E0F2FE] flex items-center gap-2.5 shadow-sm">
            <Radio
              className={`w-3.5 h-3.5 ${
                isRealtimeConnected ? 'text-emerald-600 animate-pulse' : 'text-amber-500'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono font-bold text-[#172033] uppercase truncate">
                {isRealtimeConnected ? 'REALTIME SYNC AKTIF' : 'SYNC POLLING'}
              </p>
              <p className="text-[9px] text-[#64748B] truncate">Perubahan langsung tayang</p>
            </div>
          </div>

          {/* Background Push Notification Toggle Card */}
          <div className="p-2.5 rounded-xl bg-white border border-[#E0F2FE] shadow-sm space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#F0F7FF] text-[#0284C7] shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 font-medium">
                <p className="text-[10px] font-mono font-bold text-[#172033] uppercase">
                  BACKGROUND NOTIFICATION
                </p>
                {isPushCapable ? (
                  <p className="text-[10px] font-semibold mt-0.5">
                    {isPushActive ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Notifikasi aktif
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Belum aktif
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] font-semibold mt-0.5 text-red-500">
                    Tidak Didukung
                  </p>
                )}
              </div>
            </div>

            {isPushCapable ? (
              <div className="space-y-1.5">
                <button
                  disabled={isSubscribing}
                  onClick={handleTogglePushNotifications}
                  onTouchEnd={handleTogglePushNotifications}
                  className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPushActive
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-[#0284C7] text-white hover:bg-[#0369a1]'
                  }`}
                >
                  {isSubscribing ? 'Memproses...' : isPushActive ? 'Matikan Notifikasi' : 'Aktifkan Notifikasi'}
                </button>
                {isPushActive && (
                  <>
                    <button
                      disabled={isTestingPush}
                      onClick={handleTestPush}
                      className="w-full py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-sm"
                    >
                      {isTestingPush ? 'Mengirim...' : (testPushStatus || 'Tes Suara & Pop-up')}
                    </button>
                    <button
                      onClick={handleOpenDebugModal}
                      className="w-full py-1 px-2 rounded-lg text-[9px] font-semibold text-[#64748B] hover:text-[#0284C7] hover:bg-[#F0F7FF] transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Diagnostik Push Real Order
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {/iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? (
                  <button
                    onClick={() => setShowIosGuide(true)}
                    className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Instruksi iPhone / iOS
                  </button>
                ) : (
                  <p className="text-[9px] text-[#64748B] text-center italic">
                    Gunakan browser modern & HTTPS untuk mengaktifkan push.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          {isOutletAdmin ? (
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#64748B] font-bold px-2 block mb-1">
                MENU UTAMA OUTLET
              </span>
              {outletAdminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0284C7] text-white shadow-sm'
                        : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Sistem Utama */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-bold px-2 block mb-1">
                  SISTEM UTAMA
                </span>
                {mainSystemItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0284C7] text-white shadow-sm'
                          : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pengelolaan Konten */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-bold px-2 block mb-1">
                  PENGELOLAAN KONTEN
                </span>
                {contentItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0284C7] text-white shadow-sm'
                          : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outlet Live Network Indicator */}
          <div className="pt-2">
            <span className="text-[10px] font-mono uppercase text-[#64748B] font-bold px-2 block mb-1.5">
              OUTLET LIVE NETWORK
            </span>
            <div className="space-y-1.5 text-xs text-[#64748B]">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FBFF] border border-[#E0F2FE]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-[#172033]">Sudirman Hub</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">Online</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FBFF] border border-[#E0F2FE]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-[#172033]">Kelakap 7</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">Online</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FBFF] border border-[#E0F2FE]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-semibold text-[#172033]">Let'GO Express</span>
                </div>
                <span className="text-[10px] text-amber-600 font-mono font-bold">Standby</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E0F2FE] space-y-2">
          <button
            onClick={onBackToPublic}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Lihat Website Publik</span>
          </button>

          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-xs text-[#64748B] truncate">
              Masuk: <strong className="text-[#172033]">{auth.username}</strong>
            </span>
            <button
              onClick={logout}
              className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* MOBILE HEADER                                        */}
      {/* ---------------------------------------------------- */}
      <header className="lg:hidden bg-white border-b border-[#E0F2FE] p-4 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0284C7] flex items-center justify-center font-display font-black text-white text-base">
            L
          </div>
          <div>
            <h1 className="font-display font-black text-sm uppercase text-[#172033] leading-none">
              {data.siteSettings.brandName || 'LETON'}
            </h1>
            <span className="text-[9px] font-mono text-[#0284C7] uppercase font-bold">
              {isOutletAdmin ? 'OUTLET ADMIN' : 'SUPER ADMIN'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToPublic}
            className="px-2.5 py-1.5 rounded-lg bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] text-xs font-bold"
          >
            Web
          </button>
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="p-2 rounded-lg bg-[#F0F7FF] text-[#172033] border border-[#E0F2FE]"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white/95 backdrop-blur-xl flex flex-col p-6 overflow-y-auto animate-fadeIn">
          <div className="flex items-center justify-between pb-4 border-b border-[#E0F2FE]">
            <span className="font-display font-black text-base uppercase text-[#172033]">
              Menu Navigasi CMS
            </span>
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="p-2 text-[#64748B] hover:text-[#172033]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Background Push Notification Toggle Card (Mobile) */}
          <div className="mt-4 p-3 rounded-xl bg-white border border-[#E0F2FE] shadow-2xs space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#F0F7FF] text-[#0284C7] shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 font-medium">
                <p className="text-[10px] font-mono font-bold text-[#172033] uppercase">
                  BACKGROUND NOTIFICATION
                </p>
                {isPushCapable ? (
                  <p className="text-[10px] font-semibold mt-0.5">
                    {isPushActive ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Notifikasi aktif
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Belum aktif
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] font-semibold mt-0.5 text-red-500">
                    Tidak Didukung
                  </p>
                )}
              </div>
            </div>

            {isPushCapable ? (
              <div className="space-y-1.5">
                <button
                  disabled={isSubscribing}
                  onClick={handleTogglePushNotifications}
                  onTouchEnd={handleTogglePushNotifications}
                  className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPushActive
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-[#0284C7] text-white hover:bg-[#0369a1]'
                  }`}
                >
                  {isSubscribing ? 'Memproses...' : isPushActive ? 'Matikan Notifikasi' : 'Aktifkan Notifikasi'}
                </button>
                {isPushActive && (
                  <>
                    <button
                      disabled={isTestingPush}
                      onClick={handleTestPush}
                      className="w-full py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-sm"
                    >
                      {isTestingPush ? 'Mengirim...' : (testPushStatus || 'Tes Suara & Pop-up')}
                    </button>
                    <button
                      onClick={handleOpenDebugModal}
                      className="w-full py-1 px-2 rounded-lg text-[9px] font-semibold text-[#64748B] hover:text-[#0284C7] hover:bg-[#F0F7FF] transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Diagnostik Push Real Order
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {/iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? (
                  <button
                    onClick={() => setShowIosGuide(true)}
                    className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Instruksi iPhone / iOS
                  </button>
                ) : (
                  <p className="text-[9px] text-[#64748B] text-center italic">
                    Gunakan browser modern & HTTPS untuk mengaktifkan push.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="py-4 space-y-1">
            {(isOutletAdmin ? outletAdminNavItems : [...mainSystemItems, ...contentItems]).map(
              (item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${
                      isActive
                        ? 'bg-[#0284C7] text-white shadow-sm'
                        : 'text-[#64748B] hover:bg-[#F0F7FF] hover:text-[#172033]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              }
            )}
          </div>

          <div className="pt-4 border-t border-[#E0F2FE] mt-auto">
            <button
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>LOGOUT DARI SISTEM</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                    */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 min-w-0 bg-[#F8FBFF] flex flex-col min-h-screen">
        {/* Desktop Sticky Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-md border-b border-[#E0F2FE] sticky top-0 z-20 shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <span>Leton HQ Dumai</span>
              <span>/</span>
              <span className="text-[#0284C7] font-bold">
                {isOutletAdmin ? 'Outlet Console' : 'Executive Overview'}
              </span>
            </div>

            <div className="h-4 w-[1px] bg-[#E0F2FE] mx-2" />

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sudirman Live</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Kelakap 7 Live</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBackToPublic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] text-xs font-bold transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Lihat Website</span>
            </button>
          </div>
        </header>

        {/* View Component Render */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {activeTab === 'dashboard' && (
            <DashboardOverview onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'sales' && !isOutletAdmin && <SalesReportManager />}
          {activeTab === 'customers' && !isOutletAdmin && <CustomerManager />}
          {activeTab === 'loyalty' && !isOutletAdmin && <LoyaltyManager />}
          {activeTab === 'orders' && <OrderManager />}
          {activeTab === 'stock' && <StockManager />}
          {activeTab === 'home' && !isOutletAdmin && <HomeEditor />}
          {activeTab === 'qris-payment' && !isOutletAdmin && <QrisPaymentEditor />}
          {activeTab === 'chapter-5' && !isOutletAdmin && (
            <ChapterEditor branchId="chapter-5" title="Chapter 05 — Urban Hub" />
          )}
          {activeTab === 'chapter-6' && !isOutletAdmin && (
            <ChapterEditor branchId="chapter-6" title="Chapter 06 — Open Air Spot" />
          )}
          {activeTab === 'let-go' && !isOutletAdmin && <LetGoEditor />}
          {activeTab === 'open-booth' && !isOutletAdmin && <OpenBoothEditor />}
          {activeTab === 'menu' && !isOutletAdmin && <MenuManager />}
          {activeTab === 'baristas' && !isOutletAdmin && <BaristaManager />}
          {activeTab === 'about' && !isOutletAdmin && <AboutEditor />}
          {activeTab === 'story-slider' && !isOutletAdmin && <StorySliderManager />}
          {activeTab === 'contact' && !isOutletAdmin && <ContactEditor />}
          {activeTab === 'settings' && !isOutletAdmin && <SettingsEditor />}
        </div>
      </main>

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-[#E0F2FE]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0F2FE]">
              <h3 className="font-display font-black text-sm text-[#172033] tracking-wider uppercase flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#0284C7]" />
                Web Push di iPhone
              </h3>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="my-4 text-xs space-y-3 text-[#172033] leading-relaxed">
              <p className="font-semibold text-[#0284C7]">
                Ikuti 7 langkah mudah untuk mengaktifkan notifikasi pesanan baru di perangkat iOS/iPhone Anda:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-[#475569] pl-1 font-medium">
                <li>Buka website Leton Coffee di browser Safari.</li>
                <li>Pilih tombol <strong className="text-[#172033]">Share / Bagikan</strong> di bagian bawah menu Safari.</li>
                <li>Pilih menu <strong className="text-[#172033]">"Add to Home Screen / Tambahkan ke Layar Utama"</strong>.</li>
                <li>Buka aplikasi Leton Coffee baru dari <strong className="text-[#172033]">Home Screen</strong> Anda.</li>
                <li>Login kembali sebagai <strong className="text-[#172033]">Admin</strong>.</li>
                <li>Tekan tombol <strong className="text-[#172033]">"Aktifkan Notifikasi"</strong> di sidebar ini.</li>
                <li>Pilih <strong className="text-[#172033]">"Izinkan / Allow"</strong> ketika browser meminta izin notifikasi.</li>
              </ol>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-[#0284C7] hover:bg-[#0369a1] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Push Diagnostics Modal */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#E0F2FE] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0F2FE]">
              <h3 className="font-display font-black text-sm text-[#172033] tracking-wider uppercase flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#0284C7]" />
                Diagnostik Push Real Order
              </h3>
              <button
                onClick={() => setShowDebugModal(false)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 overflow-y-auto flex-1 space-y-3 pr-1 text-xs">
              {isLoadingDebug ? (
                <div className="py-8 text-center text-[#64748B] animate-pulse font-medium">
                  Memuat log diagnostik dari server...
                </div>
              ) : debugData ? (
                <>
                  <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] space-y-1 font-mono text-[11px]">
                    <div className="font-bold text-[#0284C7] border-b border-[#E0F2FE] pb-1 uppercase">
                      STATUS REAL ORDER PUSH TERAKHIR
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#64748B]">Target Subscription:</span>
                      <strong className="text-[#172033]">{debugData.summary?.targetSubscription ?? 0} perangkat</strong>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#64748B]">sendNotification() dipanggil:</span>
                      <strong className={debugData.summary?.sendNotificationCalled === 'YES' ? 'text-emerald-600' : 'text-amber-600'}>
                        {debugData.summary?.sendNotificationCalled ?? 'NO'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#64748B]">Provider Response:</span>
                      <strong className="text-[#172033]">{debugData.summary?.providerResponse ?? 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#64748B]">Push Accepted:</span>
                      <strong className={debugData.summary?.pushAccepted === 'YES' ? 'text-emerald-600' : 'text-rose-600'}>
                        {debugData.summary?.pushAccepted ?? 'NO'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#64748B]">Error:</span>
                      <span className="text-[#172033] text-right truncate max-w-[200px]" title={debugData.summary?.error}>
                        {debugData.summary?.error ?? 'None'}
                      </span>
                    </div>
                  </div>

                  {debugData.lastRealOrderPush && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] space-y-1">
                      <div className="font-bold text-gray-700">Detail Pesanan Terakhir:</div>
                      <div>No Order: #{debugData.lastRealOrderPush.orderNumber}</div>
                      <div>Outlet: {debugData.lastRealOrderPush.outletId}</div>
                      <div>Waktu: {new Date(debugData.lastRealOrderPush.timestamp).toLocaleString('id-ID')}</div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] space-y-1.5">
                    <div className="font-bold text-gray-700 flex justify-between">
                      <span>Perangkat Admin Terdaftar:</span>
                      <span className="text-[#0284C7]">{debugData.activeSubscriptionsCount ?? 0} perangkat</span>
                    </div>
                    {debugData.activeSubscriptions && debugData.activeSubscriptions.length > 0 ? (
                      <ul className="space-y-1 divide-y divide-gray-200">
                        {debugData.activeSubscriptions.map((s: any, idx: number) => (
                          <li key={idx} className="pt-1 text-[10px]">
                            <strong className="text-[#172033]">{s.username}</strong> ({s.outletId}) • {s.endpointMasked}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic text-[10px]">Belum ada perangkat yang terdaftar di database.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-gray-500">Tidak ada data diagnostik.</div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E0F2FE] flex gap-2">
              <button
                onClick={handleOpenDebugModal}
                disabled={isLoadingDebug}
                className="flex-1 py-2 bg-[#F0F7FF] text-[#0284C7] hover:bg-[#E0F2FE] rounded-xl text-xs font-bold uppercase transition-all"
              >
                {isLoadingDebug ? 'Memuat...' : 'Refresh Status'}
              </button>
              <button
                onClick={() => setShowDebugModal(false)}
                className="flex-1 py-2 bg-[#0284C7] hover:bg-[#0369a1] text-white rounded-xl text-xs font-bold uppercase transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
