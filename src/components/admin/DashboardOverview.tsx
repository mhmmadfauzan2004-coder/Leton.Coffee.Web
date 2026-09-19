import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import {
  isSupabaseConfigured,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_TABLE_NAME,
} from '../../utils/supabase';
import {
  UtensilsCrossed,
  Layers,
  MapPin,
  Truck,
  Store,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Users,
  Database,
  Radio,
  CheckCircle2,
  ShoppingBag,
  TrendingUp,
  Boxes,
  Building2,
  QrCode,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateTab }) => {
  const { data, auth, isRealtimeConnected, lastUpdated, refreshData } = useContent();
  const { menuItems, menuCategories, branches, baristas = [] } = data;
  const isOutletAdmin = auth.role === 'outlet_admin';
  const assignedOutletName = auth.outletName || (isOutletAdmin ? 'Outlet Ditugaskan' : 'Semua Cabang');

  // If Outlet Admin, render dedicated operational dashboard
  if (isOutletAdmin) {
    return (
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
                <Building2 className="w-3.5 h-3.5" />
                <span>OUTLET OPERATIONAL PANEL</span>
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight uppercase">
                {assignedOutletName}
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Anda masuk sebagai Administrator Cabang. Kelola pesanan pelanggan yang masuk ke outlet ini, verifikasi bukti bayar QRIS, dan kontrol stok ketersediaan menu secara langsung.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => onNavigateTab('orders')}
                className="px-5 py-2.5 rounded-xl bg-[#00E5FF] text-slate-950 text-xs font-display font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 hover:opacity-90 transition-opacity cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Buka Pesanan Masuk</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                Outlet Bertugas
              </span>
              <p className="text-base sm:text-lg font-display font-bold text-amber-400 mt-1 truncate">
                {assignedOutletName}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">Data Terisolasi</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                Katalog Menu
              </span>
              <p className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
                {menuItems.length} Produk
              </p>
              <span className="text-[10px] text-slate-500 font-mono">Dapat dikontrol ketersediaannya</span>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-[#00E5FF]">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                Realtime Orders
              </span>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="font-display font-bold text-xs text-white">
                  {isRealtimeConnected ? 'TERHUBUNG LIVE' : 'SYNC POLLING'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">Notifikasi Suara Aktif</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Operational Quick Actions for Outlet Admin */}
        <div>
          <h3 className="font-display font-black text-lg text-white uppercase tracking-tight mb-4">
            MENU KERJA HARIAN OUTLET
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => onNavigateTab('orders')}
              className="p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-[#00E5FF]/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-[#00E5FF] group-hover:translate-x-1 transition-all" />
                </div>
                <h4 className="font-display font-black text-base text-white group-hover:text-[#00E5FF] transition-colors uppercase">
                  PESANAN MASUK & KASIR REALTIME
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Buka layar kasir utama: pantau pesanan baru dengan notifikasi suara denting, verifikasi bukti transfer QRIS, tolak pembayaran tidak valid, proses peracikan barista, dan selesaikan transaksi take away / dine in.
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('stock')}
              className="p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h4 className="font-display font-black text-base text-white group-hover:text-amber-400 transition-colors uppercase">
                  KONTROL STOK & KETERSEDIAAN MENU
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Kelola status ketersediaan item menu. Jika biji kopi atau sirup tertentu sedang habis di outlet ini, tandai menu sebagai "Stok Habis" agar customer online tidak memesannya.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Sync Info */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>Terakhir disinkronkan: {new Date(lastUpdated).toLocaleTimeString('id-ID')}</span>
          <span>Hak Akses: Terbatas Cabang {assignedOutletName}</span>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: 'LAPORAN SALES & OMSET OUTLET',
      description: 'Pantau total penjualan semua outlet, breakdown Sudirman & Kelakap 7, dan audit bukti QRIS.',
      tab: 'sales',
      icon: TrendingUp,
      color: 'text-emerald-400',
    },
    {
      title: 'EDIT HERO & BRANDING',
      description: 'Ubah logo, hero background, tagline, judul headline & deskripsi.',
      tab: 'home',
      icon: Sparkles,
      color: 'text-cyan-400',
    },
    {
      title: 'KELOLA FOTO QRIS PAYMENT',
      description: 'Upload & ganti foto QRIS resmi toko yang tampil di checkout customer.',
      tab: 'qris-payment',
      icon: QrCode,
      color: 'text-amber-400',
    },
    {
      title: 'KELOLA MENU & KATEGORI',
      description: 'Tambah, edit harga, ubah ketersediaan, hapus, dan upload foto menu.',
      tab: 'menu',
      icon: UtensilsCrossed,
      color: 'text-emerald-400',
    },
    {
      title: 'KELOLA TIM BARISTA',
      description: 'Atur profil artisan, foto barista, jabatan, dan kopi favorit.',
      tab: 'baristas',
      icon: Users,
      color: 'text-rose-400',
    },
    {
      title: 'KELOLA FOTO SLIDER STORY',
      description: 'Upload & atur urutan carousel foto interaktif di section Our Story.',
      tab: 'story-slider',
      icon: Layers,
      color: 'text-cyan-400',
    },
    {
      title: 'EDIT CHAPTER 5 (SUDIRMAN)',
      description: 'Perbarui jam buka, alamat, background, dan link maps Sudirman.',
      tab: 'chapter-5',
      icon: MapPin,
      color: 'text-sky-400',
    },
    {
      title: 'EDIT CHAPTER 6 (RATU SIMA)',
      description: 'Perbarui jam buka, alamat, background, dan link maps Ratu Sima.',
      tab: 'chapter-6',
      icon: MapPin,
      color: 'text-indigo-400',
    },
    {
      title: "EDIT HALAMAN LET'GO",
      description: 'Kelola informasi mobile coffee booth dan titik lokasi operasional.',
      tab: 'let-go',
      icon: Truck,
      color: 'text-amber-400',
    },
    {
      title: 'EDIT LETON OPEN BOOTH',
      description: 'Kelola konsep booth publik dan deretan kartu galeri foto horizontal.',
      tab: 'open-booth',
      icon: Store,
      color: 'text-emerald-400',
    },
    {
      title: 'KONTAK & SETTINGS',
      description: 'Update nomor WhatsApp pemesanan, akun Instagram, dan password admin.',
      tab: 'settings',
      icon: ShieldCheck,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B1524] to-slate-900 border border-cyan-500/30 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00E5FF] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
              <span>LIVE CMS CONTROL PANEL</span>
            </div>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight uppercase">
              KONTROL KONTEN {data.siteSettings.brandName}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Semua perubahan yang Anda simpan di sini akan langsung terupdate secara real-time pada website publik tanpa perlu refresh manual.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <button
              onClick={() => refreshData()}
              className="px-4 py-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronisasi Ulang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
              Total Menu
            </span>
            <p className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
              {menuItems.length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-[#00E5FF]">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
              Kategori Menu
            </span>
            <p className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
              {menuCategories.length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Baristas */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
              Tim Barista
            </span>
            <p className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
              {baristas.length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
              Cabang & Mobile
            </span>
            <p className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
              {branches.length + 1}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 5 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
              Status Server
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-display font-bold text-xs text-white">
                {isRealtimeConnected ? 'REALTIME LIVE' : 'SYNC POLLING'}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Chapter & Branch Live Visual Preview Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">
            PREVIEW BACKGROUND CABANG & LET'GO
          </h3>
          <span className="text-xs font-mono text-cyan-400">
            {branches.length} Cabang Fisik + 1 Mobile Unit
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 group"
            >
              <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                {branch.bgImage ? (
                  <img
                    src={resolveMediaUrl(branch.bgImage)}
                    alt={branch.branchName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                    No Background Image
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[#00E5FF] text-[10px] font-mono font-bold">
                  {branch.chapterName}
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-display font-black text-white text-base uppercase">
                    {branch.branchName}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{branch.address}</p>
                </div>

                <button
                  onClick={() => onNavigateTab(branch.id)}
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-[#00E5FF] text-slate-200 hover:text-slate-950 text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Kelola Foto & Info Cabang</span>
                </button>
              </div>
            </div>
          ))}

          {/* LET'GO Card */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 group">
            <div className="h-44 w-full relative overflow-hidden bg-slate-950">
              {data.mobileService.bgImage ? (
                <img
                  src={resolveMediaUrl(data.mobileService.bgImage)}
                  alt={data.mobileService.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                  No Background Image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold">
                MOBILE FLEET
              </div>
            </div>

            <div className="p-4 flex flex-col justify-between">
              <div>
                <h4 className="font-display font-black text-white text-base uppercase">
                  {data.mobileService.title} ({data.mobileService.subtitle})
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                  {data.mobileService.serviceArea}
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('let-go')}
                className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-[#00E5FF] text-slate-200 hover:text-slate-950 text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Kelola Foto LET'GO</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div>
        <h3 className="font-display font-black text-lg text-white uppercase tracking-tight mb-4">
          AKSES CEPAT EDITOR
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.tab}
                onClick={() => onNavigateTab(action.tab)}
                className="p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 text-left transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl bg-slate-950 ${action.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-[#00E5FF] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h4 className="font-display font-bold text-sm text-white group-hover:text-[#00E5FF] transition-colors uppercase">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Supabase Status Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-[#2563EB]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/50 flex items-center justify-center text-[#60A5FA] shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white uppercase tracking-wider">
                SUPABASE DATABASE & STORAGE
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isRealtimeConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                {isRealtimeConnected ? 'REALTIME ACTIVE' : 'CONNECTING / STANDBY'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Tabel: <code className="text-[#60A5FA] font-mono">{SUPABASE_TABLE_NAME}</code> • Storage Bucket: <code className="text-[#60A5FA] font-mono">{SUPABASE_STORAGE_BUCKET}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Supabase Client Connected
          </span>
        </div>
      </div>

      {/* Sync footer info */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <span>Terakhir disinkronkan: {new Date(lastUpdated).toLocaleTimeString('id-ID')}</span>
        <span>Storage: Supabase ('{SUPABASE_TABLE_NAME}') + Bucket ('{SUPABASE_STORAGE_BUCKET}')</span>
      </div>
    </div>
  );
};
