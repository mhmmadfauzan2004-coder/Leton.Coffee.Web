import React, { useState, useEffect } from 'react';
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
    className={`relative shrink-0 filter drop-shadow-[0_12px_18px_rgba(0,0,0,0.85)] ${className}`}
  >
    {/* Bean Outer Body */}
    <div className="w-full h-full rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-gradient-to-br from-[#6A3918] via-[#32170A] to-[#120702] border border-amber-600/40 relative overflow-hidden shadow-inner">
      {/* Specular Highlight Gloss */}
      <div className="absolute top-1 left-1.5 w-1/3 h-1/2 bg-gradient-to-b from-amber-200/45 to-transparent rounded-full blur-[0.8px]" />
      
      {/* Curved Center Fissure / Crease */}
      <svg
        viewBox="0 0 20 30"
        className="absolute inset-0 w-full h-full text-[#150702] stroke-[#0D0401] fill-none"
      >
        <path
          d="M10 2 C 14 8, 7 15, 11 22 C 12 25, 9 28, 10 29"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Subtle lighter highlight beside fissure */}
        <path
          d="M11 4 C 15 9, 8 16, 12 21"
          stroke="rgba(245, 158, 11, 0.5)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Dark roasted gradient edge */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/70 pointer-events-none" />
    </div>
  </div>
);

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  // Interactive 3D Cursor / Gyroscope Parallax Tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 16; // -8deg to +8deg
      const y = (e.clientY / innerHeight - 0.5) * -16; // -8deg to +8deg
      setTilt({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 0.96,
        filter: 'blur(10px)',
        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070403] text-amber-50 overflow-hidden select-none"
    >
      {/* 1. WARM GOLDEN BROWN COFFEE SHOP LIGHTING AMBIENCE */}
      {/* Top Overhead Spotlight Beam */}
      <div className="absolute top-0 inset-x-0 h-[85vh] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_rgba(245,158,11,0.28),_rgba(180,83,9,0.1)_50%,_transparent_80%)] pointer-events-none" />
      
      {/* Secondary Ambient Warm Core Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-gradient-to-tr from-amber-600/15 via-amber-900/20 to-transparent rounded-full blur-[130px] pointer-events-none animate-warm-pulse" />

      {/* Subtle Aesthetic Grid Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(245,158,11,0.12)_1px,transparent_1px)] [background-size:36px_36px] opacity-25 pointer-events-none" />

      {/* Floating Golden Dust / Bokeh Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/5 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-40 blur-[0.5px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-amber-300 opacity-30 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-yellow-200 opacity-45 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/5 w-2 h-2 rounded-full bg-amber-500 opacity-35 blur-[0.5px] animate-pulse" />
      </div>

      {/* 2. 3D HERO VISUAL STAGE */}
      <div className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-6 text-center">
        
        {/* 3D PERSPECTIVE CONTAINER */}
        <div
          className="relative perspective-1200 preserve-3d flex flex-col items-center justify-center my-2 sm:my-4 w-full h-[300px]"
          style={{
            transform: `rotateX(${tilt.y * 0.6}deg) rotateY(${tilt.x * 0.6}deg)`,
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* --- 3D FLOATING COFFEE BEANS IN MULTIPLE Z-DEPTH PLANES --- */}
          {/* Front-Top-Left Levitating Bean */}
          <div className="absolute -top-6 -left-3 sm:left-1 z-30 animate-bean-1 pointer-events-none">
            <RealisticCoffeeBean size={34} rotation={-30} />
          </div>

          {/* Deep-Back-Right Levitating Bean */}
          <div className="absolute -top-12 -right-4 sm:right-2 z-10 animate-bean-2 pointer-events-none">
            <RealisticCoffeeBean size={26} rotation={45} />
          </div>

          {/* Foreground Mid-Left Levitating Bean */}
          <div className="absolute top-28 -left-10 sm:-left-8 z-35 animate-bean-3 pointer-events-none">
            <RealisticCoffeeBean size={32} rotation={15} />
          </div>

          {/* Background Bottom-Right Levitating Bean */}
          <div className="absolute top-44 -right-10 sm:-right-6 z-10 animate-bean-4 pointer-events-none">
            <RealisticCoffeeBean size={38} rotation={-55} />
          </div>

          {/* Front Overhead Levitating Bean */}
          <div className="absolute -top-14 right-1/4 z-30 animate-bean-5 pointer-events-none">
            <RealisticCoffeeBean size={22} rotation={20} />
          </div>

          {/* --- 3D MAIN FLOATING CUP ASSEMBLY --- */}
          <div className="relative preserve-3d animate-cup-float flex flex-col items-center">
            
            {/* A. STEAM VAPOR EMITTING FROM CUP / LID */}
            <div className="absolute -top-6 inset-x-0 flex items-center justify-center gap-3 pointer-events-none z-40">
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

            {/* B. COFFEE POURING STREAM ANIMATION */}
            <div className="absolute -top-12 z-25 flex flex-col items-center pointer-events-none animate-coffee-stream">
              {/* Stream Column from Overhead Espresso Machine/Kettle */}
              <div className="w-2.5 sm:w-3 h-[120px] rounded-full bg-gradient-to-b from-[#854D0E] via-[#D97706] to-[#451A03] shadow-[0_0_16px_rgba(245,158,11,0.8)] relative overflow-hidden">
                {/* Inner Crema Gloss Line */}
                <div className="absolute inset-y-0 left-0.5 w-[2px] bg-amber-100/90 rounded-full" />
                {/* Flowing liquid ripples */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-pulse" />
              </div>

              {/* Coffee Impact Splash at the Cup Opening */}
              <div className="w-9 h-2.5 -mt-1 rounded-[100%] bg-amber-400/90 blur-[1px] shadow-[0_0_14px_rgba(245,158,11,1)] animate-coffee-splash" />
            </div>

            {/* C. 3D COFFEE LID (LEVITATES UP & OPENS IN 3D SPACE) */}
            <div className="relative z-30 preserve-3d animate-lid-story mb-[-4px]">
              {/* 3D Black Paper Cup Lid Structure */}
              <div className="relative flex flex-col items-center">
                {/* Lid Top Spout Ring & Drinking Hole */}
                <div className="w-[128px] h-[20px] rounded-[100%] bg-gradient-to-b from-[#35373C] via-[#1E2024] to-[#0E0F12] border-t border-amber-400/50 border-x border-slate-700/60 shadow-lg relative flex items-center justify-between px-3">
                  {/* Drinking Spout Hole (Left raised lip) */}
                  <div className="w-4 h-2.5 rounded-full bg-gradient-to-b from-[#0B0C0E] to-[#25272B] border border-amber-500/60 shadow-inner" />
                  {/* Air Vent Pin Hole */}
                  <div className="w-1.5 h-1.5 rounded-full bg-black/90 border border-slate-600" />
                  {/* Right Grip Ridge */}
                  <div className="w-3.5 h-1.5 rounded-full bg-slate-700/80" />
                </div>

                {/* Lid Stepped Middle Tier */}
                <div className="w-[138px] h-[12px] -mt-[6px] rounded-[100%] bg-gradient-to-r from-[#28292E] via-[#16171A] to-[#0B0C0E] border-b border-amber-600/40 shadow-lg relative" />

                {/* Lid Rim Lower Flange (Snap Collar) */}
                <div className="w-[144px] h-[10px] -mt-[4px] rounded-[100%] bg-gradient-to-r from-[#32343A] via-[#151619] to-[#08080A] border-t border-slate-500/50 border-b border-black shadow-xl" />

                {/* Under-Lid Warm Amber Vapor Glow */}
                <div className="absolute -bottom-2 w-28 h-5 bg-amber-500/35 rounded-full blur-md pointer-events-none" />
              </div>
            </div>

            {/* D. 3D ELEGANT BLACK PAPER CUP WITH DYNAMIC ADMIN LOGO */}
            <div className="relative z-20 preserve-3d flex flex-col items-center">
              
              {/* Cup Opening Rim & Liquid Reservoir */}
              <div className="w-[132px] h-[18px] rounded-[100%] bg-gradient-to-r from-[#32343A] via-[#202227] to-[#0F1014] border-t-2 border-amber-400/60 border-x border-slate-700 relative overflow-hidden flex items-center justify-center shadow-lg">
                {/* Rich Hot Coffee Liquid Top Surface */}
                <div className="w-[118px] h-[12px] rounded-[100%] bg-gradient-to-r from-[#45220E] via-[#240E04] to-[#4F2710] border border-amber-600/60 relative overflow-hidden flex items-center justify-center">
                  {/* Liquid Crema Highlight Ring */}
                  <div className="absolute inset-0 rounded-[100%] border border-amber-400/30" />
                  {/* Dynamic Pouring Splash Ripple Effect */}
                  <div className="w-11 h-2.5 rounded-full bg-amber-400/60 blur-[0.5px] animate-coffee-splash" />
                </div>
              </div>

              {/* Tapered Cup Cylindrical Body */}
              <div
                style={{
                  clipPath: 'polygon(6% 0%, 94% 0%, 82% 100%, 18% 100%)',
                }}
                className="w-[140px] h-[148px] -mt-[6px] bg-gradient-to-r from-[#2D2E33] via-[#141518] to-[#090A0C] border-t border-amber-500/40 shadow-2xl relative flex items-center justify-center p-2"
              >
                {/* 3D Cylindrical Highlight & Shadow Overlay */}
                <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/12 to-transparent pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/85 to-transparent pointer-events-none" />

                {/* Luxury Gold Trim Accent Rings */}
                <div className="absolute top-4 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                <div className="absolute bottom-4 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

                {/* --- 3D EMBOSSED CUP SLEEVE WITH ADMIN LOGO --- */}
                <div className="relative z-10 w-full px-2 py-3 rounded-lg bg-gradient-to-r from-[#1C1D21]/90 via-[#26272C]/90 to-[#101114]/90 border-y border-amber-500/30 shadow-lg backdrop-blur-xs flex flex-col items-center justify-center">
                  
                  {logoUrl ? (
                    <div className="w-14 h-14 rounded-2xl bg-black/80 border border-amber-400/50 p-1.5 shadow-xl shadow-amber-950/70 backdrop-blur-sm flex items-center justify-center transform hover:scale-105 transition-transform">
                      <img
                        src={logoUrl}
                        alt={brandName}
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]"
                      />
                    </div>
                  ) : (
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-900 border border-amber-300/70 p-0.5 shadow-xl shadow-amber-950/80 flex items-center justify-center">
                      <div className="w-full h-full rounded-[14px] bg-[#0C0D10] flex flex-col items-center justify-center text-center">
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
                  <div className="mt-1.5 text-center">
                    <p className="text-[9px] font-display font-black tracking-[0.22em] text-amber-100 uppercase drop-shadow-md">
                      {brandName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cup Base Bottom Ring */}
              <div className="w-[90px] h-[9px] -mt-[2px] rounded-[100%] bg-gradient-to-r from-[#222428] via-[#121316] to-[#070809] border-b border-amber-500/40 shadow-md" />
            </div>

          </div>

          {/* E. GROUND 3D DROP SHADOW (PULSING & EXPANDING WITH LEVITATION) */}
          <div className="w-44 h-5 bg-black/90 rounded-[100%] blur-lg mt-3 animate-cup-shadow pointer-events-none" />
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

        {/* 4. LUXURY AMBER GOLD PROGRESS BAR */}
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
