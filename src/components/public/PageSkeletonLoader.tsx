import React from 'react';
import { useContent } from '../../context/ContentContext';
import { motion } from 'motion/react';

// Photorealistic Studio Beverage Commercial Image Assets
import commercialCupPhoto from '../../assets/images/leton_commercial_cup_1787848208620.jpg';
import macroBeanPhoto from '../../assets/images/coffee_bean_macro_1787848225819.jpg';
import angleBeanPhoto from '../../assets/images/coffee_bean_angle_1787848241238.jpg';
import steamVaporPhoto from '../../assets/images/real_steam_vapor_1787848258189.jpg';

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
        scale: 1.03,
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040711] text-slate-100 overflow-hidden select-none px-4"
    >
      {/* 0.0–0.4s: CINEMATIC STUDIO AMBIENT ENVIRONMENT (Deep Navy, Pure Black & Electric Blue/Cyan Glow) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_75%_at_50%_48%,_rgba(15,35,80,0.45),_rgba(4,7,17,0.92)_65%,_#040711_100%)] pointer-events-none" />

      {/* Electric Cyan & Warm Key Light Backdrop Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[520px] sm:h-[520px] bg-[radial-gradient(circle,_rgba(0,229,255,0.14)_0%,_rgba(37,99,235,0.08)_45%,_transparent_72%)] rounded-full blur-3xl pointer-events-none animate-studio-ambient" />

      {/* Subtle Studio Anamorphic Floor Flare */}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[85vw] max-w-md h-[1px] bg-gradient-to-r from-transparent via-[#00E5FF]/25 to-transparent pointer-events-none blur-[0.5px]" />

      {/* 2.5D PHOTOREALISTIC COMMERCIAL PRODUCT STAGE */}
      <div className="relative w-full max-w-xs sm:max-w-sm flex flex-col items-center justify-center">

        {/* 0.4–0.8s: REALISTIC ROASTED COFFEE BEAN PHOTO LAYERS (Depth of Field & Parallax) */}
        {/* Bean 1 (Foreground Left, Sharp Macro Product Photo) */}
        <div className="absolute -left-3 sm:-left-6 top-[22%] z-30 pointer-events-none animate-studio-bean-1">
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.95)] contrast-[1.05]">
            <img
              src={macroBeanPhoto}
              alt="Roasted Coffee Bean"
              className="w-full h-full object-cover scale-110"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Bean 2 (Background Right, Soft Studio Depth Blur) */}
        <div className="absolute -right-2 sm:-right-5 top-[14%] z-10 pointer-events-none filter blur-[1.2px] opacity-75 animate-studio-bean-2">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]">
            <img
              src={angleBeanPhoto}
              alt="Coffee Bean Depth"
              className="w-full h-full object-cover scale-115"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Bean 3 (Foreground Right Lower, Natural Studio Highlights) */}
        <div className="absolute right-0 sm:-right-3 bottom-[24%] z-30 pointer-events-none animate-studio-bean-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden filter drop-shadow-[0_14px_26px_rgba(0,0,0,0.95)] contrast-[1.04]">
            <img
              src={macroBeanPhoto}
              alt="Roasted Bean Macro"
              className="w-full h-full object-cover scale-115 rotate-45"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* 1.5–2.0s: REALISTIC HOT STEAM VAPOR PHOTO (Screen Blend Mode) */}
        <div className="absolute -top-12 inset-x-0 flex justify-center z-20 pointer-events-none mix-blend-screen animate-studio-steam">
          <img
            src={steamVaporPhoto}
            alt="Hot Coffee Steam Vapor"
            className="w-36 sm:w-44 h-48 sm:h-56 object-contain opacity-70 filter blur-[0.4px] contrast-125"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* 0.7–1.3s: HERO PRODUCT COMMERCIAL SHOT (Real Leton Coffee Cup Photography) */}
        <div className="relative z-20 w-full aspect-[9/14] max-h-[50vh] sm:max-h-[54vh] flex items-center justify-center animate-studio-cup">
          
          {/* Real Commercial Photography Cup Container with Seamless Black Studio Vignette */}
          <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden">
            
            {/* Real Product Photo */}
            <img
              src={commercialCupPhoto}
              alt="Leton Coffee Commercial Cup"
              className="w-full h-full object-contain filter drop-shadow-[0_20px_45px_rgba(0,0,0,0.98)] contrast-[1.02] brightness-[0.98]"
              referrerPolicy="no-referrer"
            />

            {/* Seamless Edge Gradient Blend to Dark Navy Studio */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#040711] via-transparent to-[#040711]/40 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#040711]/50 via-transparent to-[#040711]/50 pointer-events-none" />
          </div>

          {/* Realistic Ground Contact Shadow */}
          <div className="absolute -bottom-2 inset-x-8 h-6 bg-black/95 rounded-full filter blur-lg pointer-events-none -z-10" />
        </div>

        {/* 2.0–2.4s: ELEGANT BRAND REVEAL TYPOGRAPHY */}
        <div className="mt-3 sm:mt-4 flex flex-col items-center text-center px-4 z-20 animate-studio-brand">
          {/* Brand Name */}
          <h1 className="font-display font-black text-sm sm:text-base tracking-[0.38em] text-white uppercase drop-shadow-[0_0_16px_rgba(0,229,255,0.45)]">
            {brandName}
          </h1>

          {/* Official Tagline */}
          {tagline && (
            <p className="mt-1 text-[9px] sm:text-[10px] text-cyan-200/70 font-sans tracking-[0.24em] uppercase font-medium max-w-[280px] sm:max-w-xs leading-relaxed">
              {tagline}
            </p>
          )}

          {/* Minimal Electric Cyan Accent Beam */}
          <div className="w-10 h-[1.5px] bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent mt-2.5 shadow-[0_0_8px_#00E5FF]" />
        </div>

      </div>
    </motion.div>
  );
};
