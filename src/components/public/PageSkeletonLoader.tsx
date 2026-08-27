import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { Sparkles, Coffee } from 'lucide-react';

// Detailed 3D Vector Coffee Bean Component with Rich Shading & Specular Glow
const RealisticCoffeeBean: React.FC<{ size?: number; className?: string; rotation?: number }> = ({
  size = 28,
  className = '',
  rotation = 0,
}) => (
  <div
    style={{ width: size, height: size * 1.35, transform: `rotate(${rotation}deg)` }}
    className={`relative shrink-0 filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.7)] ${className}`}
  >
    {/* Bean Outer Body */}
    <div className="w-full h-full rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-gradient-to-br from-[#5C3215] via-[#2A1408] to-[#120702] border border-amber-600/30 relative overflow-hidden shadow-inner">
      {/* Specular Highlight Gloss */}
      <div className="absolute top-1 left-1.5 w-1/3 h-1/2 bg-gradient-to-b from-amber-200/30 to-transparent rounded-full blur-[1px]" />
      
      {/* Curved Center Fissure / Creep */}
      <svg
        viewBox="0 0 20 30"
        className="absolute inset-0 w-full h-full text-[#150702] stroke-[#120501] fill-none"
      >
        <path
          d="M10 2 C 14 8, 7 15, 11 22 C 12 25, 9 28, 10 29"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Subtle lighter highlight beside fissure */}
        <path
          d="M11 4 C 15 9, 8 16, 12 21"
          stroke="rgba(217, 119, 6, 0.35)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Dark roasted gradient edge */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/60 pointer-events-none" />
    </div>
  </div>
);

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 0.97,
        filter: 'blur(6px)',
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0604] text-amber-50 overflow-hidden select-none"
    >
      {/* 1. WARM GOLDEN BROWN COFFEE SHOP LIGHTING AMBIENCE */}
      {/* Top Overhead Spotlight Beam */}
      <div className="absolute top-0 inset-x-0 h-[85vh] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_rgba(245,158,11,0.22),_rgba(180,83,9,0.08)_50%,_transparent_80%)] pointer-events-none" />
      
      {/* Secondary Ambient Warm Core Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-amber-600/10 via-amber-900/15 to-transparent rounded-full blur-[120px] pointer-events-none animate-warm-pulse" />

      {/* Subtle Aesthetic Grid Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(245,158,11,0.12)_1px,transparent_1px)] [background-size:36px_36px] opacity-25 pointer-events-none" />

      {/* Floating Golden Dust Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/5 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-40 blur-[0.5px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-amber-300 opacity-30 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 rounded-full bg-yellow-200 opacity-40 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/5 w-2 h-2 rounded-full bg-amber-500 opacity-35 blur-[0.5px] animate-pulse" />
      </div>

      {/* 2. 3D HERO VISUAL CONTAINER */}
      <div className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-6 text-center">
        
        {/* --- 3D FLOATING COFFEE BEANS AROUND THE CUP --- */}
        {/* Top-Left Levitating Bean */}
        <div className="absolute -top-6 -left-2 sm:left-4 z-20 animate-bean-1 pointer-events-none">
          <RealisticCoffeeBean size={34} rotation={-35} />
        </div>

        {/* Top-Right Levitating Bean */}
        <div className="absolute -top-10 -right-2 sm:right-6 z-20 animate-bean-2 pointer-events-none">
          <RealisticCoffeeBean size={28} rotation={45} />
        </div>

        {/* Mid-Left Levitating Bean */}
        <div className="absolute top-36 -left-8 sm:-left-4 z-20 animate-bean-3 pointer-events-none">
          <RealisticCoffeeBean size={32} rotation={15} />
        </div>

        {/* Bottom-Right Levitating Bean */}
        <div className="absolute top-44 -right-8 sm:-right-4 z-20 animate-bean-4 pointer-events-none">
          <RealisticCoffeeBean size={38} rotation={-60} />
        </div>

        {/* --- 3D INTERACTIVE COFFEE PAPER CUP STAGE --- */}
        <div className="relative flex flex-col items-center justify-center my-2 sm:my-4 w-full h-[260px]">
          
          {/* A. STEAM VAPOR EMITTING FROM CUP OPENING */}
          <div className="absolute top-6 inset-x-0 flex items-center justify-center gap-3 pointer-events-none z-10">
            <svg
              className="w-3.5 h-14 text-amber-200/60 animate-steam-1 filter drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              viewBox="0 0 20 60"
              fill="none"
            >
              <path
                d="M10 55 C 2 40, 18 25, 8 10 C 5 5, 12 0, 10 0"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <svg
              className="w-4 h-16 text-amber-100/70 animate-steam-2 filter drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]"
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
            <svg
              className="w-3.5 h-14 text-amber-200/60 animate-steam-3 filter drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              viewBox="0 0 20 60"
              fill="none"
            >
              <path
                d="M10 55 C 3 38, 17 22, 9 8 C 6 4, 11 0, 10 0"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* B. LEVITATING COFFEE LID (TUTUP CUP MELAYANG DI ATAS) */}
          <div className="relative z-30 animate-lid-levitate mb-[-10px]">
            {/* 3D Black Paper Cup Lid Structure */}
            <div className="relative flex flex-col items-center">
              {/* Lid Top Spout Ring & Drinking Hole */}
              <div className="w-[124px] h-[18px] rounded-[100%] bg-gradient-to-b from-[#2C2D30] via-[#1A1B1E] to-[#0D0E10] border-t border-amber-500/40 border-x border-slate-700/50 shadow-md relative flex items-center justify-between px-3">
                {/* Drinking Spout Hole (Left raised lip) */}
                <div className="w-4 h-2 rounded-full bg-gradient-to-b from-[#0B0C0E] to-[#1E1F22] border border-amber-500/50 shadow-inner" />
                {/* Air Vent Pin Hole */}
                <div className="w-1.5 h-1.5 rounded-full bg-black/90 border border-slate-700" />
                {/* Right Grip Ridge */}
                <div className="w-3 h-1.5 rounded-full bg-slate-800/80" />
              </div>

              {/* Lid Stepped Middle Tier */}
              <div className="w-[136px] h-[12px] -mt-[6px] rounded-[100%] bg-gradient-to-r from-[#202124] via-[#141518] to-[#0A0B0C] border-b border-amber-600/30 shadow-lg relative" />

              {/* Lid Rim Lower Flange (Snap Collar) */}
              <div className="w-[142px] h-[10px] -mt-[4px] rounded-[100%] bg-gradient-to-r from-[#2A2B2E] via-[#121315] to-[#080809] border-t border-slate-600/40 border-b border-black shadow-xl" />

              {/* Under-Lid Warm Amber Vapor Glow */}
              <div className="absolute -bottom-2 w-24 h-4 bg-amber-500/30 rounded-full blur-md pointer-events-none" />
            </div>
          </div>

          {/* C. 3D ELEGANT BLACK PAPER CUP WITH DYNAMIC ADMIN LOGO */}
          <div className="relative z-20 flex flex-col items-center animate-cup-float">
            
            {/* Cup Opening Rim */}
            <div className="w-[130px] h-[16px] rounded-[100%] bg-gradient-to-r from-[#2A2B2F] via-[#1E1F24] to-[#0E0F12] border-t-2 border-amber-500/50 border-x border-slate-700 relative overflow-hidden flex items-center justify-center shadow-lg">
              {/* Rich Hot Coffee Liquid Top Surface */}
              <div className="w-[116px] h-[10px] rounded-[100%] bg-gradient-to-r from-[#3B1D0B] via-[#1F0C03] to-[#45220E] border border-amber-600/50 relative overflow-hidden flex items-center justify-center">
                <div className="w-8 h-1.5 rounded-full bg-amber-400/40 blur-[0.5px]" />
              </div>
            </div>

            {/* Tapered Cup Body */}
            <div
              style={{
                clipPath: 'polygon(6% 0%, 94% 0%, 82% 100%, 18% 100%)',
              }}
              className="w-[136px] h-[142px] -mt-[6px] bg-gradient-to-r from-[#242529] via-[#131417] to-[#0A0A0C] border-t border-amber-500/30 shadow-2xl relative flex items-center justify-center p-2"
            >
              {/* 3D Cylindrical Highlight & Shadow Overlay */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />

              {/* Luxury Gold Trim Rings on Paper Cup */}
              <div className="absolute top-4 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <div className="absolute bottom-4 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

              {/* --- DYNAMIC ADMIN-CONFIGURED LOGO ON THE PAPER CUP --- */}
              <div className="relative z-10 flex flex-col items-center justify-center p-2">
                {logoUrl ? (
                  <div className="w-14 h-14 rounded-2xl bg-black/70 border border-amber-500/40 p-1.5 shadow-lg shadow-amber-950/60 backdrop-blur-xs flex items-center justify-center transform hover:scale-105 transition-transform">
                    <img
                      src={logoUrl}
                      alt={brandName}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    />
                  </div>
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-900 border border-amber-300/60 p-0.5 shadow-xl shadow-amber-950/80 flex items-center justify-center">
                    <div className="w-full h-full rounded-[14px] bg-[#0E0F12] flex flex-col items-center justify-center text-center">
                      <span className="font-display font-black text-amber-400 text-xl tracking-wider leading-none">
                        {brandName.charAt(0).toUpperCase() || 'L'}
                      </span>
                      <span className="text-[7px] font-mono tracking-widest text-amber-200/90 uppercase mt-0.5">
                        LETON
                      </span>
                    </div>
                  </div>
                )}

                {/* Cup Center Typography */}
                <div className="mt-1 text-center">
                  <p className="text-[9px] font-display font-bold tracking-[0.2em] text-amber-100/90 uppercase drop-shadow-md">
                    {brandName}
                  </p>
                </div>
              </div>
            </div>

            {/* Cup Base Bottom Ring */}
            <div className="w-[88px] h-[8px] -mt-[2px] rounded-[100%] bg-gradient-to-r from-[#1E1F22] via-[#101114] to-[#08080A] border-b border-amber-500/30 shadow-md" />
          </div>

          {/* D. GROUND DROP SHADOW (PULSING WITH LEVITATION) */}
          <div className="w-36 h-4 bg-black/80 rounded-[100%] blur-md mt-1 animate-cup-shadow pointer-events-none" />
        </div>

        {/* 3. BRAND STATUS & COFFEE AESTHETIC TEXT */}
        <div className="mt-4 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-950/90 via-[#221207]/90 to-amber-950/90 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold tracking-widest uppercase shadow-lg shadow-amber-950/40">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>Menyeduh Data Terbaru...</span>
          </div>

          <p className="text-xs text-amber-200/70 font-sans tracking-wide">
            Menyiapkan racikan menu, info cabang, & visual Leton Coffee
          </p>
        </div>

        {/* 4. LUXURY AMBER GOLD NEON PROGRESS BAR */}
        <div className="w-full max-w-xs mt-5 space-y-2">
          <div className="w-full h-2 bg-[#170E08] rounded-full overflow-hidden p-[1px] border border-amber-500/40 shadow-inner relative">
            {/* Shimmer Neon Glow Sliding Beam */}
            <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-[#00E5FF] rounded-full relative overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.6)]">
              <div className="absolute inset-0 bg-white/40 skew-x-12 animate-[shimmer_1.4s_infinite_linear]" />
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-amber-300/80 px-1">
            <span className="flex items-center gap-1">
              <Coffee className="w-3 h-3 text-amber-400 inline" />
              <span>LETON CLOUD SYNC</span>
            </span>
            <span className="text-amber-400 font-bold tracking-widest">SIAP SAJI</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
