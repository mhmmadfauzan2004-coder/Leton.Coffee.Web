import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { Menu, X, MessageCircle, ShoppingBag, Coffee, User } from 'lucide-react';
import { CustomerHeader } from '../common/CustomerHeader';

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
      <CustomerHeader
        onBrandClick={() => {
          const target = document.querySelector('#home');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }}
        showWhatsApp={true}
        whatsappLink={generalWhatsAppLink}
        showProfile={onOpenMember !== undefined}
        onOpenProfile={onOpenMember}
        showMenuToggle={true}
        isMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        showLocationPill={true}
      >
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
      </CustomerHeader>

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
