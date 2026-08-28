import React, { useState, useRef, useEffect, useCallback } from 'react';
import { resolveMediaUrl } from '../../utils/api';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface OpenBoothCardsGalleryProps {
  images?: string[];
  sectionLabel?: string;
}

export const OpenBoothCardsGallery: React.FC<OpenBoothCardsGalleryProps> = ({
  images = [],
  sectionLabel = 'LETON OPEN BOOTH',
}) => {
  // Filter out invalid/empty strings
  const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // If no images uploaded, gracefully render nothing so no empty boxes appear
  if (validImages.length === 0) {
    return null;
  }

  const total = validImages.length;

  // Scroll to a specific card index smoothly
  const scrollToCard = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const targetIndex = Math.max(0, Math.min(total - 1, index));
    setActiveIndex(targetIndex);

    const cards = container.children;
    if (cards && cards[targetIndex]) {
      const targetCard = cards[targetIndex] as HTMLElement;
      isScrollingRef.current = true;
      container.scrollTo({
        left: targetCard.offsetLeft - container.offsetLeft - 16,
        behavior: 'smooth',
      });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 400);
    }
  }, [total]);

  // Track user swipe / scroll position to update dot indicator
  const handleScroll = () => {
    if (isScrollingRef.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const cards = container.children;
    if (!cards || cards.length === 0) return;

    // Find card closest to scroll left
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;
      const cardLeft = card.offsetLeft - container.offsetLeft - 16;
      const distance = Math.abs(scrollLeft - cardLeft);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    if (closestIndex !== activeIndex) {
      setActiveIndex(closestIndex);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeIndex > 0) {
      scrollToCard(activeIndex - 1);
    } else {
      scrollToCard(total - 1);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeIndex < total - 1) {
      scrollToCard(activeIndex + 1);
    } else {
      scrollToCard(0);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (e.key === 'Escape') setLightboxIndex(null);
        if (e.key === 'ArrowLeft') {
          setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : total - 1));
        }
        if (e.key === 'ArrowRight') {
          setLightboxIndex((prev) => (prev !== null && prev < total - 1 ? prev + 1 : 0));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, total]);

  return (
    <div className="w-full relative mt-8 sm:mt-12 overflow-hidden">
      {/* Horizontal Cards Row Container */}
      <div className="relative group/cards w-full">
        {/* Scrollable Track (Cards Row with Peeking on Mobile) */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="w-full flex items-stretch gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none py-2 px-1 touch-pan-x cursor-grab active:cursor-grabbing"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {validImages.map((imgUrl, idx) => {
            const resolved = resolveMediaUrl(imgUrl);
            const isCurrent = activeIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                className={`w-[80%] sm:w-[50%] md:w-[38%] lg:w-[30%] shrink-0 snap-start relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer group/card bg-slate-950/80 shadow-xl select-none ${
                  isCurrent
                    ? 'border-white/30 shadow-2xl shadow-black/80'
                    : 'border-white/10 opacity-90 hover:opacity-100 hover:border-white/25'
                }`}
              >
                {/* Photo Element */}
                <img
                  src={resolved}
                  alt={`${sectionLabel} - Foto ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover/card:scale-105"
                />

                {/* Subtle vignette layer at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                {/* Photo Index Tag */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] sm:text-xs font-mono font-bold text-white/90 border border-white/15">
                  #{String(idx + 1).padStart(2, '0')}
                </div>

                {/* Zoom indicator on hover */}
                <div className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/80 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Minimalist Subtle Scroll Arrows */}
        {total > 3 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Geser ke kiri"
              className="hidden lg:flex absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-[#2563EB] border border-white/20 text-white items-center justify-center backdrop-blur-md transition-all shadow-xl cursor-pointer z-10 opacity-0 group-hover/cards:opacity-100 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Geser ke kanan"
              className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-[#2563EB] border border-white/20 text-white items-center justify-center backdrop-blur-md transition-all shadow-xl cursor-pointer z-10 opacity-0 group-hover/cards:opacity-100 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Minimalist Dot Position Indicators: ● ○ ○ ○ */}
      {total > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {validImages.map((_, dotIdx) => {
            const isActive = activeIndex === dotIdx;
            return (
              <button
                key={dotIdx}
                type="button"
                onClick={() => scrollToCard(dotIdx)}
                aria-label={`Lihat foto ${dotIdx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  isActive
                    ? 'w-6 h-2 bg-[#60A5FA] shadow-md shadow-[#60A5FA]/40'
                    : 'w-2 h-2 bg-white/25 hover:bg-white/50'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Subtle swipe guidance text on mobile */}
      <p className="text-[11px] font-mono text-slate-300 text-center sm:hidden mt-2 drop-shadow-md">
        ← Geser foto untuk melihat dokumentasi booth →
      </p>

      {/* Lightbox Modal for High-Def View */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
              <span className="text-xs font-mono font-bold text-white/90 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                {String(lightboxIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Image Container */}
            <div
              className="relative max-w-5xl max-h-[80vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={resolveMediaUrl(validImages[lightboxIndex])}
                alt={`${sectionLabel} Full View`}
                className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/15"
              />

              {/* Prev Button */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : total - 1));
                  }}
                  className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Next Button */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) =>
                      prev !== null && prev < total - 1 ? prev + 1 : 0
                    );
                  }}
                  className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
