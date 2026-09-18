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
import { SalesReportManager } from './SalesReportManager';
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
  TrendingUp,
  Boxes,
  ShieldCheck,
  Building2,
  Lock,
  Search,
  Calendar,
  Coffee,
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

  useEffect(() => {
    if (isOutletAdmin && !['orders', 'stock', 'dashboard'].includes(activeTab)) {
      setActiveTab('orders');
    }
  }, [isOutletAdmin, activeTab]);

  const mainSystemItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'sales', label: 'LAPORAN SALES', icon: TrendingUp },
    { id: 'orders', label: 'AUDIT PESANAN', icon: ShoppingBag },
    { id: 'stock', label: 'KONTROL STOK', icon: Boxes },
    { id: 'menu', label: 'MENU & KATEGORI', icon: UtensilsCrossed },
  ];

  const contentItems = [
    { id: 'home', label: 'HOME / HERO', icon: Home },
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
          {activeTab === 'orders' && <OrderManager />}
          {activeTab === 'stock' && <StockManager />}
          {activeTab === 'home' && !isOutletAdmin && <HomeEditor />}
          {activeTab === 'chapter-5' && !isOutletAdmin && (
            <ChapterEditor chapterId="chapter-5" />
          )}
          {activeTab === 'chapter-6' && !isOutletAdmin && (
            <ChapterEditor chapterId="chapter-6" />
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
    </div>
  );
};
