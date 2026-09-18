import React from 'react';
import { BranchItem } from '../../types';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { MapPin, Clock, MessageCircle, ExternalLink, Navigation, Store } from 'lucide-react';

interface ChapterSectionProps {
  branch: BranchItem;
  reversed?: boolean;
}

export const ChapterSection: React.FC<ChapterSectionProps> = ({ branch }) => {
  const { data } = useContent();
  const { contactSettings } = data;

  const branchWALink = createWhatsAppLink(
    contactSettings.whatsapp,
    `Halo Leton Coffee ${branch.branchName}, saya ingin menanyakan meja dan pemesanan kopi.`
  );

  const resolvedBg = resolveMediaUrl(branch.bgImage);

  return (
    <section
      id={branch.id}
      className="relative w-full overflow-hidden py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-[#F0F7FF] border-t border-[#E0F2FE]"
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Card Layout */}
        <div className="bg-white rounded-3xl border border-[#E0F2FE] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
          {/* Image Column (5 cols) */}
          <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[400px] lg:min-h-full bg-[#E0F2FE]">
            {resolvedBg ? (
              <img
                src={resolvedBg}
                alt={branch.branchName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#0284C7]">
                <Store className="w-16 h-16 opacity-40" />
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className="px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-[#0284C7] text-xs font-bold font-mono uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Buka Sekarang</span>
              </span>
            </div>
          </div>

          {/* Details Column (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#E0F2FE] text-xs font-mono font-bold uppercase tracking-wider mb-4">
                <span>{branch.chapterNumber} — {branch.chapterName}</span>
                {branch.badge && <span className="text-[#64748B]">/ {branch.badge}</span>}
              </div>

              {/* Title */}
              <h2 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl text-[#172033] uppercase tracking-tight leading-tight">
                {branch.branchName}
              </h2>

              {/* Tagline */}
              {branch.tagline && (
                <p className="mt-2 text-sm sm:text-base font-bold text-[#0284C7] uppercase tracking-wide">
                  {branch.tagline}
                </p>
              )}

              {/* Description */}
              <p className="mt-4 text-sm sm:text-base text-[#64748B] leading-relaxed">
                {branch.description}
              </p>

              {/* Info Badges (Address & Hours) */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#E0F2FE]">
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#172033]">
                  <MapPin className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[11px] uppercase tracking-wider text-[#64748B]">Lokasi</span>
                    <span>{branch.address}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#172033]">
                  <Clock className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[11px] uppercase tracking-wider text-[#64748B]">Jam Operasional</span>
                    <span>{branch.openingHours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-[#E0F2FE] flex flex-wrap items-center gap-3">
              <a
                href={branchWALink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>CHAT WHATSAPP CABANG</span>
              </a>

              {branch.mapsUrl && (
                <a
                  href={branch.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2 shadow-sm transition-all"
                >
                  <Navigation className="w-4 h-4 text-[#0284C7]" />
                  <span>GOOGLE MAPS</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
