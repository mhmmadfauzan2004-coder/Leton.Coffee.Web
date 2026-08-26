import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { Sparkles, Instagram, Users } from 'lucide-react';

export const BaristasSection: React.FC = () => {
  const { data } = useContent();
  const baristasContent = data.baristasContent || {
    title: 'MEET OUR BARISTAS',
    subtitle: 'THE CRAFTSMEN, ROASTERS & CREATIVE BREWERS',
    badge: '06 — THE ARTISAN TEAM',
    description:
      'Di balik setiap tegukan kopi Leton, ada dedikasi, keahlian teknik seduh, dan senyuman hangat dari tim barista kami yang siap menemani hari dan obrolanmu.',
  };

  const baristas = [...(data.baristas || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  return (
    <section
      id="baristas"
      className="relative min-h-screen w-full bg-[#060a10] py-28 sm:py-36 border-t border-slate-800/80 overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-[#2563EB]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 w-[450px] h-[450px] bg-[#60A5FA]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/40 text-[#60A5FA] text-xs font-mono tracking-widest uppercase mb-4 shadow-md"
          >
            <Users className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>{baristasContent.badge || '06 — THE ARTISAN TEAM'}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display font-black text-3xl sm:text-5xl tracking-tight text-white uppercase"
          >
            {baristasContent.title || 'MEET OUR BARISTAS'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-display font-bold text-xs sm:text-sm text-[#60A5FA] tracking-wider uppercase mt-2"
          >
            {baristasContent.subtitle || 'THE CRAFTSMEN, ROASTERS & CREATIVE BREWERS'}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-300 text-sm sm:text-base mt-4 leading-relaxed max-w-2xl mx-auto"
          >
            {baristasContent.description}
          </motion.p>
        </div>

        {/* Baristas Grid - Minimalist Cards Without Background Box on Text */}
        {baristas.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="font-display font-bold text-base text-white uppercase">
              Belum ada data barista
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tambahkan profil barista melalui CMS Admin Dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {baristas.map((barista, index) => (
              <motion.div
                key={barista.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group flex flex-col cursor-default"
              >
                {/* Photo Container */}
                <div className="relative aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 group-hover:border-[#2563EB]/60 transition-all duration-300 shadow-xl group-hover:shadow-2xl group-hover:shadow-[#2563EB]/10">
                  {barista.image ? (
                    <img
                      src={resolveMediaUrl(barista.image)}
                      alt={barista.name}
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                      <Users className="w-12 h-12 mb-2 stroke-1" />
                      <span className="text-xs font-mono">Foto Barista</span>
                    </div>
                  )}

                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060a10]/70 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

                  {/* Instagram Button */}
                  {barista.instagram && (
                    <div className="absolute top-3.5 right-3.5 z-10">
                      <a
                        href={barista.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Instagram ${barista.name}`}
                        className="p-2 rounded-full bg-black/60 hover:bg-[#2563EB] text-slate-200 hover:text-white border border-white/20 hover:border-[#2563EB] backdrop-blur-md transition-all transform hover:scale-110 flex items-center justify-center shadow-lg"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Minimalist Info directly on dark website background */}
                <div className="pt-4 pb-1 px-1 flex flex-col">
                  {/* Barista Name */}
                  <h3 className="font-display font-black text-xl text-white tracking-tight uppercase group-hover:text-[#60A5FA] transition-colors leading-tight">
                    {barista.name}
                  </h3>

                  {/* Barista Role */}
                  <p className="mt-1 text-xs sm:text-sm font-semibold tracking-wider text-[#60A5FA] uppercase">
                    {barista.role}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Culture Quote Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-16 sm:mt-20 p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-[#0a1528] to-slate-950 border border-[#2563EB]/30 text-center relative overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-center gap-2 text-[#60A5FA] font-mono text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" />
            <span>THE LETON STANDARD</span>
          </div>
          <p className="font-display font-black text-lg sm:text-2xl text-white uppercase max-w-2xl mx-auto tracking-tight">
            "Setiap cangkir adalah kolaborasi rasa, seni ekstraksi, dan percakapan tulus."
          </p>
        </motion.div>
      </div>
    </section>
  );
};
