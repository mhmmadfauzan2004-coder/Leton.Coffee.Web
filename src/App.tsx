import React, { useState, useEffect } from 'react';
import { ContentProvider, useContent } from './context/ContentContext';
import { Navbar } from './components/public/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { ChapterSection } from './components/public/ChapterSection';
import { MobileTruckSection } from './components/public/MobileTruckSection';
import { OpenBoothSection } from './components/public/OpenBoothSection';
import { MenuSection } from './components/public/MenuSection';
import { BaristasSection } from './components/public/BaristasSection';
import { AboutSection } from './components/public/AboutSection';
import { ContactSection } from './components/public/ContactSection';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { PageSkeletonLoader } from './components/public/PageSkeletonLoader';
import { MessageCircle, Lock } from 'lucide-react';
import { createWhatsAppLink } from './utils/formatters';
import { motion, AnimatePresence } from 'motion/react';

const AppContent: React.FC = () => {
  const { data, auth, isLoading, isInitialReady, completeLoading } = useContent();
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.hash.startsWith('#admin')
    );
  });

  // Listen to popstate / hash change
  useEffect(() => {
    const handleLocationChange = () => {
      const isPathAdmin =
        window.location.pathname.startsWith('/admin') ||
        window.location.hash.startsWith('#/admin') ||
        window.location.hash.startsWith('#admin');
      setIsAdminRoute(isPathAdmin);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const openAdmin = () => {
    setIsAdminRoute(true);
    window.history.pushState(null, '', '#admin');
  };

  const closeAdmin = () => {
    setIsAdminRoute(false);
    window.history.pushState(null, '', '/#home');
  };

  // Chapter 5 & Chapter 6 branches
  const chapter5 = data.branches.find((b) => b.id === 'chapter-5') || data.branches[0];
  const chapter6 = data.branches.find((b) => b.id === 'chapter-6') || data.branches[1];

  const floatingWhatsAppLink = createWhatsAppLink(
    data.contactSettings.whatsapp,
    `Halo ${data.siteSettings.brandName}, saya ingin pesan kopi / info meja.`
  );

  return (
    <div className="relative min-h-screen bg-[#070b12] text-slate-100 selection:bg-[#00E5FF] selection:text-black">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <PageSkeletonLoader key="loading-screen" onComplete={completeLoading} />
        ) : isAdminRoute ? (
          <motion.div
            key="admin-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {auth.isAuthenticated ? (
              <AdminLayout onBackToPublic={closeAdmin} />
            ) : (
              <AdminLogin onBackToPublic={closeAdmin} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="public-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Public Navbar */}
            <Navbar onOpenAdmin={openAdmin} />

            {/* 01 — HOME / HERO */}
            <HeroSection />

            {/* 02 — CHAPTER 5 (Dumai Sudirman) */}
            {chapter5 && <ChapterSection branch={chapter5} reversed={false} />}

            {/* 03 — CHAPTER 6 (Dumai Ratu Sima) */}
            {chapter6 && <ChapterSection branch={chapter6} reversed={true} />}

            {/* 04 — LET’GO (Mobile Coffee) */}
            <MobileTruckSection />

            {/* 05 — LETON OPEN BOOTH */}
            <OpenBoothSection />

            {/* 06 — MENU */}
            <MenuSection />

            {/* 06 — BARISTAS TEAM */}
            <BaristasSection />

            {/* 07 — ABOUT */}
            <AboutSection />

            {/* 08 — CONTACT & FOOTER */}
            <ContactSection onOpenAdmin={openAdmin} />

            {/* Floating Action Button (Quick WhatsApp) */}
            <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2">
              <a
                href={floatingWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Order via WhatsApp"
                className="p-3.5 rounded-full bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 shadow-2xl shadow-[#00E5FF]/40 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 group"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 font-display font-bold text-xs uppercase group-hover:ml-2">
                  Order WhatsApp
                </span>
              </a>

              <button
                onClick={openAdmin}
                title="Buka Admin CMS"
                className="p-3 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-[#00E5FF] shadow-xl flex items-center justify-center transition-all transform hover:scale-105 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <ContentProvider>
      <AppContent />
    </ContentProvider>
  );
}
