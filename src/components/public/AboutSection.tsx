import React from 'react';
import { useContent } from '../../context/ContentContext';
import { motion } from 'motion/react';
import { Coffee, Flame } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const { data } = useContent();
  const { aboutContent } = data;

  return (
    <section
      id="about"
      className="relative min-h-screen w-full bg-[#070b12] py-28 sm:py-36 border-t border-slate-800/60 overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Visual Media with Overlap */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl">
              <img
                src={aboutContent.mainImage}
                alt="Leton Coffee Story"
                className="w-full h-80 sm:h-96 lg:h-[450px] object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-transparent to-transparent opacity-60" />
            </div>

            {/* Secondary Floating Image */}
            {aboutContent.secondaryImage && (
              <div className="hidden sm:block absolute -bottom-8 -right-6 w-48 sm:w-60 h-48 sm:h-60 rounded-2xl overflow-hidden border-2 border-cyan-400/40 shadow-2xl shadow-cyan-950/60 z-20">
                <img
                  src={aboutContent.secondaryImage}
                  alt="Leton Community Vibes"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </motion.div>

          {/* Text Storytelling & Brand Facts */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6 flex flex-col"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[#00E5FF] text-xs font-mono tracking-widest uppercase mb-4 w-fit">
              <Flame className="w-3.5 h-3.5" />
              <span>06 — {aboutContent.badge || 'BRAND PROFILE & CULTURE'}</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-[1.08]">
              {aboutContent.title}
            </h2>

            {aboutContent.subtitle && (
              <p className="mt-2 text-sm sm:text-base font-bold tracking-wider text-[#00E5FF] uppercase">
                {aboutContent.subtitle}
              </p>
            )}

            <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              {aboutContent.description}
            </p>

            {aboutContent.secondaryDescription && (
              <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
                {aboutContent.secondaryDescription}
              </p>
            )}

            {/* Facts Grid */}
            {aboutContent.facts && aboutContent.facts.length > 0 && (
              <div className="mt-10 grid grid-cols-2 gap-4">
                {aboutContent.facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Coffee className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                        {fact.label}
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-display font-black text-white">
                      {fact.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
