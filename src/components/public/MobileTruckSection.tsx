import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { LetGoCardsGallery } from './LetGoCardsGallery';
import { motion } from 'motion/react';
import { Truck, MapPin } from 'lucide-react';

export const MobileTruckSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService } = data;

  const bgPhoto = resolveMediaUrl(mobileService.bgImage || mobileService.truckImage);
  const overlayPercent = typeof mobileService.bgOverlay === 'number' ? mobileService.bgOverlay : 45;
  const overlayOpacity = Math.max(0, Math.min(100, overlayPercent)) / 100;

  const locationsList =
    mobileService.locations && mobileService.locations.length > 0
      ? mobileService.locations
      : ['Parkiran MPP', 'Ecopark'];

  return (
    <section
      id="let-go"
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-[#070b12]"
    >
      {/* Background Image Layer with tailored responsive positioning */}
      {bgPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-no-repeat bg-[position:50%_25%] sm:bg-[position:50%_32%] md:bg-center transition-all duration-300 pointer-events-none"
          style={{ backgroundImage: `url("${bgPhoto}")` }}
        />
      )}

      {/* Dynamic CSS Dark Overlay Layer (Controlled from Admin 0% - 100%) */}
      <div
        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
        style={{ opacity: overlayOpacity }}
      />

      {/* Background Ambient Radial Glow */}
      <div className="absolute inset-0 bg-radial from-[#2563EB]/12 via-transparent to-transparent pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center flex flex-col items-center">
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FDFBF7]/90 backdrop-blur-md border border-[#2563EB]/40 text-[#2563EB] text-xs sm:text-sm font-mono tracking-widest uppercase mb-4 shadow-lg shadow-black/40"
        >
          <Truck className="w-4 h-4 text-[#2563EB]" />
          <span className="font-bold">04 — {mobileService.badge || 'MOBILE COFFEE EXPERIENCE'}</span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-tight drop-shadow-lg"
        >
          {mobileService.title || "LET'GO"}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-3 text-sm sm:text-base md:text-lg text-[#60A5FA] font-semibold tracking-widest uppercase drop-shadow-md font-mono"
        >
          {mobileService.subtitle || 'COFFEE ON THE MOVE.'}
        </motion.p>

        {/* Concept Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
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
          transition={{ duration: 0.6, delay: 0.4 }}
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

        {/* Horizontal Photo Slider / Carousel for LET'GO */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="w-full"
        >
          <LetGoCardsGallery
            images={mobileService.letGoGalleryImages || []}
            sectionLabel="LET'GO"
          />
        </motion.div>
      </div>
    </section>
  );
};
