import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { Coffee, ArrowLeft, User, ShoppingBag, X, Menu, MessageCircle } from 'lucide-react';

export interface CustomerHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showProfile?: boolean;
  isProfileActive?: boolean;
  profileName?: string;
  onOpenProfile?: () => void;
  showCart?: boolean;
  cartCount?: number;
  onOpenCart?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  showWhatsApp?: boolean;
  whatsappLink?: string;
  showMenuToggle?: boolean;
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
  onBrandClick?: () => void;
  showLocationPill?: boolean;
  children?: React.ReactNode;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  showBack,
  onBack,
  showProfile,
  isProfileActive,
  profileName,
  onOpenProfile,
  showCart,
  cartCount = 0,
  onOpenCart,
  showClose,
  onClose,
  showWhatsApp,
  whatsappLink,
  showMenuToggle,
  isMenuOpen,
  onToggleMenu,
  onBrandClick,
  showLocationPill,
  children,
}) => {
  const { data } = useContent();
  const siteSettings = data?.siteSettings || { brandName: 'LETON COFFEE', logoUrl: '' };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#E0F2FE] shadow-[0_1px_8px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="h-16 sm:h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Optional Back Button + Logo & Master Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#E0F2FE] text-[#172033] hover:text-[#0284C7] hover:bg-[#F0F7FF] transition-all cursor-pointer shadow-xs shrink-0"
              title="Kembali"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          <div
            onClick={onBrandClick}
            className={`flex items-center gap-2.5 sm:gap-3 group ${onBrandClick ? 'cursor-pointer' : ''}`}
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[#E0F2FE] shadow-sm bg-white shrink-0 flex items-center justify-center">
              {siteSettings.logoUrl ? (
                <img
                  src={resolveMediaUrl(siteSettings.logoUrl)}
                  alt={siteSettings.brandName || 'Leton Coffee'}
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
          </div>

          {showLocationPill && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#E0F2FE] text-xs font-semibold ml-2">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
              <span>Dumai, Riau • Open Daily 08:00 - 23:00</span>
            </div>
          )}
        </div>

        {/* Center Children (e.g. Nav Links on Desktop) */}
        {children && <div className="hidden lg:flex items-center gap-1">{children}</div>}

        {/* Right Action CTAs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showWhatsApp && whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] shadow-xs transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WA</span>
            </a>
          )}

          {showProfile && onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className={`p-2 sm:px-3.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isProfileActive
                  ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-sm'
                  : profileName
                  ? 'bg-[#F0F7FF] border-[#E0F2FE] text-[#0284C7] hover:bg-[#E0F2FE]'
                  : 'bg-white border-[#E0F2FE] text-[#172033] hover:bg-[#F0F7FF] hover:text-[#0284C7]'
              }`}
              title={profileName ? `Member: ${profileName}` : 'Login / Member'}
            >
              <User className="w-4 h-4 text-current" />
              <span className="hidden sm:inline font-semibold">
                {profileName ? profileName.trim().split(' ')[0] : 'MEMBER'}
              </span>
            </button>
          )}

          {showCart && onOpenCart && (
            <button
              onClick={onOpenCart}
              className="relative p-2 sm:px-3.5 sm:py-2 rounded-xl bg-white border border-[#E0F2FE] text-[#172033] hover:bg-[#F0F7FF] hover:text-[#0284C7] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              title="Keranjang Belanja"
            >
              <ShoppingBag className="w-4 h-4 text-[#0284C7]" />
              <span className="hidden sm:inline uppercase">Keranjang</span>
              {cartCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#0284C7] text-white text-[10px] font-black">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {showClose && onClose && (
            <button
              onClick={onClose}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-[#E0F2FE] text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF] transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
              aria-label="Tutup"
              title="Tutup"
            >
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">Tutup</span>
              <X className="w-5 h-5" />
            </button>
          )}

          {showMenuToggle && onToggleMenu && (
            <button
              onClick={onToggleMenu}
              className="p-2 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] hover:text-[#0284C7] lg:hidden focus:outline-none cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
