import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { createWhatsAppLink } from '../../utils/formatters';
import { LetGoCardsGallery } from './LetGoCardsGallery';
import { motion } from 'motion/react';
import { Truck, MapPin, MessageCircle, Sparkles, Coffee, Clock } from 'lucide-react';

export const MobileTruckSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService, contactSettings } = data;

  const photo = resolveMediaUrl(mobileService.bgImage || mobileService.truckImage);

  const locationsList =
    mobileService.locations && mobileService.locations.length > 0
      ? mobileService.locations
      : ['Parkiran MPP', 'Ecopark'];

  const whatsappNumber = contactSettings?.whatsapp || '082168936647';
  const askScheduleWaLink = createWhatsAppLink(
    whatsappNumber,
    "Halo Leton Coffee, saya ingin menanyakan lokasi mangkal & jadwal mobile coffee LET'GO hari ini."
  );

  return (
    <section
      id="let-go"
      className="relative w-full overflow-hidden py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-[#F8FBFF] border-t border-[#E0F2FE]"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-[#E0F2FE]/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 rounded-full bg-[#BAE6FD]/30 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        {/* Main Split Showcase Card */}
        <div className="bg-white rounded-3xl border border-[#E0F2FE] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
          {/* Visual Column (5 cols) */}
          <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[400px] lg:min-h-full bg-[#E0F2FE]">
            {photo ? (
              <img
                src={photo}
                alt={mobileService.title || "LET'GO Mobile Coffee"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#0284C7] p-8 text-center">
                <Truck className="w-16 h-16 opacity-40 mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748B]">
                  LET'GO Mobile Unit
                </span>
              </div>
            )}

            {/* Active Status Badge */}
            <div className="absolute top-4 left-4">
              <span className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[#0284C7] text-xs font-bold font-mono uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-[#E0F2FE]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>Unit Mobile Aktif</span>
              </span>
            </div>
          </div>

          {/* Details Column (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#E0F2FE] text-xs font-mono font-bold uppercase tracking-wider mb-4">
                <Truck className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>04 — {mobileService.badge || 'MOBILE COFFEE EXPERIENCE'}</span>
              </div>

              {/* Title */}
              <h2 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl text-[#172033] uppercase tracking-tight leading-tight">
                {mobileService.title || "LET'GO"}
              </h2>

              {/* Subtitle / Tagline */}
              <p className="mt-2 text-sm sm:text-base font-bold text-[#0284C7] uppercase tracking-wide">
                {mobileService.subtitle || 'COFFEE ON THE MOVE'}
              </p>

              {/* Description */}
              <p className="mt-4 text-sm sm:text-base text-[#64748B] leading-relaxed">
                {mobileService.description ||
                  'Leton Coffee hadir lebih dekat dengan kamu melalui konsep mobile coffee booth. Temukan kami di lokasi-lokasi tertentu dan nikmati kopi racikan barista Leton tanpa harus datang ke outlet utama.'}
              </p>

              {/* Mobile Locations Grid */}
              <div className="mt-6 pt-5 border-t border-[#E0F2FE]">
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#64748B] flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>TITIK LOKASI MANGKAL:</span>
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                  {locationsList.map((loc, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] text-xs sm:text-sm font-display font-bold uppercase tracking-wide shadow-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                      <span>{loc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlights Micro Badges */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-center gap-2.5">
                  <Coffee className="w-4 h-4 text-[#0284C7] shrink-0" />
                  <span className="text-xs text-[#172033] font-semibold">Racikan Espresso &amp; Minuman Segar</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#0284C7] shrink-0" />
                  <span className="text-xs text-[#172033] font-semibold">Pelayanan Cepat &amp; Praktis</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-[#E0F2FE] flex flex-wrap items-center gap-3">
              <a
                href={askScheduleWaLink}
                target="_blank"
                rel="noopener noreferrer"
                id="letgo-whatsapp-btn"
                className="px-6 py-3.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.25)] transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>TANYA JADWAL / CEK LOKASI HARI INI</span>
              </a>
            </div>
          </div>
        </div>

        {/* Horizontal Photo Slider / Carousel for LET'GO */}
        <LetGoCardsGallery
          images={mobileService.letGoGalleryImages || []}
          sectionLabel="LET'GO"
        />
      </div>
    </section>
  );
};
