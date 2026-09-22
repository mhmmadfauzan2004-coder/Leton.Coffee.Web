import React, { useState, useEffect } from 'react';
import { ContentProvider, useContent } from './context/ContentContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
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
import { OrderingSystemModal } from './components/public/ordering/OrderingSystemModal';
import { MessageCircle, ShoppingBag, Lock } from 'lucide-react';
import { createWhatsAppLink } from './utils/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem } from './types';
import { getSupabase } from './utils/supabase';

const AppContent: React.FC = () => {
  const { data, auth, isLoading, isInitialReady, completeLoading } = useContent();

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;

    try {
      const pathname = window.location.pathname || '';
      const hash = window.location.hash || '';

      const isUrlAdmin =
        pathname.startsWith('/admin') ||
        hash.startsWith('#/admin') ||
        hash.startsWith('#admin');

      return isUrlAdmin;
    } catch (err) {
      console.warn('[App] Initial route detection handled:', err);
      return false;
    }
  });

  const [isOrderingOpen, setIsOrderingOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';
      return (
        hash === '#order' ||
        hash === '#/order' ||
        pathname.startsWith('/order')
      );
    } catch {
      return false;
    }
  });
  const [isMemberOnlyFlow, setIsMemberOnlyFlow] = useState<boolean>(false);
  const [orderingMenuItem, setOrderingMenuItem] = useState<MenuItem | null>(null);

  // Sync document title and keep unified single PWA manifest
  useEffect(() => {
    try {
      if (isAdminRoute) {
        document.title = 'Leton Coffee — Dashboard Admin';
      } else {
        document.title = 'Leton Coffee — Website Profil & Online Ordering';
      }
    } catch (err) {
      console.warn('[App] Title update handled:', err);
    }
  }, [isAdminRoute]);

  // Listen to popstate / hash change
  useEffect(() => {
    const handleLocationChange = () => {
      try {
        const pathname = window.location.pathname || '';
        const hash = window.location.hash || '';

        const isPathAdmin =
          pathname.startsWith('/admin') ||
          hash.startsWith('#/admin') ||
          hash.startsWith('#admin');
        
        setIsAdminRoute(isPathAdmin);

        const isOrder =
          hash === '#order' ||
          hash === '#/order' ||
          pathname.startsWith('/order');
        if (isOrder) {
          setIsOrderingOpen(true);
        }
      } catch (err) {
        console.warn('[App] Location change handled:', err);
      }
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
    try { window.history.pushState(null, '', '#admin'); } catch {}
  };

  const closeAdmin = () => {
    setIsAdminRoute(false);
    try { window.history.pushState(null, '', '/#home'); } catch {}
  };

  const openMember = () => {
    setIsMemberOnlyFlow(true);
    setIsOrderingOpen(true);
  };

  const openOrdering = async (item?: MenuItem) => {
    setIsMemberOnlyFlow(false);
    setOrderingMenuItem(item || null);
    try {
      const client = getSupabase();
      await client.auth.getSession();
    } catch (err) {
      console.warn('Error checking session in openOrdering:', err);
    }
    setIsOrderingOpen(true);
  };

  const closeOrdering = () => {
    setIsOrderingOpen(false);
    setIsMemberOnlyFlow(false);
    setOrderingMenuItem(null);
    try {
      if (window.location.hash === '#order' || window.location.hash === '#/order') {
        window.history.pushState(null, '', '#home');
      }
    } catch {}
  };

  // Chapter 5 & Chapter 6 branches
  const branchesList = data?.branches || [];
  const chapter5 = branchesList.find((b) => b.id === 'chapter-5') || branchesList[0];
  const chapter6 = branchesList.find((b) => b.id === 'chapter-6') || branchesList[1];

  const floatingWhatsAppLink = createWhatsAppLink(
    data?.contactSettings?.whatsapp || '',
    `Halo ${data?.siteSettings?.brandName || 'Leton Coffee'}, saya ingin pesan kopi / info meja.`
  );

  return (
    <div className="relative min-h-screen bg-[#F8FBFF] text-[#172033] selection:bg-[#38BDF8] selection:text-white">
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
            <Navbar onOpenMember={openMember} onOpenOrder={() => openOrdering()} />

            {/* 01 — HOME / HERO */}
            <HeroSection onOpenOrder={() => openOrdering()} />

            {/* 02 — CHAPTER 5 (Dumai Sudirman) */}
            {chapter5 && <ChapterSection branch={chapter5} reversed={false} />}

            {/* 03 — CHAPTER 6 (Dumai Ratu Sima) */}
            {chapter6 && <ChapterSection branch={chapter6} reversed={true} />}

            {/* 04 — LET’GO (Mobile Coffee) */}
            <MobileTruckSection />

            {/* 05 — LETON OPEN BOOTH */}
            <OpenBoothSection />

            {/* 06 — MENU */}
            <MenuSection onOpenOrder={(item) => openOrdering(item)} />

            {/* 06 — BARISTAS TEAM */}
            <BaristasSection />

            {/* 07 — ABOUT */}
            <AboutSection />

            {/* 08 — CONTACT & FOOTER */}
            <ContactSection />

            {/* Floating Action Buttons (Bottom Left: WhatsApp & Discreet Admin Lock) */}
            <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2.5">
              <a
                href={floatingWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Order via WhatsApp"
                id="floating-whatsapp-btn"
                aria-label="Order via WhatsApp"
                className="p-3.5 rounded-full bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 shadow-2xl shadow-[#00E5FF]/40 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 group"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 font-display font-bold text-xs uppercase group-hover:ml-2">
                  Order WhatsApp
                </span>
              </a>

              {/* Discreet Admin Lock Button (🔒) */}
              <button
                onClick={openAdmin}
                id="admin-lock-access-btn"
                title="Portal Login Admin"
                aria-label="Portal Login Admin"
                className="p-3 rounded-full bg-slate-900/85 hover:bg-slate-900 text-slate-400 hover:text-[#00E5FF] border border-slate-700/60 hover:border-[#00E5FF]/60 shadow-xl backdrop-blur-md flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer group"
              >
                <Lock className="w-4 h-4 transition-transform group-hover:rotate-12" />
              </button>
            </div>

            {/* Floating Action Button (Online Ordering - Bottom Right) */}
            <div className="fixed bottom-5 right-5 z-40">
              <button
                onClick={() => openOrdering()}
                id="floating-order-now-btn"
                className="px-5 py-3.5 rounded-full bg-gradient-to-r from-[#00E5FF] via-[#38BDF8] to-[#0284C7] hover:from-[#38BDF8] hover:to-[#0369A1] text-slate-950 font-display font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xl shadow-cyan-500/40 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-slate-950" />
                <span>ORDER NOW</span>
              </button>
            </div>

            {/* Online Ordering System Modal */}
            <OrderingSystemModal
              isOpen={isOrderingOpen}
              onClose={closeOrdering}
              preSelectedMenuItem={orderingMenuItem}
              isMemberOnlyFlow={isMemberOnlyFlow}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ContentProvider>
        <AppContent />
      </ContentProvider>
    </ErrorBoundary>
  );
}
