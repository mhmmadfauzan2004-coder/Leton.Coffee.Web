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
} from '../../../types';
import { OutletSelector } from './OutletSelector';
import { OrderMenu } from './OrderMenu';
import { OrderCartDrawer } from './OrderCartDrawer';
import { OrderCheckout } from './OrderCheckout';
import { OrderConfirmation } from './OrderConfirmation';
import CustomerAuthForm from './CustomerAuthForm';
import CustomerProfileTab from './CustomerProfileTab';
import { createNewOrder, generateOrderNumber } from '../../../utils/supabaseOrders';
import { getCurrentCustomerProfile, getSupabase } from '../../../utils/supabase';
import {
  DEFAULT_SIZE,
  DEFAULT_TOPPING,
  DEFAULT_SYRUP,
  generateCartItemId,
  calculateItemUnitPrice,
} from '../../../data/addOnsData';
import { X, ArrowLeft, ShoppingBag, User } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

interface OrderingSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedMenuItem?: MenuItem | null;
}

export const OrderingSystemModal: React.FC<OrderingSystemModalProps> = ({
  isOpen,
  onClose,
  preSelectedMenuItem,
}) => {
  const [selectedOutlet, setSelectedOutlet] = useState<OrderOutlet | null>(() => {
    const saved = localStorage.getItem('leton_selected_outlet');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('leton_ordering_cart');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [generalNote, setGeneralNote] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'outlet' | 'menu' | 'checkout' | 'confirmation' | 'profile'>('outlet');
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
          if (!profile) {
            setCurrentStep('profile');
          } else {
            setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
          }
        } catch (err) {
          console.warn('Error syncing customer profile:', err);
          setCurrentStep('profile');
        } finally {
          setCheckingAuth(false);
        }
      };
      syncProfile();
    }
  }, [isOpen]);

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

  // Initialize step based on outlet
  useEffect(() => {
    if (selectedOutlet && currentStep === 'outlet' && !checkingAuth && customerProfile) {
      setCurrentStep('menu');
    }
  }, [selectedOutlet, currentStep, checkingAuth, customerProfile]);

  // Enforce auth requirement: if not logged in, must be on profile (auth) step
  useEffect(() => {
    if (!checkingAuth && !customerProfile && currentStep !== 'profile' && currentStep !== 'confirmation') {
      setCurrentStep('profile');
    }
  }, [checkingAuth, customerProfile, currentStep]);

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
    note?: string
  ) => {
    const cartItemId = generateCartItemId(product.id, size.name, topping.name, syrup.name);
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          (item.id ||
            generateCartItemId(
              item.product.id,
              item.size?.name,
              item.topping?.name,
              item.syrup?.name
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
              item.syrup?.name
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
            item.syrup?.name
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
            item.syrup?.name
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
  }) => {
    if (!selectedOutlet) return;
    setIsSubmitting(true);

    try {
      const orderNumber = generateOrderNumber();
      const totalAmount = cart.reduce((acc, item) => {
        const unit = calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup);
        return acc + unit * item.quantity;
      }, 0);

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
        userId: customerProfile?.userId || undefined, // Associates the order with the logged-in member
        orderType: details.orderType,
        tableNumber: details.orderType === 'DINE IN' ? details.tableNumber : undefined,
        items: cart.map((item) => {
          const size = item.size || DEFAULT_SIZE;
          const topping = item.topping || DEFAULT_TOPPING;
          const syrup = item.syrup || DEFAULT_SYRUP;
          const unitPrice = calculateItemUnitPrice(item.product.price, size, topping, syrup);
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
      className="fixed inset-0 z-50 overflow-y-auto bg-[#070b12] text-slate-100 flex flex-col font-sans animate-fadeIn"
    >
      {/* Universal Ordering Header */}
      <header className="sticky top-0 z-30 bg-[#070b12]/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentStep !== 'outlet' && currentStep !== 'confirmation' && (currentStep !== 'profile' || customerProfile) && (
            <button
              onClick={() => {
                if (currentStep === 'profile') {
                  setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
                } else if (currentStep === 'checkout') {
                  setCurrentStep('menu');
                } else if (currentStep === 'menu') {
                  setCurrentStep('outlet');
                }
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-cyan-500/20">
              L
            </div>
            <div>
              <h1 className="font-display font-black text-sm sm:text-base text-white uppercase tracking-wider leading-none">
                LETON COFFEE • ONLINE ORDER
              </h1>
              <span className="text-[10px] font-mono text-[#00E5FF] tracking-widest uppercase font-bold block mt-0.5">
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
              if (!customerProfile) return; // Cannot toggle away if not logged in
              if (currentStep === 'profile') {
                setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
              } else {
                setCurrentStep('profile');
              }
            }}
            className={`p-2 sm:px-3.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer tracking-wide ${
              currentStep === 'profile'
                ? 'bg-[#C39A6B] text-white border-[#C39A6B] hover:bg-[#B38A5B]'
                : customerProfile
                ? 'bg-amber-500/10 border-[#C39A6B]/30 text-[#C39A6B] hover:bg-amber-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={customerProfile ? `Akun: ${customerProfile.namaLengkap}` : 'Masuk Member'}
          >
            <User className={`w-4 h-4 ${customerProfile ? 'text-[#C39A6B]' : ''}`} />
            <span className="hidden sm:inline font-semibold">
              {customerProfile ? customerProfile.namaLengkap.split(' ')[0] : 'MEMBER'}
            </span>
          </button>

          {selectedOutlet && currentStep === 'menu' && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#00E5FF]" />
              <span className="hidden sm:inline">KERANJANG</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            aria-label="Tutup Order"
          >
            <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-slate-400">Tutup</span>
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Step Body */}
      <main className="flex-1 w-full bg-[#F8FBFF]">
        {checkingAuth ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-semibold text-xs tracking-wider uppercase">Memuat Sesi Member...</p>
          </div>
        ) : (
          <>
            {currentStep === 'outlet' && (
              <OutletSelector
                onSelectOutlet={(outlet) => {
                  setSelectedOutlet(outlet);
                  setCurrentStep('menu');
                }}
                onClose={onClose}
              />
            )}

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

            {currentStep === 'profile' && (
              <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                {customerProfile ? (
                  <CustomerProfileTab
                    profile={customerProfile}
                    onLogout={async () => {
                      try {
                        const client = getSupabase();
                        await client.auth.signOut();
                        setCustomerProfile(null);
                        setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
                      } catch (err) {
                        console.warn('Logout error:', err);
                      }
                    }}
                    onProfileUpdate={(updated) => {
                      setCustomerProfile((prev) => prev ? { ...prev, ...updated } : null);
                    }}
                  />
                ) : (
                  <div className="py-6">
                    <CustomerAuthForm
                      onAuthSuccess={(profile) => {
                        setCustomerProfile(profile);
                        setCurrentStep(selectedOutlet ? 'menu' : 'outlet');
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 'confirmation' && completedOrder && selectedOutlet && (
              <OrderConfirmation
                order={completedOrder}
                outlet={selectedOutlet}
                onOrderAgain={handleOrderAgain}
                onBackToHome={onClose}
              />
            )}
          </>
        )}
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
