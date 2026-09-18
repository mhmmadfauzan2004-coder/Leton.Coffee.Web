import React from 'react';
import { OrderOutlet } from '../../../types';
import { DEFAULT_OUTLETS } from '../../../data/outletsData';
import { useContent } from '../../../context/ContentContext';
import { resolveMediaUrl } from '../../../utils/api';
import { MapPin, Clock, ArrowRight, Coffee } from 'lucide-react';
import { motion } from 'motion/react';

interface OutletSelectorProps {
  onSelectOutlet: (outlet: OrderOutlet) => void;
  onClose?: () => void;
}

export const OutletSelector: React.FC<OutletSelectorProps> = ({ onSelectOutlet }) => {
  const { data } = useContent();

  const outlets: OrderOutlet[] = DEFAULT_OUTLETS.map((outlet, index) => {
    let dynamicImage = outlet.image;
    let dynamicAddress = outlet.address;
    let dynamicHours = outlet.hours;

    if (outlet.id === 'sudirman' && data.branches[0]) {
      dynamicImage = data.branches[0].bgImage || outlet.image;
      dynamicAddress = data.branches[0].address || outlet.address;
      dynamicHours = data.branches[0].openingHours || outlet.hours;
    } else if ((outlet.id === 'kelakap_7' || outlet.id === 'ratusima') && data.branches[1]) {
      dynamicImage = data.branches[1].bgImage || outlet.image;
      dynamicAddress = data.branches[1].address || outlet.address;
      dynamicHours = data.branches[1].openingHours || outlet.hours;
    } else if ((outlet.id === 'letgo-mpp' || outlet.id === 'letgo') && data.mobileService) {
      dynamicImage = data.mobileService.bgImage || data.mobileService.truckImage || outlet.image;
    }

    return {
      ...outlet,
      image: dynamicImage,
      address: dynamicAddress,
      hours: dynamicHours,
      whatsapp: data.contactSettings?.whatsapp || outlet.whatsapp,
    };
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono tracking-widest uppercase mb-3 shadow-md">
          <Coffee className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>LANGKAH 1 — PILIH OUTLET TUJUAN</span>
        </div>
        <h2 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
          PILIH OUTLET LETON COFFEE
        </h2>
        <p className="mt-2 text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Silakan pilih cabang atau booth terdekat untuk melihat ketersediaan menu dan melakukan pemesanan.
        </p>
      </div>

      {/* Outlet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {outlets.map((outlet, idx) => (
          <motion.div
            key={outlet.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            onClick={() => onSelectOutlet(outlet)}
            className="group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900/90 border border-slate-800 hover:border-[#00E5FF]/80 transition-all duration-300 flex flex-col justify-between cursor-pointer hover:shadow-2xl hover:shadow-[#00E5FF]/15 hover:-translate-y-1.5"
          >
            {/* Image Header */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
              <img
                src={resolveMediaUrl(outlet.image)}
                alt={outlet.name}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-85 group-hover:brightness-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Menerima Order</span>
              </div>

              {outlet.badge && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#2563EB]/90 text-white text-[9px] font-mono font-bold uppercase tracking-wider backdrop-blur-xs">
                  {outlet.badge}
                </div>
              )}
            </div>

            {/* Content Details */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-black text-base sm:text-lg text-white group-hover:text-[#00E5FF] transition-colors leading-snug">
                  {outlet.name}
                </h3>

                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{outlet.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px]">{outlet.hours}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-[#2563EB] group-hover:bg-[#00E5FF] text-white group-hover:text-slate-950 transition-all duration-200 shadow-md shadow-[#2563EB]/25 group-hover:shadow-[#00E5FF]/30"
                >
                  <span>PILIH OUTLET INI</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
