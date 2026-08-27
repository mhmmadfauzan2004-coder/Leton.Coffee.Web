import React from 'react';
import { useContent } from '../../context/ContentContext';
import { motion } from 'motion/react';
import cupPhotoVertical from '../../assets/images/leton_cup_vertical_1787846365952.jpg';
import cupPhotoHero from '../../assets/images/leton_cup_photo_1787846346422.jpg';

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const tagline = data?.siteSettings?.tagline || 'EVERYDAY SPECIALTY COFFEE & YOUTH CULTURE';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        filter: 'blur(10px)',
        scale: 1.02,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070403] text-amber-50 overflow-hidden select-none"
    >
      {/* 1. CINEMATIC LUXURY COMMERCIAL BACKGROUND & LIGHTING */}
      {/* Dark Espresso Studio Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_40%,_rgba(180,83,9,0.14),_rgba(80,30,8,0.05)_55%,_#070403_85%)] pointer-events-none" />

      {/* Warm Golden Key-Light Pulse behind product */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[460px] sm:h-[460px] bg-amber-600/12 rounded-full blur-3xl pointer-events-none animate-ambient-glow" />

      {/* 2. PHOTOREALISTIC COMMERCIAL PRODUCT HERO CONTAINER */}
      <div className="relative w-full max-w-sm sm:max-w-md flex flex-col items-center justify-center px-4">
        
        {/* Real Product Photography Frame (2.5D Studio Motion) */}
        <div className="relative w-full aspect-[3/4] max-h-[52vh] sm:max-h-[56vh] flex items-center justify-center animate-camera-drift">
          
          {/* Subtle Studio Lighting Sweep across the photograph */}
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
            <div className="absolute -inset-full w-[200%] h-[200%] bg-gradient-to-r from-transparent via-amber-300/12 to-transparent animate-light-sweep" />
          </div>

          {/* Realistic Hot Steam Wisps Curling Naturally Above Cup Opening */}
          <div className="absolute top-[8%] inset-x-0 flex items-center justify-center gap-3 z-30 pointer-events-none">
            <svg
              className="w-4 h-16 text-amber-200/40 filter blur-[0.5px] animate-natural-steam-1"
              viewBox="0 0 16 64"
              fill="none"
            >
              <path
                d="M8 60 C3 44, 13 28, 7 12 C5 6, 9 0, 8 0"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <svg
              className="w-3.5 h-14 text-amber-300/35 filter blur-[0.4px] animate-natural-steam-2"
              viewBox="0 0 16 64"
              fill="none"
            >
              <path
                d="M8 58 C12 42, 4 28, 9 14 C11 7, 7 1, 8 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Photorealistic Leton Coffee Commercial Picture */}
          <picture className="relative z-10 w-full h-full flex items-center justify-center">
            {/* Mobile Vertical 9:16 High-Res Commercial */}
            <source
              media="(max-width: 640px)"
              srcSet={cupPhotoVertical}
            />
            {/* Tablet/Desktop Studio Product Shot */}
            <img
              src={cupPhotoHero}
              alt="Leton Coffee Commercial"
              className="w-full h-full object-contain rounded-2xl filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)] contrast-[1.03] brightness-[0.98]"
              referrerPolicy="no-referrer"
            />
          </picture>

          {/* Soft Organic Ground Contact Shadow */}
          <div className="absolute bottom-2 inset-x-12 h-6 bg-black/90 rounded-full filter blur-lg pointer-events-none -z-10" />
        </div>

        {/* 3. BRAND REVEAL & TAGLINE (Cinematic Studio Reveal) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 sm:mt-5 flex flex-col items-center text-center px-4"
        >
          {/* Brand Name Typography */}
          <h1 className="font-display font-bold text-sm sm:text-base tracking-[0.34em] text-amber-100 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {brandName}
          </h1>

          {/* Official Website Tagline */}
          {tagline && (
            <p className="mt-1.5 text-[9px] sm:text-[10.5px] text-amber-200/60 font-sans tracking-[0.2em] uppercase font-medium max-w-[280px] sm:max-w-xs leading-relaxed">
              {tagline}
            </p>
          )}

          {/* Delicate Amber Accent Line */}
          <div className="w-10 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent mt-3" />
        </motion.div>

      </div>
    </motion.div>
  );
};
