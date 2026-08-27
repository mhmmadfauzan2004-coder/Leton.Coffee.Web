import React from 'react';
import { Loader2, Sparkles, Coffee } from 'lucide-react';

export const PageSkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#070B12] text-slate-100 overflow-hidden relative">
      {/* Background Ambience & Cyberpunk Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#00E5FF_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Center Brand Loader Overlay */}
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#070B12]/80 backdrop-blur-md">
        <div className="relative flex flex-col items-center">
          {/* Animated Glow Halo */}
          <div className="absolute -inset-4 bg-gradient-to-r from-[#00E5FF]/20 via-[#2563EB]/20 to-[#00E5FF]/20 rounded-3xl blur-xl animate-pulse" />

          <div className="relative p-6 sm:p-8 rounded-2xl bg-slate-950/90 border border-cyan-500/30 shadow-2xl shadow-[#00E5FF]/10 flex flex-col items-center gap-4 max-w-xs w-full text-center">
            {/* Logo Mark */}
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-[#2563EB] flex items-center justify-center font-display font-black text-black text-2xl sm:text-3xl shadow-lg shadow-cyan-500/30">
                L
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-cyan-400/40 text-[#00E5FF]">
                <Coffee className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Brand Name & Loading Indicator */}
            <div>
              <h2 className="font-display font-black text-white text-base sm:text-lg tracking-wider uppercase">
                LETON COFFEE
              </h2>
              <p className="text-[11px] font-mono text-cyan-400/80 uppercase tracking-widest mt-0.5">
                Connecting To Cloud Database...
              </p>
            </div>

            {/* Spinner and Status Bar */}
            <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                <span className="tracking-wider">Memuat Data Terbaru...</span>
              </div>
              
              {/* Shimmering Progress Bar */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00E5FF] to-[#2563EB] w-1/2 rounded-full animate-[shimmer_1.5s_infinite_linear] [animation-name:progress-slide]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Page Skeleton (Mimics Full Page Structure) */}
      <div className="opacity-40 pointer-events-none select-none filter blur-[1px]">
        {/* Navbar Skeleton */}
        <div className="h-20 border-b border-slate-800/60 px-6 flex items-center justify-between">
          <div className="w-36 h-8 bg-slate-800 rounded-xl animate-pulse" />
          <div className="hidden md:flex items-center gap-6">
            <div className="w-16 h-4 bg-slate-800 rounded-md animate-pulse" />
            <div className="w-20 h-4 bg-slate-800 rounded-md animate-pulse" />
            <div className="w-16 h-4 bg-slate-800 rounded-md animate-pulse" />
            <div className="w-20 h-4 bg-slate-800 rounded-md animate-pulse" />
          </div>
          <div className="w-28 h-9 bg-slate-800 rounded-xl animate-pulse" />
        </div>

        {/* Hero Section Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 min-h-[70vh] flex flex-col justify-center items-center text-center gap-6">
          <div className="w-48 h-6 bg-cyan-950/60 border border-cyan-800/40 rounded-full animate-pulse" />
          <div className="w-3/4 max-w-2xl h-14 sm:h-20 bg-slate-800/80 rounded-2xl animate-pulse" />
          <div className="w-2/3 max-w-lg h-6 bg-slate-850 rounded-lg animate-pulse" />
          <div className="flex gap-4 mt-4">
            <div className="w-36 h-12 bg-cyan-500/20 border border-cyan-500/40 rounded-xl animate-pulse" />
            <div className="w-36 h-12 bg-slate-800 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Chapter Section Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="h-72 sm:h-96 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse" />
            <div className="space-y-4">
              <div className="w-32 h-5 bg-cyan-950 border border-cyan-800/40 rounded-full animate-pulse" />
              <div className="w-3/4 h-10 bg-slate-800 rounded-xl animate-pulse" />
              <div className="w-full h-24 bg-slate-850 rounded-xl animate-pulse" />
              <div className="w-40 h-10 bg-slate-800 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
