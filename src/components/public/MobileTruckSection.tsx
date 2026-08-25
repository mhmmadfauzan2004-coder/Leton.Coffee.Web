import React from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { motion } from 'motion/react';
import { Truck, MessageCircle, Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export const MobileTruckSection: React.FC = () => {
  const { data } = useContent();
  const { mobileService } = data;

  const eventWhatsAppLink = createWhatsAppLink(
    mobileService.whatsapp,
    mobileService.whatsappMessage || 'Halo Leton Coffee, saya tertarik menggunakan layanan Let’GO untuk event.'
  );

  const bgPhoto = mobileService.bgImage || mobileService.truckImage;

  return (
    <section
      id="let-go"
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-28 sm:py-36 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: bgPhoto
          ? `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("${bgPhoto}")`
          : 'linear-gradient(rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.85))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Main Content Layout - Center Aligned Minimalist Floating Over Wallpaper */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center flex flex-col items-center">
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
          transition={{ duration: 0.6 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-tight drop-shadow-lg"
        >
          {mobileService.title}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-3 text-sm sm:text-base md:text-lg text-[#60A5FA] font-semibold tracking-wider uppercase drop-shadow-md"
        >
          {mobileService.subtitle}
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-100 leading-relaxed max-w-3xl drop-shadow-md font-normal"
        >
          {mobileService.description}
        </motion.p>

        {/* Clean Meta Info (Area, Event, Service) - No Box Container, Pure Floating Clean Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-center"
        >
          {mobileService.serviceArea && (
            <div className="flex items-center justify-center gap-2.5 text-slate-100 drop-shadow-md">
              <MapPin className="w-5 h-5 text-[#60A5FA] shrink-0" />
              <span className="text-sm sm:text-base font-medium">{mobileService.serviceArea}</span>
            </div>
          )}

          {mobileService.eventInfo && (
            <div className="flex items-center justify-center gap-2.5 text-slate-100 drop-shadow-md">
              <Calendar className="w-5 h-5 text-[#60A5FA] shrink-0" />
              <span className="text-sm sm:text-base font-medium">{mobileService.eventInfo}</span>
            </div>
          )}

          {mobileService.serviceInfo && (
            <div className="flex items-center justify-center gap-2.5 text-slate-100 drop-shadow-md">
              <Truck className="w-5 h-5 text-[#60A5FA] shrink-0" />
              <span className="text-sm sm:text-base font-medium">{mobileService.serviceInfo}</span>
            </div>
          )}
        </motion.div>

        {/* Feature Checkpoints */}
        {mobileService.features && mobileService.features.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-100 font-medium"
          >
            {mobileService.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 drop-shadow-md">
                <CheckCircle2 className="w-4 h-4 text-[#60A5FA] shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Booking CTA Button - Centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-10 pt-2"
        >
          <a
            href={eventWhatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            id="letgo-book-event-cta"
            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-[#2563EB]/30 hover:shadow-[#2563EB]/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{mobileService.ctaText || 'BOOK FOR EVENT VIA WHATSAPP'}</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
};
