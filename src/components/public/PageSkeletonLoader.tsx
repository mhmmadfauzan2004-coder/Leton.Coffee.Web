import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const tagline = data?.siteSettings?.tagline || '';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        filter: 'blur(6px)',
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090706] text-amber-50 overflow-hidden select-none px-6"
    >
      {/* 1. Subtle Cinematic Warm Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,_rgba(217,119,6,0.08),_transparent_75%)] pointer-events-none" />

      {/* 2. Centered Minimalist Brand Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center text-center max-w-xs sm:max-w-sm w-full"
      >
        {/* Delicate Coffee Steam Vapor Above Logo */}
        <div className="absolute -top-7 inset-x-0 flex items-center justify-center gap-2 pointer-events-none z-10">
          <svg
            className="w-3 h-10 text-amber-300/40 animate-subtle-steam-1"
            viewBox="0 0 16 48"
            fill="none"
          >
            <path
              d="M8 44 C 3 32, 13 20, 7 8 C 5 4, 10 0, 8 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <svg
            className="w-3 h-11 text-amber-200/45 animate-subtle-steam-2"
            viewBox="0 0 16 48"
            fill="none"
          >
            <path
              d="M8 46 C 13 34, 3 22, 9 10 C 11 5, 7 1, 8 0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Soft Amber Glow Behind Logo */}
        <div className="absolute -inset-4 bg-amber-500/10 rounded-full blur-2xl pointer-events-none animate-subtle-glow" />

        {/* Proportional Minimal Logo Mark */}
        <div className="relative mb-5">
          {logoUrl ? (
            <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-[#120F0D] border border-amber-500/20 p-2 shadow-2xl shadow-black/80 flex items-center justify-center">
              <img
                src={logoUrl}
                alt={brandName}
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-[#1E1813] to-[#0E0B09] border border-amber-500/30 shadow-2xl flex items-center justify-center">
              <span className="font-display font-black text-amber-400 text-2xl tracking-wider leading-none">
                {brandName.charAt(0).toUpperCase() || 'L'}
              </span>
            </div>
          )}
        </div>

        {/* Brand Name Typography */}
        <h1 className="font-display font-bold text-sm sm:text-base tracking-[0.28em] text-amber-100 uppercase leading-snug">
          {brandName}
        </h1>

        {/* Subtle Tagline from Website Data */}
        {tagline && (
          <p className="mt-2 text-[10px] sm:text-[11px] text-amber-200/60 font-sans tracking-[0.18em] uppercase font-medium leading-relaxed max-w-[260px]">
            {tagline}
          </p>
        )}

        {/* Minimal Refined Accent Divider */}
        <div className="w-8 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent mt-4 opacity-70" />
      </motion.div>
    </motion.div>
  );
};
