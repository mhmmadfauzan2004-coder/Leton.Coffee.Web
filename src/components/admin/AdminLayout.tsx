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
import { OrderManager } from './OrderManager';
import { StockManager } from './StockManager';
import {
  LayoutDashboard,
  Home,
  MapPin,
  Truck,
  Store,
  UtensilsCrossed,
  Users,
  Info,
  Images,
  Phone,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Radio,
  ShoppingBag,
  Boxes,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Lock,
} from 'lucide-react';

interface AdminLayoutProps {
  onBackToPublic: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToPublic }) => {
  const { data, auth, logout, isRealtimeConnected } = useContent();
  const isOutletAdmin = auth.role === 'outlet_admin';
  const assignedOutletName = auth.outletName || (isOutletAdmin ? 'Outlet Ditugaskan' : 'Semua Cabang');

  const [activeTab, setActiveTab] = useState<string>(isOutletAdmin ? 'orders' : 'dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Fallback to orders if outlet admin somehow lands on restricted tab
  useEffect(() => {
    if (isOutletAdmin && !['orders', 'stock', 'dashboard'].includes(activeTab)) {
      setActiveTab('orders');
    }
  }, [isOutletAdmin, activeTab]);

  const superAdminNavItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'orders', label: 'PESANAN MASUK', icon: ShoppingBag },
    { id: 'home', label: 'HOME / HERO', icon: Home },
    { id: 'chapter-5', label: 'CHAPTER 5', icon: MapPin },
    { id: 'chapter-6', label: 'CHAPTER 6', icon: MapPin },
    { id: 'let-go', label: "LET'GO", icon: Truck },
    { id: 'open-booth', label: 'LETON OPEN BOOTH', icon: Store },
    { id: 'menu', label: 'MENU & KATEGORI', icon: UtensilsCrossed },
    { id: 'stock', label: 'KONTROL STOK', icon: Boxes },
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

  const navigationItems = isOutletAdmin ? outletAdminNavItems : superAdminNavItems;

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col lg:flex-row">
      {/* ---------------------------------------------------- */}
      {/* SIDEBAR (Desktop)                                    */}
      {/* ---------------------------------------------------- */}
      <aside className="hidden lg:flex w-72 flex-col justify-between bg-slate-950/90 border-r border-slate-800 p-6 shrink-0 h-screen sticky top-0">
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center font-display font-black text-black text-xl shadow-lg shadow-cyan-500/20">
                L
              </div>
              <div>
                <h1 className="font-display font-black text-base tracking-wider text-white uppercase leading-none">
                  {data.siteSettings.brandName}
                </h1>
                <span className="text-[10px] font-mono tracking-widest text-[#00E5FF] uppercase font-semibold block mt-1">
                  ADMIN CMS v2.6
                </span>
              </div>
            </div>
          </div>

          {/* Active Role & Outlet Context Card */}
          <div
            className={`p-3.5 rounded-2xl border ${
              isOutletAdmin
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-cyan-950/20 border-[#00E5FF]/30 text-cyan-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider ${
                  isOutletAdmin
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#00E5FF] text-slate-950'
                }`}
              >
                {isOutletAdmin ? 'OUTLET ADMIN' : 'SUPER ADMIN'}
              </span>
              {isOutletAdmin ? (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E5FF]" />
              )}
            </div>
            <p className="text-xs font-bold text-white mt-2 truncate flex items-center gap-1.5">
              {isOutletAdmin ? <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : null}
              <span>{assignedOutletName}</span>
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              User: <span className="text-slate-200">{auth.username}</span>
            </p>
          </div>

          {/* Real-time Status Badge */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 flex items-center gap-2.5">
            <Radio
              className={`w-4 h-4 ${
                isRealtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono font-bold text-white uppercase truncate">
                {isRealtimeConnected ? 'REALTIME SYNC AKTIF' : 'SYNC POLLING'}
              </p>
              <p className="text-[9px] text-slate-400 truncate">Perubahan langsung tayang</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  id={`admin-nav-${item.id}`}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-display font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00E5FF] text-slate-950 shadow-md shadow-[#00E5FF]/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-slate-800/80 space-y-2">
          <button
            onClick={onBackToPublic}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Lihat Website Publik</span>
          </button>

          <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-[11px] font-mono text-slate-400 truncate">
              User: <span className="text-white font-bold">{auth.username}</span>
            </span>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
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
      <header className="lg:hidden bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00E5FF] flex items-center justify-center font-display font-black text-black text-base">
            L
          </div>
          <div>
            <span className="font-display font-bold text-sm text-white uppercase block leading-none">
              {data.siteSettings.brandName} CMS
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  isOutletAdmin
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {isOutletAdmin ? assignedOutletName : 'SUPER ADMIN'}
              </span>
              <span className="text-[9px] font-mono text-[#00E5FF]">
                {isRealtimeConnected ? '● LIVE' : '○ SYNC'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToPublic}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3 h-3 text-[#00E5FF]" />
            <span>Website</span>
          </button>
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[#070b12]/98 backdrop-blur-xl pt-20 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl border ${
                isOutletAdmin
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-cyan-950/30 border-[#00E5FF]/40 text-cyan-200'
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase block">
                {isOutletAdmin ? 'OUTLET ADMIN' : 'SUPER ADMIN'}
              </span>
              <p className="text-xs font-bold text-white mt-0.5">{assignedOutletName}</p>
            </div>

            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-display font-bold text-sm tracking-wider uppercase ${
                      isActive
                        ? 'bg-[#00E5FF] text-slate-950 font-black'
                        : 'text-slate-300 hover:text-white border-b border-slate-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={onBackToPublic}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold"
            >
              Ke Website Publik
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                    */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 p-4 sm:p-8 lg:p-12 overflow-y-auto max-w-7xl">
        {/* Guard for Outlet Admin attempting unauthorized tab */}
        {isOutletAdmin && !['orders', 'stock', 'dashboard'].includes(activeTab) ? (
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-rose-500/40 text-center max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="font-display font-black text-xl text-white uppercase">Akses Ditolak</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Role Outlet Admin ({assignedOutletName}) hanya diizinkan mengelola Pesanan Masuk, Kontrol Stok, dan Ringkasan Outlet. Pengaturan CMS global dikelola oleh Super Admin.
            </p>
            <button
              onClick={() => setActiveTab('orders')}
              className="mt-5 px-5 py-2.5 rounded-xl bg-[#00E5FF] text-slate-950 font-display font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
            >
              Buka Pesanan Masuk
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardOverview onNavigateTab={handleSelectTab} />}
            {activeTab === 'orders' && <OrderManager />}
            {activeTab === 'stock' && <StockManager />}
            {!isOutletAdmin && (
              <>
                {activeTab === 'home' && <HomeEditor />}
                {activeTab === 'chapter-5' && (
                  <ChapterEditor branchId="chapter-5" title="CHAPTER 5 (DUMAI SUDIRMAN)" />
                )}
                {activeTab === 'chapter-6' && (
                  <ChapterEditor branchId="chapter-6" title="CHAPTER 6 (DUMAI RATU SIMA)" />
                )}
                {activeTab === 'let-go' && <LetGoEditor />}
                {activeTab === 'open-booth' && <OpenBoothEditor />}
                {activeTab === 'menu' && <MenuManager />}
                {activeTab === 'baristas' && <BaristaManager />}
                {activeTab === 'about' && <AboutEditor />}
                {activeTab === 'story-slider' && <StorySliderManager />}
                {activeTab === 'contact' && <ContactEditor />}
                {activeTab === 'settings' && <SettingsEditor />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};
