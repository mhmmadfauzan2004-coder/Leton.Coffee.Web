import React from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { MessageCircle, Instagram, MapPin, Clock, Mail, Navigation, Heart, Lock } from 'lucide-react';

interface ContactSectionProps {
  onOpenAdmin?: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ onOpenAdmin }) => {
  const { data } = useContent();
  const { contactSettings, siteSettings } = data;

  const contactWALink = createWhatsAppLink(
    contactSettings.whatsapp,
    `Halo ${siteSettings.brandName}, saya ingin pesan kopi / info kerjasama event.`
  );

  return (
    <footer
      id="contact"
      className="relative w-full bg-[#05080e] pt-28 sm:pt-36 pb-12 border-t border-[#2563EB]/25 overflow-hidden"
    >
      {/* Background Accent Grid */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#2563EB_1px,transparent_1px),linear-gradient(to_bottom,#2563EB_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Main CTA Heading */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/40 text-[#60A5FA] text-xs font-mono tracking-widest uppercase mb-4 shadow-md"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>08 — CONNECT WITH LETON</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white tracking-tight uppercase leading-none"
          >
            {contactSettings.title || "LET'S GET COFFEE."}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto"
          >
            {contactSettings.subtitle ||
              'Kunjungi cabang kami atau terhubung langsung melalui WhatsApp dan media sosial.'}
          </motion.p>
        </div>

        {/* Action Cards Grid - Soft Cream Containers with Dark Charcoal Text */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* WhatsApp Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 sm:p-8 rounded-3xl bg-[#FDFBF7]/95 backdrop-blur-md border border-[#2563EB]/20 hover:border-[#2563EB] transition-all flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-[#2563EB]/15"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-5 group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-[#1E293B]">WHATSAPP OFFICIAL</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed font-normal">
                Pemesanan take-away, delivery, konsultasi menu, dan layanan event.
              </p>
              <p className="font-mono text-sm font-bold text-[#2563EB] mt-4">{contactSettings.whatsapp}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200">
              <a
                href={contactWALink}
                target="_blank"
                rel="noopener noreferrer"
                id="contact-wa-btn"
                className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/20 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{contactSettings.ctaWhatsappText || 'CHAT VIA WHATSAPP'}</span>
              </a>
            </div>
          </motion.div>

          {/* Instagram Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6 sm:p-8 rounded-3xl bg-[#FDFBF7]/95 backdrop-blur-md border border-[#2563EB]/20 hover:border-pink-500 transition-all flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-pink-500/15"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mb-5 group-hover:bg-pink-600 group-hover:text-white transition-colors shadow-sm">
                <Instagram className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-[#1E293B]">INSTAGRAM</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed font-normal">
                Update chapter terbaru, promo, event komunitas, dan live brewing.
              </p>
              <p className="font-mono text-sm font-bold text-pink-600 mt-4">
                {contactSettings.instagramUsername}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200">
              <a
                href={contactSettings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="contact-ig-btn"
                className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition-all"
              >
                <Instagram className="w-4 h-4" />
                <span>{contactSettings.ctaInstagramText || 'FOLLOW US'}</span>
              </a>
            </div>
          </motion.div>

          {/* Location & Map Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="p-6 sm:p-8 rounded-3xl bg-[#FDFBF7]/95 backdrop-blur-md border border-[#2563EB]/20 hover:border-[#2563EB] transition-all flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-[#2563EB]/15"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-5 group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-sm">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-[#1E293B]">LOKASI UTAMA</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed font-normal">
                {contactSettings.address}
              </p>
              <div className="flex items-center gap-2 text-xs text-[#2563EB] mt-4 font-mono font-bold">
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{contactSettings.openingHours}</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200">
              <a
                href={contactSettings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="contact-maps-btn"
                className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/20 transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>{contactSettings.ctaMapsText || 'GET DIRECTIONS'}</span>
              </a>
            </div>
          </motion.div>
        </div>

        {/* Footer Sub-Bar with Logo */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded-full overflow-hidden border border-[#2563EB] shrink-0 bg-slate-900">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0c1427] to-[#04070d] flex items-center justify-center p-0.5 select-none">
                <svg viewBox="0 0 32 32" className="w-3.5 h-3.5 text-[#00E5FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" fill="rgba(0,229,255,0.15)" />
                  <line x1="6" y1="1" x2="6" y2="4" stroke="#60A5FA" />
                  <line x1="10" y1="1" x2="10" y2="4" stroke="#00E5FF" />
                  <line x1="14" y1="1" x2="14" y2="4" stroke="#60A5FA" />
                </svg>
              </div>
              {siteSettings.logoUrl && (
                <img
                  src={resolveMediaUrl(siteSettings.logoUrl)}
                  alt={siteSettings.brandName}
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <p>{contactSettings.footerText}</p>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              Crafted with <Heart className="w-3.5 h-3.5 text-[#60A5FA] fill-[#60A5FA] inline" /> for Leton Community
            </span>

            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 text-slate-400 hover:text-[#60A5FA] transition-colors font-mono text-[11px] cursor-pointer"
                title="Admin Control Panel"
              >
                <Lock className="w-3 h-3" />
                <span>Admin CMS</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
