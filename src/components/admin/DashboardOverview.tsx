import React from 'react';
import { useContent } from '../../context/ContentContext';
import { UtensilsCrossed, Layers, MapPin, Truck, Sparkles, ArrowRight, ShieldCheck, RefreshCw, Users } from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateTab }) => {
  const { data, isRealtimeConnected, lastUpdated, refreshData } = useContent();
  const { menuItems, menuCategories, branches, baristas = [] } = data;

  const quickActions = [
    {
      title: 'EDIT HERO & BRANDING',
      description: 'Ubah logo, hero background, tagline, judul headline & deskripsi.',
      tab: 'home',
      icon: Sparkles,
      color: 'text-cyan-400',
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
      title: "EDIT LET'GO TRUCK",
      description: 'Kelola paket event, area jangkauan, foto truck, dan CTA booking.',
      tab: 'let-go',
      icon: Truck,
      color: 'text-amber-400',
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
                    src={branch.bgImage}
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
                  src={data.mobileService.bgImage}
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

      {/* Sync footer info */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 font-mono flex items-center justify-between">
        <span>Terakhir disinkronkan: {new Date(lastUpdated).toLocaleTimeString('id-ID')}</span>
        <span>Storage Backend: JSON Disk + Realtime SSE</span>
      </div>
    </div>
  );
};
