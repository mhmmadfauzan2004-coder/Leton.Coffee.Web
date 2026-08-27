import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const tagline = data?.siteSettings?.tagline || 'EVERYDAY SPECIALTY COFFEE & YOUTH CULTURE';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.03,
        filter: 'blur(8px)',
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0604] text-amber-50 overflow-hidden select-none px-4"
    >
      {/* 1. CINEMATIC BACKGROUND & ATMOSPHERIC WARM LIGHTING */}
      {/* Radial Warm Golden Spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_35%,_rgba(245,158,11,0.18),_rgba(180,83,9,0.06)_50%,_transparent_80%)] pointer-events-none animate-cinematic-spotlight" />
      
      {/* Subtle Warm Caramel Atmosphere Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Atmospheric Micro Ambient Dust/Bokeh */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[20%] left-[25%] w-1.5 h-1.5 rounded-full bg-amber-300/40 blur-[0.5px] animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-[35%] right-[22%] w-2 h-2 rounded-full bg-amber-400/30 blur-[0.8px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '0.8s' }} />
        <div className="absolute bottom-[28%] left-[20%] w-1.5 h-1.5 rounded-full bg-amber-200/40 blur-[0.5px] animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '1.2s' }} />
        <div className="absolute bottom-[32%] right-[28%] w-1 h-1 rounded-full bg-amber-300/30 blur-[0.5px] animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      </div>

      {/* 2. 3D PRODUCT COMMERCIAL STAGE */}
      <div className="relative flex flex-col items-center justify-center perspective-1200 w-full max-w-sm sm:max-w-md py-6">
        
        {/* Floating Coffee Beans (Orbiting with depth) */}
        {/* Bean 1 (Foreground Left) */}
        <div className="absolute left-[8%] sm:left-[14%] top-[24%] z-30 pointer-events-none animate-cinematic-bean-1">
          <svg className="w-7 h-9 sm:w-8 sm:h-10 text-[#3D2314] filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="14" ry="18" fill="url(#beanGrad1)" />
            <path d="M16 4 C13 14, 19 26, 16 36" stroke="#1D0E07" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M17 5 C14.5 15, 20 27, 17 35" stroke="#78350F" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
            <ellipse cx="11" cy="14" rx="4" ry="7" fill="white" opacity="0.12" transform="rotate(-15 11 14)" />
            <defs>
              <linearGradient id="beanGrad1" x1="4" y1="4" x2="28" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#542E18" />
                <stop offset="0.5" stopColor="#371B0D" />
                <stop offset="1" stopColor="#1E0D06" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bean 2 (Background Right, subtle depth blur) */}
        <div className="absolute right-[10%] sm:right-[16%] top-[18%] z-10 pointer-events-none filter blur-[0.8px] animate-cinematic-bean-2">
          <svg className="w-6 h-8 sm:w-7 sm:h-9 text-[#3D2314] filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="13" ry="17" fill="url(#beanGrad2)" />
            <path d="M16 5 C19 15, 13 25, 16 35" stroke="#190C06" strokeWidth="2.2" strokeLinecap="round" />
            <defs>
              <linearGradient id="beanGrad2" x1="6" y1="4" x2="26" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4A2613" />
                <stop offset="1" stopColor="#1A0C06" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bean 3 (Foreground Right Bottom) */}
        <div className="absolute right-[8%] sm:right-[15%] bottom-[32%] z-30 pointer-events-none animate-cinematic-bean-3">
          <svg className="w-6 h-8 sm:w-7 sm:h-9 text-[#3D2314] filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="14" ry="18" fill="url(#beanGrad3)" />
            <path d="M16 4 C13.5 14, 18.5 26, 16 36" stroke="#190C06" strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="11" cy="15" rx="3.5" ry="6" fill="white" opacity="0.15" transform="rotate(-20 11 15)" />
            <defs>
              <linearGradient id="beanGrad3" x1="4" y1="4" x2="28" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5D331B" />
                <stop offset="0.6" stopColor="#3B1E0F" />
                <stop offset="1" stopColor="#1C0C05" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bean 4 (Background Left, subtle depth blur) */}
        <div className="absolute left-[12%] sm:left-[18%] bottom-[38%] z-10 pointer-events-none filter blur-[1px] animate-cinematic-bean-4">
          <svg className="w-5 h-7 text-[#3D2314] opacity-80" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="13" ry="17" fill="url(#beanGrad2)" />
            <path d="M16 5 C13 15, 19 25, 16 35" stroke="#150904" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Hot Coffee Steam Wisps Rising from Cup Rim */}
        <div className="absolute top-[8%] sm:top-[6%] inset-x-0 flex items-center justify-center gap-3 pointer-events-none z-20">
          <svg className="w-4 h-14 text-amber-200/50 animate-cinematic-steam" viewBox="0 0 16 56" fill="none">
            <path d="M8 52 C3 38, 13 24, 7 10 C5 5, 9 0, 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className="w-4 h-16 text-amber-300/40 animate-cinematic-steam" style={{ animationDelay: '0.6s' }} viewBox="0 0 16 56" fill="none">
            <path d="M8 54 C13 40, 3 26, 9 12 C11 6, 7 1, 8 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <svg className="w-3.5 h-12 text-amber-100/35 animate-cinematic-steam" style={{ animationDelay: '1.2s' }} viewBox="0 0 16 56" fill="none">
            <path d="M8 50 C4 36, 12 22, 6 8 C4 4, 8 0, 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        {/* 3D CUP & LID ASSEMBLY */}
        <div className="relative z-20 flex flex-col items-center preserve-3d animate-cinematic-cup">
          
          {/* SCENE 4: ESPRESSO POUR STREAM (Flows into cup mouth) */}
          <div className="absolute -top-16 inset-x-0 flex flex-col items-center pointer-events-none z-10">
            <div className="w-1.5 sm:w-2 h-16 bg-gradient-to-b from-amber-400 via-amber-700 to-[#2E1509] rounded-full shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-cinematic-pour" />
            <div className="w-7 h-2.5 bg-amber-500/80 rounded-full blur-[2px] animate-cinematic-splash" />
          </div>

          {/* SCENE 3: 3D CUP LID (Hovering, descending, and locking) */}
          <div className="relative z-30 preserve-3d animate-cinematic-lid">
            {/* Top Lid Cap with Drinking Spout */}
            <div className="w-28 sm:w-32 h-6 rounded-full bg-gradient-to-b from-[#2A231F] via-[#1A1411] to-[#0E0A08] border-t border-amber-400/40 shadow-[0_6px_12px_rgba(0,0,0,0.7)] flex items-center justify-between px-3">
              {/* Lid Rim Highlight */}
              <div className="w-full h-full flex items-center justify-between px-2 relative">
                {/* Drinking Slot */}
                <div className="w-4 h-1.5 rounded-full bg-black/90 border border-amber-500/20 shadow-inner" />
                <div className="w-2 h-2 rounded-full bg-black/80" />
              </div>
            </div>
            {/* Lid Flange Collar */}
            <div className="w-30 sm:w-34 -mt-1 h-3 rounded-full bg-gradient-to-r from-[#17120F] via-[#241B16] to-[#120D0A] border-b border-black/80 shadow-md mx-auto" />
          </div>

          {/* SCENE 2: 3D CUP BODY */}
          <div className="relative -mt-1.5 w-26 sm:w-30 h-36 sm:h-40 rounded-b-[20px] bg-gradient-to-r from-[#140E0A] via-[#231812] to-[#100B08] border-x border-b border-amber-500/20 shadow-[0_20px_35px_rgba(0,0,0,0.85)] flex flex-col items-center justify-center p-3 overflow-hidden">
            
            {/* Cup Specular Cylindrical Gloss Highlight */}
            <div className="absolute inset-y-0 left-3 w-4 bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none transform -skew-x-3" />
            <div className="absolute inset-y-0 right-4 w-2 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent pointer-events-none" />

            {/* Cup Upper Golden Ring Accent */}
            <div className="absolute top-2 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

            {/* Cup Center Brand Badge / Logo */}
            <div className="relative z-10 flex flex-col items-center justify-center my-auto">
              {logoUrl ? (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 border border-amber-500/30 p-1.5 shadow-xl flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#2E1A0F] to-[#120A05] border border-amber-400/40 shadow-xl flex items-center justify-center">
                  <span className="font-display font-black text-amber-400 text-xl tracking-wider">
                    {brandName.charAt(0).toUpperCase() || 'L'}
                  </span>
                </div>
              )}

              {/* Embossed Brand Wordmark on Cup Sleeve */}
              <div className="mt-2 text-center">
                <span className="font-display font-black text-[9px] sm:text-[10px] tracking-[0.25em] text-amber-200/90 uppercase block leading-none">
                  {brandName}
                </span>
                <span className="text-[6.5px] sm:text-[7px] tracking-[0.2em] text-amber-400/60 uppercase font-semibold mt-0.5 block">
                  SPECIALTY
                </span>
              </div>
            </div>

            {/* Cup Lower Golden Ring Accent */}
            <div className="absolute bottom-3 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>

          {/* Floor Contact Drop Shadow */}
          <div className="w-24 sm:w-28 h-4 rounded-full bg-black/90 filter blur-md -mt-2 animate-cinematic-shadow" />
        </div>

        {/* SCENE 6: BRAND REVEAL & TAGLINE TYPOGRAPHY */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 flex flex-col items-center text-center px-4"
        >
          {/* Brand Name Typography */}
          <h1 className="font-display font-bold text-base sm:text-lg tracking-[0.32em] text-amber-100 uppercase drop-shadow-[0_2px_10px_rgba(245,158,11,0.2)]">
            {brandName}
          </h1>

          {/* Official Tagline */}
          {tagline && (
            <p className="mt-1.5 text-[9.5px] sm:text-[11px] text-amber-200/65 font-sans tracking-[0.2em] uppercase font-medium max-w-[280px] sm:max-w-xs leading-relaxed">
              {tagline}
            </p>
          )}

          {/* Delicate Amber Accent Line */}
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mt-3" />
        </motion.div>

      </div>
    </motion.div>
  );
};
