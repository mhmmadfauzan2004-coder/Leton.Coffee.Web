import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { Menu, X, MessageCircle, Lock } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAdmin }) => {
  const { data } = useContent();
  const { siteSettings, contactSettings } = data;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
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
          if (rect.top <= 200 && rect.bottom >= 200) {
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
    { label: 'HOME', href: '#home', id: 'home' },
    { label: 'CHAPTER 5', href: '#chapter-5', id: 'chapter-5' },
    { label: 'CHAPTER 6', href: '#chapter-6', id: 'chapter-6' },
    { label: "LET'GO", href: '#let-go', id: 'let-go' },
    { label: 'LETON OPEN BOOTH', href: '#leton-open-booth', id: 'leton-open-booth' },
    { label: 'MENU', href: '#menu', id: 'menu' },
    { label: 'BARISTAS', href: '#baristas', id: 'baristas' },
    { label: 'ABOUT', href: '#about', id: 'about' },
    { label: 'CONTACT', href: '#contact', id: 'contact' },
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
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#070b12]/92 backdrop-blur-md border-b border-[#2563EB]/25 py-3 shadow-xl shadow-black/50'
            : 'bg-gradient-to-b from-[#070b12]/85 to-transparent py-4 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo & Brand - Real Profile Image */}
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, '#home')}
            className="flex items-center gap-3 group focus:outline-none"
            id="navbar-brand-logo"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-[#2563EB] shadow-md shadow-[#2563EB]/30 group-hover:border-[#60A5FA] transition-all bg-slate-900 shrink-0">
              {/* Crisp built-in local vector SVG fallback */}
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0c1427] to-[#04070d] flex flex-col items-center justify-center p-1 select-none">
                <svg viewBox="0 0 32 32" className="w-4 h-4 text-[#00E5FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" fill="rgba(0,229,255,0.15)" />
                  <line x1="6" y1="1" x2="6" y2="4" stroke="#60A5FA" />
                  <line x1="10" y1="1" x2="10" y2="4" stroke="#00E5FF" />
                  <line x1="14" y1="1" x2="14" y2="4" stroke="#60A5FA" />
                </svg>
              </div>

              {/* Custom Supabase Logo if present */}
              {siteSettings.logoUrl && (
                <img
                  src={resolveMediaUrl(siteSettings.logoUrl)}
                  alt={siteSettings.brandName}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 z-10"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-lg sm:text-xl tracking-wider text-white group-hover:text-[#60A5FA] transition-colors leading-none">
                {siteSettings.brandName}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#60A5FA] mt-1">
                DUMAI SCENE
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  id={`nav-link-${item.id}`}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`px-3 py-1.5 text-xs xl:text-sm font-semibold tracking-wider transition-all rounded-md relative ${
                    isActive
                      ? 'text-[#60A5FA] font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#2563EB] rounded-full shadow-sm shadow-[#2563EB]" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={generalWhatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              id="navbar-wa-cta"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563EB]/25 hover:shadow-[#2563EB]/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WHATSAPP</span>
            </a>

            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                id="navbar-admin-btn"
                title="Buka Admin CMS"
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-[#60A5FA] transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                title="Buka Admin CMS"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-[#60A5FA]"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-toggle-btn"
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 hover:text-[#60A5FA] focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-[#070b12]/98 backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-[#2563EB] shrink-0 bg-slate-900">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0c1427] to-[#04070d] flex items-center justify-center p-1 select-none">
                  <svg viewBox="0 0 32 32" className="w-4 h-4 text-[#00E5FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" fill="rgba(0,229,255,0.15)" />
                    <line x1="6" y1="1" x2="6" y2="4" stroke="#60A5FA" />
                    <line x1="10" y1="1" x2="10" y2="4" stroke="#00E5FF" />
                    <line x1="14" y1="1" x2="14" y2="4" stroke="#60A5FA" />
                  </svg>
                </div>
                {siteSettings.logoUrl && (
                  <img
                    src={resolveMediaUrl(siteSettings.logoUrl)}
                    alt={siteSettings.brandName}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <span className="font-display font-black text-lg tracking-wider text-white">
                {siteSettings.brandName}
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col justify-between">
            <nav className="flex flex-col gap-4">
              {navItems.map((item, idx) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className="flex items-center justify-between py-3 text-xl font-display font-bold tracking-wider text-slate-200 hover:text-[#60A5FA] border-b border-slate-800/60"
                >
                  <span>{item.label}</span>
                  <span className="text-xs font-mono text-[#60A5FA]/60 font-normal">
                    0{idx + 1}
                  </span>
                </a>
              ))}
            </nav>

            <div className="pt-8 flex flex-col gap-3">
              <a
                href={generalWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2563EB] text-white font-bold text-center flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/25"
              >
                <MessageCircle className="w-5 h-5" />
                <span>ORDER VIA WHATSAPP</span>
              </a>

              {onOpenAdmin && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-[#60A5FA] font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>MASUK ADMIN CMS</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
