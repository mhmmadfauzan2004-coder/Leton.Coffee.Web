import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { createWhatsAppLink } from '../../utils/formatters';
import { OpenBoothCardsGallery } from './OpenBoothCardsGallery';
import { motion } from 'motion/react';
import { Store, MessageCircle } from 'lucide-react';

export const OpenBoothSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService, contactSettings } = data;

  const bgPhoto = resolveMediaUrl(mobileService.bgImage || mobileService.truckImage);
  const openBoothDesc =
    mobileService.openBoothDescription ||
    'Leton Open Booth adalah coffee booth mobile dari Leton Coffee yang hadir di area publik dan lokasi tertentu untuk melayani customer secara langsung.';

  const whatsappNumber = contactSettings?.whatsapp || '082168936647';
  const eventWaLink = createWhatsAppLink(
    whatsappNumber,
    'Halo Leton Coffee, saya ingin BOOK FOR EVENT. Bisa minta informasi lebih lanjut?'
  );

  return (
    <section
      id="leton-open-booth"
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-[#070b12]"
      style={{
        backgroundImage: bgPhoto
          ? `linear-gradient(rgba(7, 11, 18, 0.85), rgba(7, 11, 18, 0.90)), url("${bgPhoto}")`
          : 'linear-gradient(rgba(7, 11, 18, 0.93), rgba(7, 11, 18, 0.97))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background Subtle Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b12]/90 via-transparent to-[#070b12]/95 pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-6xl mx-auto w-full text-center flex flex-col items-center">
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FDFBF7]/90 backdrop-blur-md border border-[#2563EB]/40 text-[#2563EB] text-xs sm:text-sm font-mono tracking-widest uppercase mb-4 shadow-lg shadow-black/40"
        >
          <Store className="w-4 h-4 text-[#2563EB]" />
          <span className="font-bold">05 — {mobileService.openBoothSubtitle || 'POP-UP & PUBLIC SPACE'}</span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-tight drop-shadow-lg"
        >
          {mobileService.openBoothTitle || 'LETON OPEN BOOTH'}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-3 text-sm sm:text-base md:text-lg text-[#60A5FA] font-semibold tracking-widest uppercase drop-shadow-md font-mono"
        >
          HADIR DI AREA PUBLIK
        </motion.p>

        {/* Concept Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-100 leading-relaxed max-w-2xl drop-shadow-md font-normal"
        >
          {openBoothDesc}
        </motion.p>

        {/* BOOK FOR EVENT Button (Replaces location list box) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 mb-4"
        >
          <a
            href={eventWaLink}
            target="_blank"
            rel="noopener noreferrer"
            id="book-for-event-btn"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-[#2563EB]/30 hover:shadow-2xl hover:shadow-[#2563EB]/50 hover:scale-105 active:scale-[0.98] transition-all cursor-pointer border border-[#60A5FA]/30"
          >
            <MessageCircle className="w-5 h-5 text-white" />
            <span>BOOK FOR EVENT</span>
          </a>
        </motion.div>

        {/* Horizontal Swipe Cards Photo Gallery */}
        {mobileService.galleryImages && mobileService.galleryImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
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
