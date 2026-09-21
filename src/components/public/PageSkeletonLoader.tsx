import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

// Crisp, Minimalist SVG Coffee Bean Icon for Progressive Progress Tracking
const BeanIcon: React.FC<{ active: boolean; index: number }> = ({ active }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all duration-300 transform ${
      active
        ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-110 opacity-100 rotate-12'
        : 'text-slate-800/80 opacity-20 scale-90 rotate-0'
    }`}
    fill="currentColor"
  >
    <ellipse cx="12" cy="12" rx="7" ry="9.5" />
    <path
      d="M12 3.5 C9.5 8, 14.5 16, 12 20.5"
      stroke="#060B18"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export interface PageSkeletonLoaderProps {
  onComplete?: () => void;
}

export const PageSkeletonLoader: React.FC<PageSkeletonLoaderProps> = ({ onComplete }) => {
  const { data, isDataReady } = useContent();
  const { siteSettings } = data || {};
  const brandName = siteSettings?.brandName || 'LETON COFFEE';
  
  // Custom logo from Supabase / Admin CMS
  const customLogoUrl = siteSettings?.logoUrl ? resolveMediaUrl(siteSettings.logoUrl) : '';
  const [imageError, setImageError] = useState(false);

  // Smooth 0% -> 100% Progressive State
  const [progress, setProgress] = useState(0);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);
  const totalBeans = 8;

  // 1. Run smooth progressive animation across 2.2 - 2.5 seconds (0% to 100%)
  useEffect(() => {
    const startTime = performance.now();
    const duration = 2400; // 2.4s smooth progressive fill for the 2-3s loading window

    let animationFrameId: number;

    const updateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressFraction = Math.min(elapsed / duration, 1);
      
      // Smooth linear-to-ease progressive fill
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050814] text-slate-100 select-none overflow-hidden px-6"
    >
      {/* Background Ambient Atmosphere (Deep Navy, Black & Subtle Cyan Accent Glow) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_48%,_rgba(0,229,255,0.08),_rgba(5,8,20,0.94)_65%,_#050814_100%)] pointer-events-none" />

      {/* Subtle Central Glow Behind Logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-[radial-gradient(circle,_rgba(0,229,255,0.14)_0%,_rgba(2,132,199,0.06)_50%,_transparent_75%)] rounded-full blur-3xl animate-loader-pulse pointer-events-none" />

      {/* Centered Minimalist Loading Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm w-full">
        
        {/* 1. LOGO LETON COFFEE (Neon Circle with Soft Glow Pulse, Displays Admin Supabase Logo with Smooth Fade-in) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative group"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#00E5FF] shadow-[0_0_28px_rgba(0,229,255,0.4)] bg-[#070b12] flex items-center justify-center p-0.5 relative">
            {/* Ambient Background & Pulsing Glow inside the Neon Ring (No cup icon) */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0c1427] via-[#070b12] to-[#04070d] flex items-center justify-center relative overflow-hidden select-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,229,255,0.25)_0%,_rgba(2,132,199,0.1)_50%,_transparent_75%)] animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/30 blur-[2px] animate-ping opacity-30" />
            </div>

            {/* Custom Admin Logo Image from Supabase (Fades in smoothly once fetched) */}
            {customLogoUrl && !imageError && (
              <motion.img
                key={customLogoUrl}
                src={customLogoUrl}
                alt={brandName}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                onError={() => setImageError(true)}
                className="absolute inset-0 w-full h-full object-cover rounded-full z-10"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </motion.div>

        {/* 2. NAMA BRAND */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 sm:mt-5 font-display font-black text-lg sm:text-xl tracking-[0.26em] text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
        >
          {brandName}
        </motion.h1>

        {/* 3. EXACT TAGLINE */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-xs sm:text-sm text-cyan-200/75 font-sans tracking-[0.18em] font-medium"
        >
          Bridging your desire of coffee
        </motion.p>

        {/* 4. HORIZONTAL COFFEE BEAN PROGRESS BAR */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-7 w-52 sm:w-60 max-w-[calc(100vw-80px)]"
        >
          {/* Progress Bar Frame */}
          <div className="h-6 sm:h-7 px-3 rounded-full bg-[#080E1C]/90 border border-[#00E5FF]/40 shadow-[0_0_16px_rgba(0,229,255,0.2)] flex items-center justify-between relative overflow-hidden">
            
            {/* Subtle Gradient Backlight Trail based on progress */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#0284C7]/30 to-[#00E5FF]/40 rounded-full transition-all duration-150 pointer-events-none"
              style={{ width: `${progress}%` }}
            />

            {/* Coffee Beans Filling Progressively from Left to Right */}
            {Array.from({ length: totalBeans }).map((_, index) => {
              const beanThreshold = Math.round(((index + 1) / totalBeans) * 100);
              const isFilled = progress >= beanThreshold;
              return (
                <div key={index} className="relative z-10 flex items-center justify-center">
                  <BeanIcon active={isFilled} index={index} />
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
