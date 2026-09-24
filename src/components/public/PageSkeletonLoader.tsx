import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

// Clean, Minimalist Coffee Bean Icon for Progress Bar Tracking
const BeanIcon: React.FC<{ active: boolean; index: number }> = ({ active }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300 transform ${
      active
        ? 'text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.9)] scale-105 opacity-100 rotate-12'
        : 'text-slate-400/40 opacity-30 scale-90 rotate-0'
    }`}
    fill="currentColor"
  >
    <ellipse cx="12" cy="12" rx="7" ry="9.5" />
    <path
      d="M12 3.5 C9.5 8, 14.5 16, 12 20.5"
      stroke="#1E293B"
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

  // Real Project Logo Asset
  const customLogoUrl = siteSettings?.logoUrl ? resolveMediaUrl(siteSettings.logoUrl) : '/logo_icon.jpg';
  const [imageError, setImageError] = useState(false);

  // Progressive Loading State (0% -> 100%)
  const [progress, setProgress] = useState(0);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);
  const totalBeans = 6;

  // 1. Smooth linear-to-ease progressive fill (2.2s - 2.4s)
  useEffect(() => {
    const startTime = performance.now();
    const duration = 2400; // 2.4s smooth progressive window

    let animationFrameId: number;

    const updateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressFraction = Math.min(elapsed / duration, 1);
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

  // 2. Complete loading when progress hits 100% and initial data is ready
  useEffect(() => {
    if (isAnimationFinished) {
      if (isDataReady) {
        const timer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 300);
        return () => clearTimeout(timer);
      } else {
        const fallbackTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 1200);
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
        filter: 'blur(6px)',
        transition: { duration: 0.4, ease: 'easeOut' },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFFFF] text-slate-900 select-none overflow-hidden px-6"
    >
      {/* Subtle Light Cyan Ambient Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_rgba(56,189,248,0.08)_0%,_rgba(240,249,255,0.5)_50%,_#FFFFFF_85%)] pointer-events-none" />

      {/* Main Center Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm w-full">
        
        {/* 1. AUTHENTIC LETON COFFEE LOGO (Cyan Ring, Clean & Medium Sized) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-white border-[3px] border-[#38BDF8] shadow-[0_4px_20px_rgba(56,189,248,0.25)] flex items-center justify-center overflow-hidden">
            {!imageError ? (
              <img
                src={customLogoUrl}
                alt={brandName}
                onError={() => {
                  if (customLogoUrl !== '/logo_icon_small.png' && customLogoUrl !== '/logo_icon.jpg') {
                    const fallbackImg = new Image();
                    fallbackImg.src = '/logo_icon.jpg';
                    fallbackImg.onload = () => {};
                    fallbackImg.onerror = () => setImageError(true);
                  } else {
                    setImageError(true);
                  }
                }}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              /* High-Quality Fallback Emblem */
              <div className="w-full h-full rounded-full bg-[#0284C7] flex flex-col items-center justify-center text-white p-1">
                <span className="font-display font-black text-sm tracking-wider uppercase leading-none">
                  LeTON
                </span>
                <span className="text-[7px] font-bold tracking-[0.2em] uppercase opacity-90 mt-0.5">
                  COFFEE
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* 2. BRAND TITLE: LETON COFFEE */}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 sm:mt-5 font-display font-black text-lg sm:text-xl tracking-[0.22em] text-[#0F172A] uppercase"
        >
          {brandName}
        </motion.h1>

        {/* 3. TAGLINE: Bridging Your Desire of Coffee */}
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1 text-xs sm:text-sm text-[#334155] font-sans tracking-[0.01em] font-medium"
        >
          Bridging Your Desire of Coffee
        </motion.p>

        {/* 4. LOADING BAR (Pill shape, Cyan outline, Progress with coffee bean indicators) */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-7 w-52 sm:w-60 max-w-[calc(100vw-64px)]"
        >
          {/* Pill Capsule Frame */}
          <div className="h-7 sm:h-8 px-2.5 rounded-full bg-white border-2 border-[#38BDF8] shadow-[0_2px_10px_rgba(56,189,248,0.2)] flex items-center justify-between relative overflow-hidden">
            
            {/* Smooth Cyan Progress Fill Trail */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#38BDF8] to-[#0284C7] rounded-full transition-all duration-150 pointer-events-none opacity-85"
              style={{ width: `${progress}%` }}
            />

            {/* Coffee Bean Progress Tracking Icons */}
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
