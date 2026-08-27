import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

// Crisp, Minimalist SVG Coffee Bean Icon for Progress Tracking
const BeanIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all duration-300 transform ${
      active
        ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(0,229,255,0.75)] scale-110 opacity-100 rotate-12'
        : 'text-slate-700/50 opacity-25 scale-90 rotate-0'
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

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const { siteSettings } = data || {};
  const brandName = siteSettings?.brandName || 'LETON COFFEE';
  
  // Exact source used in Navbar/Header for dynamic admin-configured logo
  const logoUrl = siteSettings?.logoUrl
    ? resolveMediaUrl(siteSettings.logoUrl)
    : 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80';

  // Smooth 0% -> 100% Progress State
  const [progress, setProgress] = useState(0);
  const totalBeans = 8;

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1450; // 1.45s smooth progress fill

    let animationFrameId: number;

    const updateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressFraction = Math.min(elapsed / duration, 1);
      
      // Smooth easeOutQuad progress curve
      const easedProgress = 1 - Math.pow(1 - progressFraction, 2);
      setProgress(Math.round(easedProgress * 100));

      if (progressFraction < 1) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_48%,_rgba(37,99,235,0.12),_rgba(5,8,20,0.94)_65%,_#050814_100%)] pointer-events-none" />

      {/* Subtle Central Glow Behind Logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-[radial-gradient(circle,_rgba(0,229,255,0.1)_0%,_rgba(37,99,235,0.05)_50%,_transparent_75%)] rounded-full blur-3xl animate-loader-pulse pointer-events-none" />

      {/* Centered Minimalist Loading Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm w-full">
        
        {/* 1. LOGO LETON COFFEE (Dynamic from Admin Settings) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative group"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-[#2563EB] shadow-[0_0_22px_rgba(37,99,235,0.35)] bg-[#070b12] flex items-center justify-center p-0.5">
            <img
              src={logoUrl}
              alt={brandName}
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
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
          <div className="h-6 sm:h-7 px-3 rounded-full bg-[#080E1C]/90 border border-[#2563EB]/40 shadow-[0_0_16px_rgba(0,229,255,0.14)] flex items-center justify-between relative overflow-hidden">
            
            {/* Subtle Gradient Backlight Trail based on progress */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#2563EB]/25 to-[#00E5FF]/30 rounded-full transition-all duration-150 pointer-events-none"
              style={{ width: `${progress}%` }}
            />

            {/* Coffee Beans Filling from Left to Right */}
            {Array.from({ length: totalBeans }).map((_, index) => {
              const beanThreshold = ((index + 1) / totalBeans) * 100;
              const isFilled = progress >= beanThreshold - (100 / totalBeans / 2);
              return (
                <div key={index} className="relative z-10 flex items-center justify-center">
                  <BeanIcon active={isFilled} />
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
