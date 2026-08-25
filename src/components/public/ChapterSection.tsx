import React from 'react';
import { BranchItem } from '../../types';
import { createWhatsAppLink } from '../../utils/formatters';
import { motion } from 'motion/react';
import { MapPin, Clock, MessageCircle, ExternalLink, Navigation } from 'lucide-react';

interface ChapterSectionProps {
  branch: BranchItem;
  reversed?: boolean;
}

export const ChapterSection: React.FC<ChapterSectionProps> = ({ branch }) => {
  const branchWALink = createWhatsAppLink(
    branch.whatsapp,
    `Halo Leton Coffee ${branch.branchName}, saya ingin menanyakan meja dan pemesanan kopi.`
  );

  return (
    <section
      id={branch.id}
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-28 sm:py-36 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: branch.bgImage
          ? `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("${branch.bgImage}")`
          : 'linear-gradient(rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.85))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Main Content Layout - Center Aligned Minimalist Floating Over Wallpaper */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center flex flex-col items-center">
        {/* Chapter Pill */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-cyan-400/40 text-[#00E5FF] text-xs sm:text-sm font-mono tracking-widest uppercase mb-4 shadow-md"
        >
          <span>{branch.chapterNumber} — {branch.chapterName}</span>
          {branch.badge && <span className="text-white/70">/ {branch.badge}</span>}
        </motion.div>

        {/* Branch Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-tight drop-shadow-lg"
        >
          {branch.branchName}
        </motion.h2>

        {/* Tagline */}
        {branch.tagline && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-3 text-sm sm:text-base md:text-lg font-semibold tracking-wider text-[#00E5FF] uppercase drop-shadow-md"
          >
            {branch.tagline}
          </motion.p>
        )}

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-100 leading-relaxed max-w-3xl drop-shadow-md font-normal"
        >
          {branch.description}
        </motion.p>

        {/* Clean Meta Information (Address & Hours) - No Card Container, Pure Clean Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-center"
        >
          {/* Address */}
          <div className="flex items-center justify-center gap-2.5 text-slate-100 drop-shadow-md">
            <MapPin className="w-5 h-5 text-[#00E5FF] shrink-0" />
            <span className="text-sm sm:text-base font-medium">{branch.address}</span>
          </div>

          {/* Hours */}
          <div className="flex items-center justify-center gap-2.5 text-slate-100 drop-shadow-md">
            <Clock className="w-5 h-5 text-[#00E5FF] shrink-0" />
            <span className="text-sm sm:text-base font-medium">{branch.openingHours}</span>
          </div>
        </motion.div>

        {/* Action CTAs - Centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href={branchWALink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl bg-[#00E5FF] hover:bg-[#3bf0ff] text-slate-950 font-display font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2.5 shadow-xl shadow-[#00E5FF]/30 hover:shadow-[#00E5FF]/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>CHAT WHATSAPP CABANG</span>
          </a>

          {branch.mapsUrl && (
            <a
              href={branch.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl bg-black/60 hover:bg-black/80 border border-white/30 hover:border-cyan-400 text-white font-display font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2.5 backdrop-blur-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg"
            >
              <Navigation className="w-4 h-4 text-[#00E5FF]" />
              <span>PETUNJUK GOOGLE MAPS</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
            </a>
          )}
        </motion.div>
      </div>
    </section>
  );
};
