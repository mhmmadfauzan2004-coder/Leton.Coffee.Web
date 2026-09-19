import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { createWhatsAppLink } from '../../utils/formatters';
import { OpenBoothCardsGallery } from './OpenBoothCardsGallery';
import { motion } from 'motion/react';
import { Store, MessageCircle, Sparkles, CheckCircle2, Calendar, Coffee, Award } from 'lucide-react';

export const OpenBoothSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService, contactSettings } = data;

  const photo = resolveMediaUrl(
    mobileService.openBoothBgImage || mobileService.bgImage || mobileService.truckImage
  );

  const openBoothDesc =
    mobileService.openBoothDescription ||
    'Leton Open Booth adalah layanan pop-up coffee bar dari Leton Coffee yang siap hadir di berbagai acara spesial, pameran publik, bazaar, pernikahan, dan corporate gathering di seluruh Kota Dumai.';

  const whatsappNumber = contactSettings?.whatsapp || '082168936647';
  const eventWaLink = createWhatsAppLink(
    whatsappNumber,
    'Halo Leton Coffee, saya tertarik untuk BOOK FOR EVENT / OPEN BOOTH. Bisa minta informasi paket dan ketersediaan tanggal?'
  );

  return (
    <section
      id="leton-open-booth"
      className="relative w-full overflow-hidden py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-[#F0F7FF] border-t border-[#E0F2FE]"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-[#E0F2FE]/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -left-20 w-96 h-96 rounded-full bg-[#BAE6FD]/40 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        {/* Main Split Showcase Card */}
        <div className="bg-white rounded-3xl border border-[#E0F2FE] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
          {/* Details Column (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between order-2 lg:order-1">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#E0F2FE] text-xs font-mono font-bold uppercase tracking-wider mb-4">
                <Store className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>05 — {mobileService.openBoothSubtitle || 'POP-UP & PUBLIC SPACE'}</span>
              </div>

              {/* Title */}
              <h2 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl text-[#172033] uppercase tracking-tight leading-tight">
                {mobileService.openBoothTitle || 'LETON OPEN BOOTH'}
              </h2>

              {/* Subtitle / Tagline */}
              <p className="mt-2 text-sm sm:text-base font-bold text-[#0284C7] uppercase tracking-wide">
                LAYANAN COFFEE BAR UNTUK EVENT &amp; PUBLIC SPACE
              </p>

              {/* Description */}
              <p className="mt-4 text-sm sm:text-base text-[#64748B] leading-relaxed">
                {openBoothDesc}
              </p>

              {/* Service Highlights */}
              <div className="mt-6 pt-5 border-t border-[#E0F2FE] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#172033] mt-1">Full Barista &amp; Mesin</span>
                  <span className="text-[11px] text-[#64748B] leading-tight">Espresso bar lengkap dengan racikan barista terlatih.</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#172033] mt-1">Custom Menu Event</span>
                  <span className="text-[11px] text-[#64748B] leading-tight">Signature coffee, matcha, tea, hingga mocktail segar.</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] flex flex-col gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#172033] mt-1">Indoor &amp; Outdoor</span>
                  <span className="text-[11px] text-[#64748B] leading-tight">Setup fleksibel untuk wedding, bazaar, kantor &amp; festival.</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-[#E0F2FE] flex flex-wrap items-center gap-3">
              <a
                href={eventWaLink}
                target="_blank"
                rel="noopener noreferrer"
                id="openbooth-whatsapp-btn"
                className="px-7 py-3.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2.5 shadow-[0_4px_14px_rgba(2,132,199,0.25)] transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>BOOK FOR EVENT / KONSULTASI BOOTH</span>
              </a>
            </div>
          </div>

          {/* Visual Column (5 cols) */}
          <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[400px] lg:min-h-full bg-[#E0F2FE] order-1 lg:order-2">
            {photo ? (
              <img
                src={photo}
                alt={mobileService.openBoothTitle || 'LETON OPEN BOOTH'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#0284C7] p-8 text-center">
                <Store className="w-16 h-16 opacity-40 mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748B]">
                  Open Booth Experience
                </span>
              </div>
            )}

            {/* Booking Available Badge */}
            <div className="absolute top-4 left-4">
              <span className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[#0284C7] text-xs font-bold font-mono uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-[#E0F2FE]">
                <Calendar className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Booking Event Tersedia</span>
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal Photo Slider / Carousel for LETON OPEN BOOTH */}
        {mobileService.galleryImages && mobileService.galleryImages.length > 0 && (
          <OpenBoothCardsGallery
            images={mobileService.galleryImages}
            sectionLabel="LETON OPEN BOOTH"
          />
        )}
      </div>
    </section>
  );
};
