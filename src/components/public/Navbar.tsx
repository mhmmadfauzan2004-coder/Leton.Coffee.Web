import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { Menu, X, MessageCircle, ShoppingBag, Coffee, User } from 'lucide-react';

interface NavbarProps {
  onOpenMember?: () => void;
  onOpenOrder?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMember, onOpenOrder }) => {
  const { data } = useContent();
  const { siteSettings, contactSettings } = data;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      const sections = [
        'home',
        'chapter-5',
        'chapter-6',
        'let-go',
        'leton-open-booth',
        'menu',
        'baristas',
        'about',
        'contact',
      ];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 220 && rect.bottom >= 220) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Home', href: '#home', id: 'home' },
    { label: 'Sudirman (Ch. 5)', href: '#chapter-5', id: 'chapter-5' },
    { label: 'Kelakap 7 (Ch. 6)', href: '#chapter-6', id: 'chapter-6' },
    { label: "LET'GO", href: '#let-go', id: 'let-go' },
    { label: 'Open Booth', href: '#leton-open-booth', id: 'leton-open-booth' },
    { label: 'Menu', href: '#menu', id: 'menu' },
    { label: 'Baristas', href: '#baristas', id: 'baristas' },
    { label: 'About', href: '#about', id: 'about' },
    { label: 'Contact', href: '#contact', id: 'contact' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const generalWhatsAppLink = createWhatsAppLink(
    contactSettings.whatsapp,
    'Halo Leton Coffee, saya ingin bertanya tentang menu dan reservasi event.'
  );

  return (
    <>
      <header
        id="main-navbar"
        className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#E0F2FE] shadow-[0_1px_8px_rgba(0,0,0,0.03)] transition-all duration-300"
      >
        {/* Main Nav Container */}
        <div className="h-16 sm:h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a
              href="#home"
              onClick={(e) => handleNavClick(e, '#home')}
              className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none"
              id="navbar-brand-logo"
            >
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[#E0F2FE] shadow-sm bg-white shrink-0 flex items-center justify-center">
                {siteSettings.logoUrl ? (
                  <img
                    src={resolveMediaUrl(siteSettings.logoUrl)}
                    alt={siteSettings.brandName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-[#F0F7FF] text-[#0284C7] flex items-center justify-center font-black">
                    <Coffee className="w-5 h-5" />
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center text-left">
                <span className="font-display font-extrabold text-sm sm:text-base md:text-lg tracking-tight text-[#172033] group-hover:text-[#0284C7] transition-colors leading-snug">
                  {siteSettings.brandName || 'LETON COFFEE'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-[#64748B] font-semibold uppercase tracking-wider leading-none mt-0.5">
                  Dumai Specialty Coffee
                </span>
              </div>
            </a>

            {/* Location Status Pill */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#E0F2FE] text-xs font-semibold ml-2">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
              <span>Dumai, Riau • Open Daily 08:00 - 23:00</span>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#F0F7FF]/80 p-1.5 rounded-full border border-[#E0F2FE]">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  id={`nav-link-${item.id}`}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#E0F2FE] text-[#0284C7] font-bold shadow-sm'
                      : 'text-[#64748B] hover:text-[#172033] hover:bg-white'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Action CTAs: WA, Member Profile, Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={generalWhatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              id="navbar-wa-cta"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] shadow-sm transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WA</span>
            </a>

            {onOpenMember && (
              <button
                onClick={onOpenMember}
                id="navbar-member-btn"
                title="Login / Akun Member"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0284C7] text-white flex items-center justify-center shadow-sm hover:bg-[#0369A1] transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-toggle-btn"
              className="p-2 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] hover:text-[#0284C7] lg:hidden focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-white/98 backdrop-blur-2xl animate-fadeIn">
          <div className="flex items-center justify-between p-5 border-b border-[#E0F2FE]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#E0F2FE] shrink-0 bg-[#F0F7FF] flex items-center justify-center">
                <Coffee className="w-5 h-5 text-[#0284C7]" />
              </div>
              <span className="font-display font-black text-lg tracking-tight text-[#172033]">
                {siteSettings.brandName || 'LETON COFFEE'}
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-[#64748B] hover:text-[#172033]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-between">
            <nav className="flex flex-col gap-2">
              {navItems.map((item, idx) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className="flex items-center justify-between py-3 px-3 rounded-xl text-base font-semibold text-[#172033] hover:bg-[#F0F7FF] hover:text-[#0284C7] transition-colors"
                >
                  <span>{item.label}</span>
                  <span className="text-xs font-mono text-[#64748B]">0{idx + 1}</span>
                </a>
              ))}
            </nav>

            <div className="pt-6 border-t border-[#E0F2FE] flex flex-col gap-3">
              {onOpenOrder && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenOrder();
                  }}
                  id="mobile-order-now-cta"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#0284C7] text-white font-bold text-center flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>ORDER ONLINE (PESAN SEKARANG)</span>
                </button>
              )}

              <a
                href={generalWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-white border border-[#E0F2FE] text-[#0284C7] font-bold text-center flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ORDER VIA WHATSAPP</span>
              </a>

              {onOpenMember && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenMember();
                  }}
                  id="mobile-member-btn"
                  className="w-full py-3 px-4 rounded-xl bg-[#F0F7FF] text-[#0284C7] font-bold text-center flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>LOGIN / AKUN MEMBER</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
