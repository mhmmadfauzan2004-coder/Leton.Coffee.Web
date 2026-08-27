import React, { useState, useRef, useEffect, useCallback } from 'react';
import { resolveMediaUrl } from '../../utils/api';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Camera, X, Maximize2 } from 'lucide-react';

interface SectionPhotoGalleryProps {
  images?: string[];
  sectionLabel?: string;
  chapterBadge?: string;
}

export const SectionPhotoGallery: React.FC<SectionPhotoGalleryProps> = ({
  images = [],
  sectionLabel = 'GALERI FOTO',
  chapterBadge,
}) => {
  // Filter out any empty string entries
  const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // If no valid images, return null without disrupting the layout
  if (validImages.length === 0) {
    return null;
  }

  const total = validImages.length;

  // Format index as two digits e.g. 01 / 04
  const formattedCurrent = String(currentIndex + 1).padStart(2, '0');
  const formattedTotal = String(total).padStart(2, '0');

  // Scroll to index smoothly
  const scrollToIndex = useCallback((index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetIndex = Math.max(0, Math.min(total - 1, index));
    setCurrentIndex(targetIndex);

    const slideWidth = container.offsetWidth;
    isScrollingRef.current = true;
    container.scrollTo({
      left: targetIndex * slideWidth,
      behavior: 'smooth',
    });

    setTimeout(() => {
      isScrollingRef.current = false;
    }, 400);
  }, [total]);

  // Handle native scroll/swipe to update current index indicator
  const handleScroll = () => {
    if (isScrollingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const slideWidth = container.offsetWidth;
    if (slideWidth <= 0) return;

    const newIndex = Math.round(scrollLeft / slideWidth);
    if (newIndex >= 0 && newIndex < total && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    } else {
      scrollToIndex(total - 1); // loop around smoothly
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < total - 1) {
      scrollToIndex(currentIndex + 1);
    } else {
      scrollToIndex(0); // loop around smoothly
    }
  };

  // Keyboard navigation when Lightbox is open
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
    <div className="w-full max-w-4xl mx-auto mt-14 sm:mt-20 pt-10 border-t border-white/10 text-center">
      {/* Gallery Header Badge */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur-md text-[#60A5FA] text-xs font-mono tracking-widest uppercase">
          <Camera className="w-3.5 h-3.5 text-[#60A5FA]" />
          <span>{sectionLabel}</span>
          {chapterBadge && <span className="text-slate-400">• {chapterBadge}</span>}
        </div>
      </div>

      {/* Horizontal Swipe Gallery Container */}
      <div className="relative group/gallery">
        {/* Main Swipeable Slide Track */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="w-full overflow-x-auto flex snap-x snap-mandatory scrollbar-none rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/60 border border-white/15 bg-black/40 backdrop-blur-md select-none touch-pan-x"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {validImages.map((imgUrl, idx) => {
            const resolved = resolveMediaUrl(imgUrl);
            return (
              <div
                key={idx}
                className="w-full shrink-0 snap-center snap-always relative aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] overflow-hidden group cursor-pointer bg-slate-950"
                onClick={() => setLightboxIndex(idx)}
              >
                <img
                  src={resolved}
                  alt={`${sectionLabel} - Foto ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Subtle vignette gradient on bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                {/* Zoom Click Icon indicator */}
                <div className="absolute top-4 right-4 p-2 rounded-full bg-black/60 backdrop-blur-md text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-white/10">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Previous Navigation Arrow Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Foto Sebelumnya"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white items-center justify-center backdrop-blur-md transition-all transform hover:scale-110 active:scale-95 shadow-xl cursor-pointer z-10 opacity-80 hover:opacity-100"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Desktop Next Navigation Arrow Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Foto Berikutnya"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white items-center justify-center backdrop-blur-md transition-all transform hover:scale-110 active:scale-95 shadow-xl cursor-pointer z-10 opacity-80 hover:opacity-100"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Minimalist Position Indicator & Controls */}
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-4">
          {/* Mobile Prev Button */}
          {total > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Foto Sebelumnya"
              className="sm:hidden p-2 rounded-lg bg-black/40 border border-white/10 text-slate-300 hover:text-white active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* 01 / 05 Numeric Counter Indicator */}
          <div className="px-4 py-1.5 rounded-full bg-black/50 border border-white/15 backdrop-blur-md">
            <span className="font-mono text-xs font-bold text-[#60A5FA]">
              {formattedCurrent}
            </span>
            <span className="font-mono text-xs text-slate-400 mx-1.5">/</span>
            <span className="font-mono text-xs text-slate-400 font-medium">
              {formattedTotal}
            </span>
          </div>

          {/* Mobile Next Button */}
          {total > 1 && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Foto Berikutnya"
              className="sm:hidden p-2 rounded-lg bg-black/40 border border-white/10 text-slate-300 hover:text-white active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dot Indicators */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {validImages.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => scrollToIndex(dotIdx)}
                aria-label={`Lihat foto ${dotIdx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === dotIdx
                    ? 'w-6 bg-[#60A5FA]'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Mobile Swipe Hint */}
        <p className="text-[11px] font-mono text-slate-300 drop-shadow-md sm:hidden mt-0.5">
          ← Geser layar untuk melihat foto lainnya →
        </p>
      </div>

      {/* Lightbox Modal for High-Def Fullscreen Preview */}
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
              <span className="text-xs font-mono font-bold text-white/90 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                {String(lightboxIndex + 1).padStart(2, '0')} / {formattedTotal}
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

            {/* Lightbox Image */}
            <div
              className="relative max-w-5xl max-h-[80vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={resolveMediaUrl(validImages[lightboxIndex])}
                alt={`${sectionLabel} Fullview`}
                className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />

              {/* Lightbox Prev Button */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : total - 1));
                  }}
                  className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Lightbox Next Button */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) =>
                      prev !== null && prev < total - 1 ? prev + 1 : 0
                    );
                  }}
                  className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2563EB] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
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
