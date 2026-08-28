import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { OpenBoothCardsGallery } from './OpenBoothCardsGallery';
import { motion } from 'motion/react';
import { Truck, MapPin, Store, Sparkles } from 'lucide-react';

export const MobileTruckSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService } = data;

  const bgPhoto = resolveMediaUrl(mobileService.bgImage || mobileService.truckImage);
  const locationsList =
    mobileService.locations && mobileService.locations.length > 0
      ? mobileService.locations
      : ['Parkiran MPP', 'Ecopark'];

  const openBoothDesc =
    mobileService.openBoothDescription ||
    'Leton Open Booth adalah coffee booth mobile dari Leton Coffee yang hadir di area publik dan lokasi tertentu untuk melayani customer secara langsung.';

  return (
    <section
      id="let-go"
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: bgPhoto
          ? `linear-gradient(rgba(7, 11, 18, 0.78), rgba(7, 11, 18, 0.85)), url("${bgPhoto}")`
          : 'linear-gradient(rgba(7, 11, 18, 0.9), rgba(7, 11, 18, 0.95))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background Ambient Radial Glow */}
      <div className="absolute inset-0 bg-radial from-[#2563EB]/10 via-transparent to-transparent pointer-events-none" />

      {/* ========================================
          PART 1: LET'GO (Coffee On The Move)
          ======================================== */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center flex flex-col items-center">
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FDFBF7]/90 backdrop-blur-md border border-[#2563EB]/40 text-[#2563EB] text-xs sm:text-sm font-mono tracking-widest uppercase mb-4 shadow-lg shadow-black/40"
        >
          <Truck className="w-4 h-4 text-[#2563EB]" />
          <span className="font-bold">04 — {mobileService.badge || 'MOBILE COFFEE BOOTH'}</span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-tight drop-shadow-lg"
        >
          {mobileService.title || "LET'GO"}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-3 text-sm sm:text-base md:text-lg text-[#60A5FA] font-semibold tracking-widest uppercase drop-shadow-md font-mono"
        >
          {mobileService.subtitle || 'COFFEE ON THE MOVE.'}
        </motion.p>

        {/* Concept Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-100 leading-relaxed max-w-2xl drop-shadow-md font-normal"
        >
          {mobileService.description ||
            'Leton Coffee hadir lebih dekat dengan kamu melalui konsep mobile coffee booth. Temukan kami di lokasi-lokasi tertentu dan nikmati kopi Leton tanpa harus datang ke outlet utama.'}
        </motion.p>

        {/* Mobile Locations Pill Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-8 flex flex-col items-center gap-3 w-full"
        >
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-slate-300 drop-shadow-md flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>LOKASI MOBILE LETON COFFEE:</span>
          </span>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {locationsList.map((loc, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-slate-900/85 backdrop-blur-md border border-[#2563EB]/40 text-white shadow-xl shadow-black/40 text-xs sm:text-sm font-display font-bold tracking-wider uppercase"
              >
                <span className="w-2 h-2 rounded-full bg-[#60A5FA] animate-pulse" />
                <span>📍 {loc}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ========================================
          PART 2: LETON OPEN BOOTH & CARDS GALLERY
          ======================================== */}
      <div className="relative z-10 max-w-6xl mx-auto w-full mt-16 sm:mt-24 pt-12 sm:pt-16 border-t border-white/10 flex flex-col items-center">
        {/* Open Booth Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto px-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] text-[11px] sm:text-xs font-mono tracking-widest uppercase mb-3">
            <Store className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>{mobileService.openBoothSubtitle || 'POP-UP & PUBLIC SPACE'}</span>
          </div>

          <h3 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase leading-tight drop-shadow-lg">
            {mobileService.openBoothTitle || 'LETON OPEN BOOTH'}
          </h3>

          <p className="mt-4 text-sm sm:text-base md:text-lg text-slate-200 leading-relaxed font-normal drop-shadow-md">
            {openBoothDesc}
          </p>

          {/* Open Booth Location Notice */}
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-mono text-[#93C5FD] bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <span className="font-bold text-slate-300">TEMUKAN BOOTH KAMI DI:</span>
            {locationsList.map((loc, idx) => (
              <span key={idx} className="font-bold text-white">
                📍 {loc.toUpperCase()}
                {idx < locationsList.length - 1 && <span className="text-slate-500 mx-1.5">•</span>}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Horizontal Swipe Cards Photo Gallery */}
        {mobileService.galleryImages && mobileService.galleryImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full"
          >
            <OpenBoothCardsGallery
              images={mobileService.galleryImages}
              sectionLabel="LETON OPEN BOOTH"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
};
