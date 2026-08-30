import React, { useState, useEffect, useRef, useCallback } from 'react';
import { resolveMediaUrl } from '../../utils/api';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryImageSliderProps {
  images: string[];
  alt?: string;
  className?: string;
}

export const StoryImageSlider: React.FC<StoryImageSliderProps> = ({
  images,
  alt = 'Leton Coffee Story',
  className = 'w-full h-80 sm:h-96 lg:h-[450px]',
}) => {
  // Filter out any empty strings
  const validImages = (images || []).filter((img) => typeof img === 'string' && img.trim().length > 0);
  const slideCount = validImages.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);

  // Touch gesture support for mobile swiping
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    if (slideCount <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const prevSlide = useCallback(() => {
    if (slideCount <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Auto-play timer: switch slide every 3.5 seconds when multiple images exist and not paused
  useEffect(() => {
    if (slideCount <= 1 || isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, 3500);

    return () => clearInterval(timer);
  }, [slideCount, isPaused, nextSlide]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      // Swiped left -> Next
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      // Swiped right -> Prev
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // If only 1 image (or none), render clean static image without any slider controls
  if (slideCount <= 1) {
    const singleImage = validImages[0] || '';
    return (
      <div className={`relative ${className} select-none`}>
        <img
          src={resolveMediaUrl(singleImage)}
          alt={alt}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-transparent to-transparent opacity-60 pointer-events-none" />
      </div>
    );
  }

  // Animation variants for smooth sliding/crossfading
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  const currentImage = validImages[currentIndex];

  return (
    <div
      className={`relative ${className} overflow-hidden select-none group`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 280, damping: 30 },
            opacity: { duration: 0.35 },
          }}
          className="absolute inset-0 w-full h-full"
        >
          <img
            src={resolveMediaUrl(currentImage)}
            alt={`${alt} - Slide ${currentIndex + 1}`}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </AnimatePresence>

      {/* Subtle bottom gradient to protect text & badges */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-transparent to-transparent opacity-60 pointer-events-none z-10" />

      {/* Navigation Arrow Left */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          prevSlide();
        }}
        aria-label="Slide Sebelumnya"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/60 hover:bg-slate-900/90 text-white/80 hover:text-white border border-white/10 hover:border-[#00E5FF]/40 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-lg active:scale-95"
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Navigation Arrow Right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          nextSlide();
        }}
        aria-label="Slide Selanjutnya"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/60 hover:bg-slate-900/90 text-white/80 hover:text-white border border-white/10 hover:border-[#00E5FF]/40 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-lg active:scale-95"
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Slide Counter Badge (Top Right) */}
      <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold tracking-wider text-slate-300 pointer-events-none shadow-md">
        <span className="text-[#00E5FF]">{currentIndex + 1}</span> / {slideCount}
      </div>

      {/* Small Indicator Dots (Bottom Center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/10 shadow-lg">
        {validImages.map((_, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              aria-label={`Ke slide ${idx + 1}`}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                isActive
                  ? 'w-5 h-1.5 bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.8)]'
                  : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
