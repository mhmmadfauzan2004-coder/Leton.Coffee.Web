import React, { useState, useEffect, useRef } from 'react';
import {
  OrderOutlet,
  CartItem,
  MenuItem,
  CustomerOrder,
  OrderType,
  PaymentMethod,
  AddOnOption,
  CustomerProfile,
  SelectedCustomOption,
} from '../../../types';
import { OutletSelector } from './OutletSelector';
import { OrderMenu } from './OrderMenu';
import { OrderCartDrawer } from './OrderCartDrawer';
import { OrderCheckout } from './OrderCheckout';
import { OrderConfirmation } from './OrderConfirmation';
import CustomerAuthForm from './CustomerAuthForm';
import CustomerProfileTab from './CustomerProfileTab';
import { createNewOrder, generateOrderNumber } from '../../../utils/supabaseOrders';
import { findOrCreateCustomerMember } from '../../../utils/supabaseCustomers';
import { getCurrentCustomerProfile, getSupabase, logoutCustomer } from '../../../utils/supabase';
import { getCustomerLoyalty } from '../../../utils/supabaseLoyalty';
import {
  DEFAULT_SIZE,
  DEFAULT_TOPPING,
  DEFAULT_SYRUP,
  generateCartItemId,
  calculateItemUnitPrice,
} from '../../../data/addOnsData';
import { X, ArrowLeft, ArrowRight, ShoppingBag, User, UserPlus, LogIn, UserCheck, Award } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { ErrorBoundary } from '../../common/ErrorBoundary';

interface OrderingSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedMenuItem?: MenuItem | null;
  isMemberOnlyFlow?: boolean;
}

export const OrderingSystemModal: React.FC<OrderingSystemModalProps> = ({
  isOpen,
  onClose,
  preSelectedMenuItem,
  isMemberOnlyFlow = false,
}) => {
  const [selectedOutlet, setSelectedOutlet] = useState<OrderOutlet | null>(() => {
    try {
      const saved = localStorage.getItem('leton_selected_outlet');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.id === 'string') {
          return parsed;
        }
      }
    } catch {
      return null;
    }
    return null;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('leton_ordering_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => item && item.product && typeof item.product.id === 'string');
        }
      }
    } catch {
      return [];
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [generalNote, setGeneralNote] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<
    'member_choice' | 'outlet' | 'menu' | 'checkout' | 'confirmation' | 'profile'
  >('member_choice');
  const [memberChoiceStep, setMemberChoiceStep] = useState<'choice' | 'register' | 'login'>('choice');
  const [completedOrder, setCompletedOrder] = useState<CustomerOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pendingCustomizeItem, setPendingCustomizeItem] = useState<MenuItem | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Sync active customer profile session on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      setCheckingAuth(true);
      const syncProfile = async () => {
        try {
          const profile = await getCurrentCustomerProfile();
          setCustomerProfile(profile);
          if (isMemberOnlyFlow) {
            if (profile) {
              setCurrentStep('profile');
            } else {
              setCurrentStep('member_choice');
              setMemberChoiceStep('choice');
            }
          } else {
            if (profile) {
              // Logged in as member -> proceed directly to menu / outlet
              setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
            } else {
              // Not logged in -> show HALAMAN MEMBER choice screen
              setCurrentStep('member_choice');
              setMemberChoiceStep('choice');
            }
          }
        } catch (err) {
          console.warn('Error syncing customer profile:', err);
          setCustomerProfile(null);
          setCurrentStep('member_choice');
          setMemberChoiceStep('choice');
        } finally {
          setCheckingAuth(false);
        }
      };
      syncProfile();
    }
  }, [isOpen, isMemberOnlyFlow]);

  // Scroll reset helper for modal and window
  const scrollToTop = () => {
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTop = 0;
      if (typeof modalContainerRef.current.scrollTo === 'function') {
        modalContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  };

  // Automatically reset scroll whenever step changes, especially upon entering confirmation
  useEffect(() => {
    scrollToTop();
    const rafId = requestAnimationFrame(() => {
      scrollToTop();
    });
    const t1 = setTimeout(scrollToTop, 20);
    const t2 = setTimeout(scrollToTop, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentStep]);

  // Sync cart to localStorage
  useEffect(() => {
    localStorage.setItem('leton_ordering_cart', JSON.stringify(cart));
  }, [cart]);

  // Sync outlet to localStorage
  useEffect(() => {
    if (selectedOutlet) {
      localStorage.setItem('leton_selected_outlet', JSON.stringify(selectedOutlet));
    }
  }, [selectedOutlet]);

  // If a menu item was clicked from the public page, set it to customize
  useEffect(() => {
    if (isOpen && preSelectedMenuItem) {
      setPendingCustomizeItem(preSelectedMenuItem);
    }
  }, [isOpen, preSelectedMenuItem]);

  if (!isOpen) return null;

  // Cart operations with Add-ons
  const handleAddToCart = (
    product: MenuItem,
    size: AddOnOption = DEFAULT_SIZE,
    topping: AddOnOption = DEFAULT_TOPPING,
    syrup: AddOnOption = DEFAULT_SYRUP,
    quantity: number = 1,
    note?: string,
    customOptions?: SelectedCustomOption[]
  ) => {
    const cartItemId = generateCartItemId(product.id, size.name, topping.name, syrup.name, customOptions);
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          (item.id ||
            generateCartItemId(
              item.product.id,
              item.size?.name,
              item.topping?.name,
              item.syrup?.name,
              item.customOptions
            )) === cartItemId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          note: note !== undefined ? note : updated[existingIndex].note,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            product,
            quantity,
            size,
            topping,
            syrup,
            customOptions,
            note,
          },
        ];
      }
    });
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          const id =
            item.id ||
            generateCartItemId(
              item.product.id,
              item.size?.name,
              item.topping?.name,
              item.syrup?.name,
              item.customOptions
            );
          if (id === cartItemId || item.product.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart((prev) =>
      prev.filter((item) => {
        const id =
          item.id ||
          generateCartItemId(
            item.product.id,
            item.size?.name,
            item.topping?.name,
            item.syrup?.name,
            item.customOptions
          );
        return id !== cartItemId && item.product.id !== cartItemId;
      })
    );
  };

  const handleUpdateNote = (cartItemId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) => {
        const id =
          item.id ||
          generateCartItemId(
            item.product.id,
            item.size?.name,
            item.topping?.name,
            item.syrup?.name,
            item.customOptions
          );
        return id === cartItemId || item.product.id === cartItemId ? { ...item, note } : item;
      })
    );
  };

  // Submit Order logic
  const handleSubmitOrder = async (details: {
    customerName: string;
    customerPhone: string;
    orderType: OrderType;
    tableNumber: string;
    paymentMethod: PaymentMethod;
    paymentReceiptUrl?: string;
    paymentReceiptPath?: string;
    isMemberChoice?: boolean;
  }) => {
    if (!selectedOutlet) return;
    setIsSubmitting(true);

    try {
      const orderNumber = generateOrderNumber();
      const totalAmount = cart.reduce((acc, item) => {
        const unit = calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup, item.customOptions);
        return acc + unit * item.quantity;
      }, 0);

      // Determine customerId based on logged-in member or "Jadi Member" choice
      let resolvedCustomerId: string | undefined = customerProfile?.id || customerProfile?.userId || undefined;

      if (!resolvedCustomerId && details.isMemberChoice !== false) {
        // Customer selected "Jadi Member" - save/link in Supabase existing customers table
        const member = await findOrCreateCustomerMember(details.customerName, details.customerPhone);
        if (member && member.id) {
          resolvedCustomerId = member.id;
        }
      }

      // Determine initial payment status based on chosen payment method
      const initialPaymentStatus =
        details.paymentMethod === 'QRIS' ? 'WAITING VERIFICATION' : 'PAY AT STORE';

      const newOrder: CustomerOrder = {
        id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        orderNumber,
        outletId: selectedOutlet.id,
        outletName: selectedOutlet.name,
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        customerId: resolvedCustomerId,
        orderType: details.orderType,
        tableNumber: details.orderType === 'DINE IN' ? details.tableNumber : undefined,
        items: cart.map((item) => {
          const size = item.size || DEFAULT_SIZE;
          const topping = item.topping || DEFAULT_TOPPING;
          const syrup = item.syrup || DEFAULT_SYRUP;
          const unitPrice = calculateItemUnitPrice(item.product.price, size, topping, syrup, item.customOptions);
          return {
            id: `item-${Date.now()}-${item.product.id}-${Math.random().toString(36).slice(2, 6)}`,
            productId: item.product.id,
            name: item.product.name,
            price: item.product.price,
            unitPrice: unitPrice,
            quantity: item.quantity,
            image: item.product.image,
            note: item.note,
            size: {
              name: size.name,
              price: size.price,
            },
            topping: {
              id: topping.id,
              name: topping.name,
              price: topping.price,
            },
            syrup: {
              id: syrup.id,
              name: syrup.name,
              price: syrup.price,
            },
            customOptions: item.customOptions,
          };
        }),
        totalAmount,
        paymentMethod: details.paymentMethod,
        paymentStatus: initialPaymentStatus,
        paymentReceiptUrl: details.paymentReceiptUrl,
        paymentReceiptPath: details.paymentReceiptPath,
        orderStatus: 'NEW',
        customerNote: generalNote || undefined,
        createdAt: new Date().toISOString(),
      };

      const result = await createNewOrder(newOrder);
      if (result.success) {
        // Retrieve and log the updated loyalty balance from Supabase
        if (newOrder.customerId) {
          try {
            const updatedLoyalty = await getCustomerLoyalty(newOrder.customerId);
            console.log('[Loyalty Balance Synced]: New balance is:', updatedLoyalty.pointsBalance);
          } catch (loyaltyErr) {
            console.error('[Loyalty Earning Sync Error]: Failed to refresh loyalty balance from Supabase:', loyaltyErr);
          }
        } else {
          console.warn('[Loyalty Earning Note]: Order tidak terhubung ke customer.');
        }

        setCompletedOrder(newOrder);
        setCart([]); // Clear cart
        localStorage.removeItem('leton_ordering_cart');
        scrollToTop();
        setCurrentStep('confirmation');
      }
    } catch (err) {
      console.error('Submit order error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderAgain = () => {
    setCompletedOrder(null);
    scrollToTop();
    setCurrentStep('menu');
  };

  return (
    <div
      ref={modalContainerRef}
      data-scroll-container="true"
      className={`fixed inset-0 z-50 overflow-y-auto flex flex-col font-sans animate-fadeIn ${
        currentStep === 'menu' || currentStep === 'checkout'
          ? 'bg-[#f8f9ff] text-[#041d32]'
          : 'bg-[#070b12] text-slate-100'
      }`}
    >
      {/* Universal Ordering Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between border-b ${
        currentStep === 'menu' || currentStep === 'checkout'
          ? 'bg-white/95 border-[#e4efff] text-[#041d32]'
          : 'bg-[#070b12]/95 border-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-3">
          {currentStep !== 'confirmation' && (
            <button
              onClick={() => {
                if (currentStep === 'member_choice') {
                  if (memberChoiceStep !== 'choice') {
                    setMemberChoiceStep('choice');
                  } else {
                    onClose();
                  }
                } else if (currentStep === 'profile') {
                  if (isMemberOnlyFlow) {
                    onClose();
                  } else if (customerProfile) {
                    setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
                  } else {
                    setCurrentStep('member_choice');
                    setMemberChoiceStep('choice');
                  }
                } else if (currentStep === 'checkout') {
                  setCurrentStep('menu');
                } else if (currentStep === 'menu') {
                  setCurrentStep('outlet');
                } else if (currentStep === 'outlet') {
                  if (!customerProfile) {
                    setCurrentStep('member_choice');
                    setMemberChoiceStep('choice');
                  } else {
                    onClose();
                  }
                }
              }}
              className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                currentStep === 'menu' || currentStep === 'checkout'
                  ? 'bg-[#eef4ff] border-[#e4efff] text-[#041d32] hover:bg-[#e4efff]'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-xs ${
              currentStep === 'menu' || currentStep === 'checkout'
                ? 'bg-[#006389] text-white'
                : 'bg-gradient-to-br from-[#00E5FF] to-blue-600 text-slate-950 shadow-cyan-500/20'
            }`}>
              L
            </div>
            <div>
              <h1 className={`font-display font-black text-sm sm:text-base uppercase tracking-wider leading-none ${
                currentStep === 'menu' || currentStep === 'checkout' ? 'text-[#041d32]' : 'text-white'
              }`}>
                LETON COFFEE • ONLINE ORDER
              </h1>
              <span className={`text-[10px] font-mono tracking-widest uppercase font-bold block mt-0.5 ${
                currentStep === 'menu' || currentStep === 'checkout' ? 'text-[#006389]' : 'text-[#00E5FF]'
              }`}>
                DUMAI SPECIALTY COFFEE
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Member Profile Access Button */}
          <button
            onClick={() => {
              if (!customerProfile) {
                setCurrentStep('member_choice');
                setMemberChoiceStep('choice');
                return;
              }
              if (currentStep === 'profile') {
                setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
              } else {
                setCurrentStep('profile');
              }
            }}
            className={`p-2 sm:px-3.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer tracking-wide ${
              currentStep === 'profile' || currentStep === 'member_choice'
                ? 'bg-[#C39A6B] text-white border-[#C39A6B] hover:bg-[#B38A5B]'
                : customerProfile
                ? 'bg-amber-500/10 border-[#C39A6B]/30 text-[#C39A6B] hover:bg-amber-500/20'
                : currentStep === 'menu' || currentStep === 'checkout'
                ? 'bg-white border-[#e4efff] text-[#041d32] hover:bg-[#eef4ff]'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={customerProfile?.namaLengkap ? `Akun: ${customerProfile.namaLengkap}` : 'Akses Member'}
          >
            <User className={`w-4 h-4 ${customerProfile ? 'text-[#C39A6B]' : ''}`} />
            <span className="hidden sm:inline font-semibold">
              {(customerProfile?.namaLengkap ? customerProfile.namaLengkap.trim().split(' ')[0] : '') || 'MEMBER'}
            </span>
          </button>

          {selectedOutlet && currentStep === 'menu' && (
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                currentStep === 'menu' || currentStep === 'checkout'
                  ? 'bg-white border-[#e4efff] text-[#041d32] hover:bg-[#eef4ff]'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 font-mono'
              }`}
            >
              <ShoppingBag className={`w-4 h-4 ${currentStep === 'menu' ? 'text-[#006389]' : 'text-[#00E5FF]'}`} />
              <span className="hidden sm:inline uppercase">Keranjang</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#006389] text-white text-[10px] font-black">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
              currentStep === 'menu' || currentStep === 'checkout'
                ? 'bg-white hover:bg-[#eef4ff] border-[#e4efff] text-[#3e484f] hover:text-[#041d32]'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white font-mono'
            }`}
            aria-label="Tutup Order"
          >
            <span className="hidden sm:inline text-[11px] uppercase tracking-wider">Tutup</span>
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Step Body */}
      <main className={`flex-1 w-full min-h-[calc(100vh-65px)] ${
        currentStep === 'menu' || currentStep === 'checkout'
          ? 'bg-[#f8f9ff] text-[#041d32]'
          : 'bg-[#070b12] text-slate-100'
      }`}>
        <ErrorBoundary
          fallbackTitle="Terjadi Kendala pada Pemesanan"
          fallbackMessage="Silakan klik tombol di bawah untuk kembali ke langkah pemilihan outlet."
          onReset={() => setCurrentStep('outlet')}
        >
          {checkingAuth ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-semibold text-xs tracking-wider uppercase font-mono">Memuat Sesi Member...</p>
            </div>
          ) : (
            <>
              {/* Step 0: Halaman Member (Daftar, Login, Lanjut Tanpa Member) */}
              {currentStep === 'member_choice' && (
                <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 animate-fadeIn">
                  {memberChoiceStep === 'choice' && (
                    <div className="space-y-6">
                      <div className="text-center mb-6 sm:mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C39A6B] to-[#966E43] text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-950/30 border border-amber-300/30">
                          <UserCheck className="w-8 h-8" />
                        </div>
                        <span className="inline-block px-3.5 py-1 rounded-full bg-amber-500/10 border border-[#C39A6B]/30 text-[#C39A6B] text-[11px] font-mono font-bold tracking-widest uppercase mb-2">
                          {isMemberOnlyFlow ? 'AKUN MEMBER LETON COFFEE' : 'AKSES PEMESANAN ONLINE'}
                        </span>
                        <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                          {isMemberOnlyFlow ? 'LOGIN / DAFTAR MEMBER' : 'HALAMAN MEMBER'}
                        </h2>
                        <p className="mt-2 text-slate-300 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                          {isMemberOnlyFlow
                            ? 'Masuk ke akun Anda atau daftar sebagai member untuk melihat riwayat pesanan, profil, dan poin loyalty.'
                            : 'Silakan pilih opsi akses pemesanan Anda sebelum melanjutkan ke pemilihan outlet.'}
                        </p>
                      </div>

                      <div className="space-y-3.5">
                        {/* 1. DAFTAR MEMBER */}
                        <button
                          type="button"
                          onClick={() => setMemberChoiceStep('register')}
                          className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-850 border border-amber-500/40 hover:border-amber-400 hover:bg-slate-800 transition-all text-left flex items-center justify-between group cursor-pointer shadow-lg shadow-amber-950/10 hover:-translate-y-0.5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#C39A6B] text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                              <UserPlus className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-display font-black text-base text-white group-hover:text-[#C39A6B] transition-colors">
                                  DAFTAR MEMBER
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase">
                                  Rekomendasi
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs mt-0.5">
                                Daftar akun baru untuk kumpulkan poin loyalty &amp; promo khusus.
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>

                        {/* 2. LOGIN MEMBER */}
                        <button
                          type="button"
                          onClick={() => setMemberChoiceStep('login')}
                          className="w-full p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer shadow-lg hover:-translate-y-0.5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-[#00E5FF] group-hover:text-slate-950 transition-all">
                              <LogIn className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="font-display font-black text-base text-white group-hover:text-[#00E5FF] transition-colors block">
                                LOGIN MEMBER
                              </span>
                              <p className="text-slate-400 text-xs mt-0.5">
                                Sudah memiliki akun member Leton? Masuk di sini.
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-[#00E5FF] group-hover:translate-x-1 transition-all shrink-0" />
                        </button>

                        {/* 3. LANJUT TANPA MEMBER */}
                        {!isMemberOnlyFlow && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerProfile(null);
                              setSelectedOutlet(null);
                              localStorage.removeItem('leton_selected_outlet');
                              setCurrentStep('outlet');
                            }}
                            className="w-full p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer hover:-translate-y-0.5"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="font-display font-bold text-sm text-slate-200 group-hover:text-white transition-colors block">
                                  LANJUT TANPA MEMBER
                                </span>
                                <p className="text-slate-400 text-xs mt-0.5">
                                  Pesan langsung tanpa mendaftar akun (Tidak mendapatkan poin loyalty).
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {memberChoiceStep === 'register' && (
                    <CustomerAuthForm
                      initialMode="register"
                      onBackToChoice={() => setMemberChoiceStep('choice')}
                      onSkipWithoutMember={
                        !isMemberOnlyFlow
                          ? () => {
                              setCustomerProfile(null);
                              setSelectedOutlet(null);
                              localStorage.removeItem('leton_selected_outlet');
                              setCurrentStep('outlet');
                            }
                          : undefined
                      }
                      onAuthSuccess={(profile) => {
                        setCustomerProfile(profile);
                        if (isMemberOnlyFlow) {
                          setCurrentStep('profile');
                        } else {
                          setSelectedOutlet(null);
                          localStorage.removeItem('leton_selected_outlet');
                          setCurrentStep('outlet');
                        }
                      }}
                    />
                  )}

                  {memberChoiceStep === 'login' && (
                    <CustomerAuthForm
                      initialMode="login"
                      onBackToChoice={() => setMemberChoiceStep('choice')}
                      onSkipWithoutMember={
                        !isMemberOnlyFlow
                          ? () => {
                              setCustomerProfile(null);
                              setSelectedOutlet(null);
                              localStorage.removeItem('leton_selected_outlet');
                              setCurrentStep('outlet');
                            }
                          : undefined
                      }
                      onAuthSuccess={(profile) => {
                        setCustomerProfile(profile);
                        if (isMemberOnlyFlow) {
                          setCurrentStep('profile');
                        } else {
                          setSelectedOutlet(null);
                          localStorage.removeItem('leton_selected_outlet');
                          setCurrentStep('outlet');
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {/* Step 1: Pilih Outlet (also default fallback if no outlet selected) */}
              {(currentStep === 'outlet' || (!selectedOutlet && currentStep !== 'profile' && currentStep !== 'confirmation' && currentStep !== 'member_choice')) && (
                <OutletSelector
                  onSelectOutlet={(outlet) => {
                    setSelectedOutlet(outlet);
                    setCurrentStep('menu');
                  }}
                  onClose={onClose}
                />
              )}

              {/* Step 2: Menu */}
              {currentStep === 'menu' && selectedOutlet && (
                <OrderMenu
                  outlet={selectedOutlet}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateCartQuantity={handleUpdateQuantity}
                  onOpenCart={() => setIsCartOpen(true)}
                  onChangeOutlet={() => setCurrentStep('outlet')}
                  preSelectedProduct={pendingCustomizeItem}
                  onClearPreSelectedProduct={() => setPendingCustomizeItem(null)}
                />
              )}

              {/* Step 3: Checkout */}
              {currentStep === 'checkout' && selectedOutlet && (
                <OrderCheckout
                  outlet={selectedOutlet}
                  cart={cart}
                  generalNote={generalNote}
                  onBackToCart={() => setIsCartOpen(true)}
                  onSubmitOrder={handleSubmitOrder}
                  isSubmitting={isSubmitting}
                  customerProfile={customerProfile}
                />
              )}

              {/* Step: Profile / Auth */}
              {currentStep === 'profile' && (
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                  {customerProfile ? (
                    <CustomerProfileTab
                      profile={customerProfile}
                      onStartOrder={() => {
                        setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
                      }}
                      onLogout={async () => {
                        try {
                          await logoutCustomer();
                        } catch (err) {
                          console.error('[Customer Logout Error]:', err);
                        } finally {
                          setCustomerProfile(null);
                          setCurrentStep('member_choice');
                          setMemberChoiceStep('choice');
                        }
                      }}
                      onProfileUpdate={(updated) => {
                        setCustomerProfile((prev) => (prev ? { ...prev, ...updated } : null));
                      }}
                    />
                  ) : (
                    <div className="py-6">
                      <CustomerAuthForm
                        onAuthSuccess={(profile) => {
                          setCustomerProfile(profile);
                          setCurrentStep('profile');
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step: Confirmation */}
              {currentStep === 'confirmation' && completedOrder && (
                <OrderConfirmation
                  order={completedOrder}
                  outlet={selectedOutlet || ({ id: completedOrder.outletId, name: completedOrder.outletName || 'Leton Coffee' } as any)}
                  onOrderAgain={handleOrderAgain}
                  onBackToHome={onClose}
                />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && selectedOutlet && (
          <OrderCartDrawer
            outlet={selectedOutlet}
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onUpdateNote={handleUpdateNote}
            generalNote={generalNote}
            onUpdateGeneralNote={setGeneralNote}
            onClose={() => setIsCartOpen(false)}
            onContinue={() => {
              setIsCartOpen(false);
              setCurrentStep('checkout');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
