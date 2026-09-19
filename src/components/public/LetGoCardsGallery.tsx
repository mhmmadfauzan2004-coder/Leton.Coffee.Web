import React, { useState, useRef, useEffect, useCallback } from 'react';
import { resolveMediaUrl } from '../../utils/api';
import { initialLetonData } from '../../data/initialData';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Maximize2, Image as ImageIcon } from 'lucide-react';

interface LetGoCardsGalleryProps {
  images?: string[];
  sectionLabel?: string;
}

const DEFAULT_LET_GO_IMAGES: string[] =
  initialLetonData.mobileService?.letGoGalleryImages || [];

export const LetGoCardsGallery: React.FC<LetGoCardsGalleryProps> = ({
  images = [],
  sectionLabel = "LET'GO",
}) => {
  // Use provided images if available and non-empty, otherwise default placeholders
  const rawList = Array.isArray(images) && images.length > 0 ? images : DEFAULT_LET_GO_IMAGES;
  const validImages = rawList.filter((img) => typeof img === 'string' && img.trim().length > 0);

  const displayImages = validImages.length > 0 ? validImages : DEFAULT_LET_GO_IMAGES;
  const total = displayImages.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // If no images at all, don't show empty block
  if (total === 0) return null;

  // Scroll to a specific card index smoothly
  const scrollToCard = useCallback(
    (index: number) => {
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
    },
    [total]
  );

  // Track user swipe / scroll position to update dot indicator
  const handleScroll = () => {
    if (isScrollingRef.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const cards = container.children;
    if (!cards || cards.length === 0) return;

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
    <div className="w-full relative mt-8 sm:mt-12">
      {/* Mini header for gallery */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#0284C7]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748B]">
            Galeri Suasana {sectionLabel}
          </span>
        </div>
        {total > 1 && (
          <span className="text-xs font-mono font-bold text-[#0284C7] bg-[#E0F2FE] px-2.5 py-0.5 rounded-full">
            {activeIndex + 1} / {total}
          </span>
        )}
      </div>

      {/* Horizontal Cards Row Container */}
      <div className="relative group/cards w-full">
        {/* Scrollable Track (Cards Row with Peeking next card on Mobile) */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="w-full flex items-stretch gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none py-2 px-1 touch-pan-x cursor-grab active:cursor-grabbing"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {displayImages.map((imgUrl, idx) => {
            const resolved = resolveMediaUrl(imgUrl);
            const isCurrent = activeIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                className={`w-[82%] sm:w-[50%] md:w-[38%] lg:w-[32%] shrink-0 snap-start relative aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer group/card bg-white shadow-md select-none ${
                  isCurrent
                    ? 'border-[#0284C7] ring-2 ring-[#0284C7]/20 shadow-xl'
                    : 'border-[#E0F2FE] hover:border-[#BAE6FD] hover:shadow-lg'
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

                {/* Photo Index Tag */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] sm:text-xs font-mono font-bold text-[#0284C7] border border-[#E0F2FE] shadow-sm">
                  #{String(idx + 1).padStart(2, '0')}
                </div>

                {/* Zoom indicator on hover */}
                <div className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 backdrop-blur-md text-[#0284C7] opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-none border border-[#E0F2FE] shadow-sm">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimalist Navigation Buttons (Desktop & Tablet) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Geser ke kiri"
              className="hidden sm:flex absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] items-center justify-center transition-all shadow-md cursor-pointer z-10 opacity-0 group-hover/cards:opacity-100 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 text-[#0284C7]" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Geser ke kanan"
              className="hidden sm:flex absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] items-center justify-center transition-all shadow-md cursor-pointer z-10 opacity-0 group-hover/cards:opacity-100 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="w-5 h-5 text-[#0284C7]" />
            </button>
          </>
        )}
      </div>

      {/* Minimalist Dot Position Indicators: ● ○ ○ ○ */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {displayImages.map((_, dotIdx) => {
            const isActive = activeIndex === dotIdx;
            return (
              <button
                key={dotIdx}
                type="button"
                onClick={() => scrollToCard(dotIdx)}
                aria-label={`Lihat foto ${dotIdx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  isActive
                    ? 'w-6 h-2 bg-[#0284C7] shadow-sm'
                    : 'w-2 h-2 bg-[#CBD5E1] hover:bg-[#94A3B8]'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Subtle swipe guidance text on mobile */}
      <p className="text-[11px] font-mono text-[#94A3B8] text-center sm:hidden mt-2.5">
        ← Geser foto ke kiri / kanan →
      </p>

      {/* Lightbox Modal for High-Def View */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0F172A]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
              <span className="text-xs font-mono font-bold text-white bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                {sectionLabel} • FOTO {lightboxIndex + 1} DARI {total}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(null);
                }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer border border-white/20"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Main Image */}
            <div
              className="relative max-w-5xl max-h-[80vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={resolveMediaUrl(displayImages[lightboxIndex])}
                alt={`${sectionLabel} - Foto ${lightboxIndex + 1}`}
                referrerPolicy="no-referrer"
                className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20 bg-black/40"
              />

              {/* Prev / Next in Lightbox */}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : total - 1));
                    }}
                    aria-label="Foto Sebelumnya"
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-[#0284C7] border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev !== null && prev < total - 1 ? prev + 1 : 0));
                    }}
                    aria-label="Foto Berikutnya"
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-[#0284C7] border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
