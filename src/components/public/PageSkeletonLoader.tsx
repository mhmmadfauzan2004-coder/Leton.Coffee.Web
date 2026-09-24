import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

// Realistic 3D Roasted Coffee Bean with specular sheen, deep roast texture and golden fissure
interface Realistic3DBeanProps {
  size?: number;
  rotation?: number;
  className?: string;
  glow?: boolean;
}

const Realistic3DBean: React.FC<Realistic3DBeanProps> = ({
  size = 36,
  rotation = 0,
  className = '',
  glow = false
}) => {
  const id = React.useId().replace(/:/g, '');
  const width = size;
  const height = Math.round(size * 1.32);

  return (
    <div
      className={`inline-flex items-center justify-center select-none pointer-events-none transition-transform duration-300 ${className}`}
      style={{
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        filter: glow
          ? 'drop-shadow(0 0 10px rgba(245,158,11,0.85)) drop-shadow(0 4px 10px rgba(0,0,0,0.3))'
          : 'drop-shadow(0 8px 16px rgba(15,23,42,0.28)) drop-shadow(0 2px 5px rgba(0,0,0,0.18))'
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 40 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Deep Dark Roast Radial Body */}
          <radialGradient id={`body-${id}`} cx="34%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#853a10" />
            <stop offset="28%" stopColor="#542106" />
            <stop offset="68%" stopColor="#2e0f03" />
            <stop offset="92%" stopColor="#190601" />
            <stop offset="100%" stopColor="#0c0300" />
          </radialGradient>

          {/* 3D Specular Light Sheen on Upper Dome */}
          <linearGradient id={`sheen-${id}`} x1="15%" y1="10%" x2="85%" y2="80%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="22%" stopColor="#FED7AA" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#9A3412" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          {/* Golden Amber Crease Gradient */}
          <linearGradient id={`crease-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="45%" stopColor="#F59E0B" />
            <stop offset="80%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#451A03" />
          </linearGradient>

          {/* Inner Shadow Depth */}
          <linearGradient id={`rim-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* 1. Main 3D Curved Bean Hull */}
        <path
          d="M20 2 C32 2 38.5 12 38.5 26 C38.5 40 32 50 20 50 C8 50 1.5 40 1.5 26 C1.5 12 8 2 20 2 Z"
          fill={`url(#body-${id})`}
        />

        {/* 2. Beveled Rim Gradient for 3D Roundness */}
        <path
          d="M20 2 C32 2 38.5 12 38.5 26 C38.5 40 32 50 20 50 C8 50 1.5 40 1.5 26 C1.5 12 8 2 20 2 Z"
          fill={`url(#rim-${id})`}
          opacity="0.6"
        />

        {/* 3. Specular Highlight Crescent (Top Left Gloss) */}
        <path
          d="M19 4 C27 4 33 12 33 24 C33 28 32 34 29 40 C34 33 36 26 36 21 C36 10 30 4 20 4 C14 4 9 7 6 12 C9 7 14 4 19 4 Z"
          fill="#FFFFFF"
          opacity="0.22"
        />

        {/* 4. Glossy Specular Dot & Lobe Reflection */}
        <ellipse
          cx="12"
          cy="16"
          rx="5"
          ry="10"
          transform="rotate(-20 12 16)"
          fill={`url(#sheen-${id})`}
        />

        {/* 5. Deep Central Fissure / Crease Shadow */}
        <path
          d="M20 5 Q15.5 17 20.5 26 Q25.5 35 19 47"
          stroke="#0A0301"
          strokeWidth="3.6"
          strokeLinecap="round"
        />

        {/* 6. Glowing Golden Amber Roast Inside Crease */}
        <path
          d="M20 6 Q15.5 17 20.5 26 Q25.5 35 19 46"
          stroke={`url(#crease-${id})`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

// Capsule Progress Bean (Clean 3D Style inside the loading bar)
const CapsuleBarBean: React.FC<{ active: boolean; index: number }> = ({ active }) => (
  <div
    className={`transition-all duration-300 transform flex items-center justify-center ${
      active
        ? 'scale-110 opacity-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)] rotate-6'
        : 'scale-90 opacity-25 grayscale rotate-0'
    }`}
  >
    <Realistic3DBean size={15} rotation={12} glow={active} />
  </div>
);

export interface PageSkeletonLoaderProps {
  onComplete?: () => void;
}

export const PageSkeletonLoader: React.FC<PageSkeletonLoaderProps> = ({ onComplete }) => {
  const { data, isDataReady } = useContent();
  const { siteSettings } = data || {};
  const brandName = siteSettings?.brandName || 'LETON COFFEE';

  // Custom logo from Supabase / Admin CMS
  const customLogoUrl = siteSettings?.logoUrl ? resolveMediaUrl(siteSettings.logoUrl) : '/logo_icon_small.png';
  const [imageError, setImageError] = useState(false);

  // Smooth 0% -> 100% Progressive State
  const [progress, setProgress] = useState(0);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);
  const totalCapsuleBeans = 4;

  // 1. Run smooth progressive animation across 2.2 - 2.5 seconds (0% to 100%)
  useEffect(() => {
    const startTime = performance.now();
    const duration = 2400; // 2.4s smooth progressive fill for the 2-3s loading window

    let animationFrameId: number;

    const updateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressFraction = Math.min(elapsed / duration, 1);

      // Smooth ease-out progressive fill
      const currentPct = Math.min(Math.floor(progressFraction * 100), 100);
      setProgress(currentPct);

      if (progressFraction < 1) {
        animationFrameId = requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
        setIsAnimationFinished(true);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. Complete loading when all beans are 100% lit AND Supabase data is fully ready (with safe fallback)
  useEffect(() => {
    if (isAnimationFinished) {
      if (isDataReady) {
        const timer = setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 300);
        return () => clearTimeout(timer);
      } else {
        const fallbackTimer = setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 1500);
        return () => clearTimeout(fallbackTimer);
      }
    }
  }, [isAnimationFinished, isDataReady, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        filter: 'blur(8px)',
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFFFF] text-slate-900 select-none overflow-hidden px-6"
    >
      {/* 3D Lighting & Ambient Atmosphere: Clean pure white background with subtle cyan reflection */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,_rgba(56,189,248,0.12)_0%,_rgba(240,249,255,0.7)_40%,_#FFFFFF_80%)] pointer-events-none" />

      {/* Soft Ground Diffuse Ambient Shadow */}
      <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-88 h-40 bg-[radial-gradient(ellipse_at_center,_rgba(14,165,233,0.18)_0%,_rgba(15,23,42,0.06)_45%,_transparent_72%)] blur-2xl pointer-events-none" />

      {/* Main Centered 3D Composition Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm w-full">
        
        {/* ========================================================================= */}
        {/* 3D LOGO STAGE WITH FLOATING COFFEE BEANS */}
        {/* ========================================================================= */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          
          {/* --- FLOATING 3D COFFEE BEANS (Around Logo with Asynchronous Depth) --- */}

          {/* Bean 1: Left Medium-Large (Sharp in-focus, Floating Left) */}
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.8 }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
              y: [-5, 6, -5],
              rotate: [-24, -18, -24],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.1 },
              x: { duration: 0.6, delay: 0.1 },
              scale: { duration: 0.6, delay: 0.1 },
              y: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute left-1 sm:left-2 top-[32%] z-20"
          >
            <Realistic3DBean size={40} rotation={-22} />
          </motion.div>

          {/* Bean 2: Top-Left (Slightly blurred depth-of-field effect) */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.7 }}
            animate={{
              opacity: 0.85,
              y: [0, -8, 0],
              rotate: [-12, -4, -12],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.2 },
              y: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute left-12 top-4 z-0 blur-[1px]"
          >
            <Realistic3DBean size={26} rotation={-10} />
          </motion.div>

          {/* Bean 3: Top-Right (Small floating roast fleck) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 0.9,
              y: [2, -6, 2],
              rotate: [32, 40, 32],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.25 },
              y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 5.6, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute right-14 top-8 z-10"
          >
            <Realistic3DBean size={18} rotation={35} />
          </motion.div>

          {/* Bean 4: Right Large (Sharp, Floating Right-Bottom) */}
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.85 }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
              y: [6, -7, 6],
              rotate: [22, 28, 22],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.15 },
              x: { duration: 0.6, delay: 0.15 },
              scale: { duration: 0.6, delay: 0.15 },
              y: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 5.0, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute right-0 sm:right-1 bottom-[28%] z-20"
          >
            <Realistic3DBean size={42} rotation={24} />
          </motion.div>

          {/* Bean 5: Right Accent (Far Depth Blur) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 0.75,
              y: [-4, 5, -4],
              rotate: [45, 52, 45],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.3 },
              y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute right-9 top-[22%] z-0 blur-[1.2px]"
          >
            <Realistic3DBean size={28} rotation={48} />
          </motion.div>

          {/* --- 3D GLOSSY LETON LOGO DISC WITH SMOOTH 3D PERSPECTIVE ANIMATION --- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 15 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [-4, 4, -4],
              rotateY: [-4, 4, -4],
              rotateX: [2, -2, 2],
            }}
            transition={{
              opacity: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
              y: { duration: 4.0, repeat: Infinity, ease: 'easeInOut' },
              rotateY: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
              rotateX: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              perspective: 1000,
              transformStyle: 'preserve-3d',
            }}
            className="relative z-10"
          >
            {/* 3D Convex Badge Outer White Rim & Deep Drop Shadows */}
            <div
              className="w-40 h-40 sm:w-44 sm:h-44 rounded-full p-2.5 bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#E2E8F0] relative flex items-center justify-center"
              style={{
                boxShadow: `
                  0 24px 48px -8px rgba(14,165,233,0.32),
                  0 14px 28px -4px rgba(15,23,42,0.16),
                  inset 0 2px 4px rgba(255,255,255,1),
                  inset 0 -5px 10px rgba(14,165,233,0.22)
                `,
              }}
            >
              {/* Outer Cyan Ring Accent (As seen in 3D mockup) */}
              <div className="absolute inset-0 rounded-full border-[2.5px] border-[#38BDF8]/60 pointer-events-none" />

              {/* Inner Convex Blue/Cyan Dome */}
              <div
                className="w-full h-full rounded-full bg-gradient-to-b from-[#38BDF8] via-[#0284C7] to-[#0369A1] relative overflow-hidden flex items-center justify-center p-3 shadow-inner"
              >
                {/* Glossy Top-Arc Specular Light Reflection */}
                <div className="absolute -top-6 -left-6 right-0 h-28 bg-[radial-gradient(ellipse_at_35%_25%,_rgba(255,255,255,0.75)_0%,_rgba(255,255,255,0)_70%)] pointer-events-none" />

                {/* Bottom Cyan Ambient Bounce Reflection */}
                <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#00E5FF]/40 to-transparent pointer-events-none" />

                {/* Custom Logo Image from Project Asset / Supabase */}
                {customLogoUrl && !imageError ? (
                  <img
                    src={customLogoUrl}
                    alt={brandName}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] relative z-10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  /* High-Fidelity 3D Embossed Fallback Logo if image fails */
                  <div className="relative z-10 flex flex-col items-center justify-center text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]">
                    {/* Cup with Arch Icon */}
                    <svg
                      viewBox="0 0 64 36"
                      className="w-14 h-8 fill-none stroke-white"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 28 C20 10, 44 10, 52 28" />
                      <path d="M26 28 L27 12 L37 12 L38 28 Z" fill="white" />
                      <path d="M30 12 L34 4" strokeWidth="2.5" />
                    </svg>
                    <span className="font-display font-black text-xl tracking-wider uppercase leading-none mt-1">
                      LeTON
                    </span>
                    <span className="text-[9px] font-bold tracking-[0.25em] uppercase opacity-90 mt-0.5">
                      COFFEE
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ========================================================================= */}
        {/* BRAND TYPOGRAPHY (Exactly matching 3D visual reference) */}
        {/* ========================================================================= */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 font-display font-black text-xl sm:text-2xl tracking-[0.22em] text-[#0F172A] uppercase drop-shadow-sm"
        >
          {brandName}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-sm sm:text-base text-[#334155] font-sans tracking-[0.02em] font-medium"
        >
          Bridging Your Desire of Coffee
        </motion.p>

        {/* ========================================================================= */}
        {/* 3D GLOSSY CYAN CAPSULE LOADING BAR */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-7 w-60 sm:w-68 max-w-[calc(100vw-64px)]"
        >
          {/* Glass Capsule Outer Container */}
          <div
            className="h-8 sm:h-9 px-3 rounded-full bg-white/95 border-2 border-[#38BDF8] flex items-center justify-between relative overflow-hidden"
            style={{
              boxShadow: `
                0 6px 20px rgba(56,189,248,0.3),
                0 2px 6px rgba(15,23,42,0.06),
                inset 0 1px 2px rgba(255,255,255,1),
                inset 0 -2px 4px rgba(56,189,248,0.2)
              `,
            }}
          >
            {/* Luminous Cyan Progress Fill Trail */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00E5FF] via-[#38BDF8] to-[#0284C7] rounded-full transition-all duration-150 pointer-events-none"
              style={{
                width: `${progress}%`,
                boxShadow: '0 0 14px rgba(0,229,255,0.75)',
              }}
            />

            {/* Glossy Top Glass Specular Streak */}
            <div className="absolute top-0 inset-x-2 h-2.5 bg-gradient-to-b from-white/80 to-transparent rounded-full pointer-events-none" />

            {/* Roasted Coffee Beans inside Capsule (Lit up as progress advances) */}
            {Array.from({ length: totalCapsuleBeans }).map((_, index) => {
              const beanThreshold = Math.round(((index + 1) / totalCapsuleBeans) * 100);
              const isFilled = progress >= beanThreshold;
              return (
                <div key={index} className="relative z-10 flex items-center justify-center">
                  <CapsuleBarBean active={isFilled} index={index} />
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
