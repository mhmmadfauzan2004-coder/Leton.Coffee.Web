import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { Coffee, Sparkles } from 'lucide-react';

// Custom SVG Coffee Bean Icon
const CoffeeBeanIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C14.07 4 15.96 4.77 17.42 6.04C15.84 7.63 13.97 10.05 13.88 12.87C13.8 15.54 15.48 18.06 17.27 19.86C15.77 20.89 13.96 21.5 12 21.5C6.76 21.5 2.5 17.24 2.5 12C2.5 6.76 6.76 2.5 12 2.5V4ZM10.12 11.13C10.2 8.46 8.52 5.94 6.73 4.14C8.23 3.11 10.04 2.5 12 2.5C12 3.02 11.96 3.53 11.88 4.04C9.72 5.86 8.1 8.5 8.12 11.13C8.15 13.76 9.8 16.38 12 18.2C11.96 18.71 12 19.22 12 19.74C10.04 19.74 8.23 19.13 6.73 18.1C8.52 16.3 10.2 13.78 10.12 11.13Z"
      opacity="0.9"
    />
  </svg>
);

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080E] text-slate-100 overflow-hidden select-none"
    >
      {/* Background Ambience & Atmospheric Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(#00E5FF_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#00E5FF]/10 via-[#2563EB]/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Coffee Beans & Aroma Sparkle Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top Left Floating Bean */}
        <div className="absolute top-16 left-12 md:left-24 text-amber-600/30 animate-float-slow">
          <CoffeeBeanIcon size={38} className="transform -rotate-45" />
        </div>

        {/* Top Right Floating Bean */}
        <div className="absolute top-24 right-16 md:right-32 text-cyan-400/25 animate-float-fast">
          <CoffeeBeanIcon size={28} className="transform rotate-12" />
        </div>

        {/* Bottom Left Floating Bean */}
        <div className="absolute bottom-24 left-16 md:left-36 text-amber-500/20 animate-float-fast">
          <CoffeeBeanIcon size={32} className="transform 45deg" />
        </div>

        {/* Bottom Right Floating Bean */}
        <div className="absolute bottom-20 right-12 md:right-28 text-cyan-500/30 animate-float-slow">
          <CoffeeBeanIcon size={42} className="transform rotate-90" />
        </div>

        {/* Ambient Glowing Dust Dots */}
        <div className="absolute top-1/3 left-1/4 w-1.5 h-1.5 rounded-full bg-[#00E5FF] opacity-40 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-2 h-2 rounded-full bg-cyan-300 opacity-30 blur-[0.5px] animate-pulse" />
        <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-40 blur-[0.5px] animate-pulse" />
      </div>

      {/* Main Center Card Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-6 text-center">
        {/* Animated Glow Border Frame */}
        <div className="relative w-full p-8 sm:p-10 rounded-3xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-[#00E5FF]/10 flex flex-col items-center">
          
          {/* 1. ADMIN CUSTOMIZABLE BRAND LOGO (Top) */}
          <div className="mb-6 flex flex-col items-center">
            {logoUrl ? (
              <div className="relative group p-1 rounded-2xl bg-gradient-to-br from-[#00E5FF]/40 to-[#2563EB]/40 shadow-lg shadow-cyan-500/20">
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="h-14 sm:h-16 w-auto max-w-[160px] object-contain rounded-xl bg-slate-900/90 p-2"
                />
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-[#00E5FF] via-[#00B4D8] to-[#2563EB] flex items-center justify-center font-display font-black text-black text-3xl shadow-xl shadow-cyan-500/30 transform hover:scale-105 transition-transform">
                  {brandName.charAt(0).toUpperCase() || 'L'}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-slate-950 border border-cyan-400 text-[#00E5FF] shadow-md">
                  <Coffee className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* Brand Title */}
            <h1 className="mt-3.5 font-display font-black text-xl sm:text-2xl text-white tracking-widest uppercase flex items-center justify-center gap-2">
              <span>{brandName}</span>
            </h1>
            <p className="text-[10px] font-mono tracking-[0.25em] text-cyan-400/80 uppercase mt-0.5">
              Specialty Coffee & Cyber Social Hub
            </p>
          </div>

          {/* 2. AESTHETIC COFFEE CUP WITH SWIRLING STEAM */}
          <div className="relative my-4 flex flex-col items-center justify-center">
            {/* Swirling Steam Animations (3 Paths) */}
            <div className="absolute -top-12 inset-x-0 flex items-center justify-center gap-2 h-14 pointer-events-none">
              {/* Steam 1 */}
              <svg
                className="w-4 h-12 text-[#00E5FF]/70 animate-steam-1 filter drop-shadow-[0_0_8px_#00E5FF]"
                viewBox="0 0 20 60"
                fill="none"
              >
                <path
                  d="M10 55 C 3 40, 17 25, 8 10 C 5 5, 12 0, 10 0"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              {/* Steam 2 (Center - taller) */}
              <svg
                className="w-5 h-14 text-cyan-300/80 animate-steam-2 filter drop-shadow-[0_0_10px_#00E5FF]"
                viewBox="0 0 20 60"
                fill="none"
              >
                <path
                  d="M10 58 C 18 42, 2 28, 12 12 C 16 6, 8 2, 10 0"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              {/* Steam 3 */}
              <svg
                className="w-4 h-12 text-[#60A5FA]/70 animate-steam-3 filter drop-shadow-[0_0_8px_#2563EB]"
                viewBox="0 0 20 60"
                fill="none"
              >
                <path
                  d="M10 55 C 2 38, 16 22, 9 8 C 6 4, 11 0, 10 0"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Coffee Cup Structure */}
            <div className="relative flex flex-col items-center">
              {/* Cup Body and Handle */}
              <div className="relative">
                {/* Main Ceramic Cup */}
                <div className="w-20 h-14 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/60 rounded-b-2xl rounded-t-sm shadow-lg shadow-cyan-500/20 relative overflow-hidden flex items-start justify-center pt-1">
                  
                  {/* Glowing Coffee Liquid Top Surface */}
                  <div className="w-16 h-3.5 bg-gradient-to-r from-amber-950 via-[#3d1e08] to-amber-900 rounded-[100%] border border-amber-600/40 relative overflow-hidden flex items-center justify-center">
                    {/* Latte Art / Cream Swirl */}
                    <div className="w-6 h-1.5 rounded-full bg-amber-300/50 blur-[0.5px] animate-liquid" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 to-transparent pointer-events-none" />
                  </div>

                  {/* Cup Body Neon Cyber Accent Stripe */}
                  <div className="absolute bottom-2 inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-[#00E5FF]/70 to-transparent" />
                </div>

                {/* Cup Handle */}
                <div className="absolute top-1 -right-4 w-5 h-8 border-2 border-l-0 border-cyan-400/60 rounded-r-xl bg-transparent" />
              </div>

              {/* Saucer / Plate */}
              <div className="w-28 h-3 -mt-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b-2 border-x border-cyan-400/50 rounded-full shadow-md shadow-cyan-500/30" />
            </div>
          </div>

          {/* 3. COFFEE-THEMED LOADING STATUS TEXT */}
          <div className="mt-5 space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[#00E5FF] text-xs font-mono font-semibold tracking-wider uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Menyeduh Data Terbaru...</span>
            </div>
            
            <p className="text-xs text-slate-400 font-sans">
              Menyiapkan racikan menu, info cabang, & visual Leton Coffee
            </p>
          </div>

          {/* 4. NEON GLOW PROGRESS BAR */}
          <div className="w-full mt-6 space-y-2">
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden p-[1px] border border-cyan-500/30 relative">
              {/* Shimmer Neon Glow Sliding Beam */}
              <div className="h-full bg-gradient-to-r from-[#00E5FF] via-cyan-300 to-[#2563EB] rounded-full animate-neon-pulse relative overflow-hidden">
                <div className="absolute inset-0 bg-white/40 skew-x-12 animate-[shimmer_1.5s_infinite_linear]" />
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1">
              <span>LETON CLOUD SYNC</span>
              <span className="text-cyan-400 font-bold tracking-widest">SIAP SAJI</span>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};
