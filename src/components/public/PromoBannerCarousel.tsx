import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PromoBanner } from '../../types';
import { resolveMediaUrl } from '../../utils/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PromoBannerCarouselProps {
  banners: PromoBanner[];
  autoSlideInterval?: number; // ms, default 4500 (4.5 seconds)
  className?: string;
  aspectRatioClass?: string;
  showControls?: boolean;
  onBannerClick?: (banner: PromoBanner) => void;
}

export const PromoBannerCarousel: React.FC<PromoBannerCarouselProps> = ({
  banners,
  autoSlideInterval = 4500,
  className = '',
  aspectRatioClass = 'aspect-[16/8] sm:aspect-[16/7] md:aspect-[21/9] lg:aspect-[24/9]',
  showControls = true,
  onBannerClick,
}) => {
  // Ensure we have at least one valid banner to display
  const activeBanners = banners && banners.length > 0 ? banners : [];
  const totalSlides = activeBanners.length;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep index within bounds if totalSlides changes
  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
  }, [totalSlides, currentIndex]);

  const goToNext = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (index: number) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentIndex(index);
    }
  };

  // Auto-slide effect
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      goToNext();
    }, autoSlideInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [totalSlides, isPaused, autoSlideInterval, goToNext]);

  // Touch Swipe Handlers (non-blocking for vertical scroll)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null || totalSlides <= 1) {
      setTouchStartX(null);
      setTouchStartY(null);
      return;
    }

    const touchEndX = e.changedTouches[0]?.clientX ?? touchStartX;
    const touchEndY = e.changedTouches[0]?.clientY ?? touchStartY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Only handle horizontal swipe if horizontal movement is larger than vertical movement
    // and exceeds a threshold of 35px
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        // Swipe Left -> Next
        goToNext();
      } else {
        // Swipe Right -> Prev
        goToPrev();
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  if (totalSlides === 0) {
    return null;
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 select-none group ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Banner Slides Viewport - Clean Full-Width Photos ONLY */}
      <div className={`relative w-full ${aspectRatioClass} max-h-[560px] overflow-hidden`}>
        {activeBanners.map((banner, index) => {
          const isActive = index === currentIndex;
          const isNext = index === (currentIndex + 1) % totalSlides;
          const isPrev = index === (currentIndex - 1 + totalSlides) % totalSlides;
          const isVisible = isActive || isNext || isPrev;

          return (
            <div
              key={banner.id || `banner-slide-${index}`}
              className={`absolute inset-0 w-full h-full transition-all duration-500 ease-out transform ${
                isActive
                  ? 'opacity-100 scale-100 z-10 translate-x-0'
                  : index < currentIndex
                  ? 'opacity-0 scale-95 z-0 -translate-x-full'
                  : 'opacity-0 scale-95 z-0 translate-x-full'
              }`}
              style={{
                pointerEvents: isActive ? 'auto' : 'none',
              }}
              onClick={() => onBannerClick && onBannerClick(banner)}
            >
              {isVisible && (
                <img
                  src={resolveMediaUrl(banner.imageUrl)}
                  alt={banner.title || `Promo Leton ${index + 1}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="w-full h-full object-cover object-center block"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Prev / Next Navigation Arrows */}
      {showControls && totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous Slide"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 text-white shadow-lg backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next Slide"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 text-white shadow-lg backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Bottom Indicator Dots */}
      {totalSlides > 1 && (
        <div className="absolute bottom-3 sm:bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-1.5 sm:gap-2 pointer-events-auto">
          {activeBanners.map((_, dotIdx) => {
            const isCurrent = dotIdx === currentIndex;
            return (
              <button
                key={`dot-${dotIdx}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(dotIdx);
                }}
                aria-label={`Go to slide ${dotIdx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  isCurrent
                    ? 'w-6 sm:w-8 h-2 sm:h-2.5 bg-[#00E5FF] shadow-md shadow-[#00E5FF]/60'
                    : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-white/60 hover:bg-white/90 shadow-xs'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
