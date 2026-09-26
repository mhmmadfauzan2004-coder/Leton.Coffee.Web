import React, { useState, useEffect } from 'react';
import { CustomerOrder, OrderOutlet } from '../../../types';
import {
  formatRupiah,
  createWhatsAppLink,
  formatOrderDate,
  formatOrderTime,
  formatOrderDateTime,
} from '../../../utils/formatters';
import { subscribeToSingleOrder } from '../../../utils/supabaseOrders';
import { getSupabase } from '../../../utils/supabase';
import {
  CheckCircle2,
  Clock,
  Utensils,
  Package,
  MessageCircle,
  Home,
  Copy,
  Check,
  Coffee,
  Sparkles,
  RefreshCw,
  QrCode,
  Banknote,
  Receipt,
  Store,
  MapPin,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderConfirmationProps {
  order: CustomerOrder;
  outlet: OrderOutlet;
  onOrderAgain: () => void;
  onBackToHome: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order: initialOrder,
  outlet,
  onOrderAgain,
  onBackToHome,
}) => {
  const [currentOrder, setCurrentOrder] = useState<CustomerOrder>(initialOrder);
  const [copied, setCopied] = useState(false);

  // Instantly scroll to the absolute top upon rendering the Confirmation / Bill page
  useEffect(() => {
    const scrollToTop = () => {
      try {
        // Reset window scroll
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0 });
        }
      } catch (e) {
        console.warn('Confirmation scrollTo window failed:', e);
      }
      
      try {
        // Reset document root
        if (document.documentElement) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body) {
          document.body.scrollTop = 0;
        }
      } catch (e) {
        console.warn('Confirmation scrollTop bodies failed:', e);
      }

      try {
        // Reset all scrollable modal containers and wrappers
        const scrollableElements = document.querySelectorAll(
          '.overflow-y-auto, .overflow-auto, [data-scroll-container="true"]'
        );
        scrollableElements.forEach((el) => {
          try {
            el.scrollTop = 0;
            if (typeof el.scrollTo === 'function') {
              el.scrollTo({ top: 0, left: 0 });
            }
          } catch (innerErr) {
            console.warn('Scroll el failed:', innerErr);
          }
        });
      } catch (e) {
        console.warn('Confirmation scrollableElements failed:', e);
      }
    };

    // Immediate execution
    scrollToTop();

    // Prevent race conditions with animation frames and microtask timeouts
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
  }, []);

  // Keep live sync with database / admin updates & trigger customer realtime notification
  const lastNotifiedStatusRef = React.useRef<string>(initialOrder.orderStatus);
  const [inAppNotice, setInAppNotice] = useState<{ message: string; type: 'ready' | 'rejected' } | null>(null);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (!initialOrder?.id) return;

    const unsubscribe = subscribeToSingleOrder(
      initialOrder.id,
      initialOrder.customerPhone,
      (updatedOrder) => {
        if (!updatedOrder) return;
        setCurrentOrder(updatedOrder);

        // Trigger in-app notification when status changes
        if (updatedOrder.orderStatus !== lastNotifiedStatusRef.current) {
          const oldStatus = lastNotifiedStatusRef.current;
          lastNotifiedStatusRef.current = updatedOrder.orderStatus;

          if (
            (updatedOrder.orderStatus === 'READY' || updatedOrder.orderStatus === 'COMPLETED') &&
            oldStatus !== 'READY' &&
            oldStatus !== 'COMPLETED'
          ) {
            setInAppNotice({
              message: '🎉 Pesanan Kamu Sudah Siap! Silakan ambil pesanan kamu.',
              type: 'ready',
            });
          } else if (updatedOrder.orderStatus === 'CANCELLED' && oldStatus !== 'CANCELLED') {
            setInAppNotice({
              message: `Pesanan Ditolak: ${updatedOrder.rejectionReason || 'Tanpa alasan'}`,
              type: 'rejected',
            });
          }
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [initialOrder?.id, initialOrder?.customerPhone]);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(currentOrder.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Status mapping:
  const isOrderReady =
    currentOrder.orderStatus === 'READY' || currentOrder.orderStatus === 'COMPLETED';
  const isOrderCancelled = currentOrder.orderStatus === 'CANCELLED';

  // WhatsApp helper text
  const waItemsText = currentOrder.items
    .map((it) => {
      const topName = it.topping && it.topping.name !== 'No Topping' ? ` + ${it.topping.name}` : '';
      const syrName = it.syrup && it.syrup.name !== 'No Syrup' ? ` + ${it.syrup.name}` : '';
      const sizeName = it.size?.name ? ` [${it.size.name}]` : '';
      const customsName = it.customOptions && it.customOptions.length > 0
        ? ` (${it.customOptions.map((c) => `${c.groupName}: ${c.optionName}`).join(', ')})`
        : '';
      return `• ${it.quantity}x ${it.name}${sizeName}${topName}${syrName}${customsName} (${formatRupiah((it.unitPrice || it.price) * it.quantity)})`;
    })
    .join('\n');

  const waMessage = `*PESANAN ONLINE LETON COFFEE* ☕
---------------------------------
*No. Order:* ${currentOrder.orderNumber}
*Tanggal:* ${formatOrderDate(currentOrder.createdAt)}
*Jam Order:* ${formatOrderTime(currentOrder.createdAt)}
*Jam Pengambilan:* ${currentOrder.pickupTime || currentOrder.pickup_time || '-'}
*Outlet:* ${currentOrder.outletName}
*Customer:* ${currentOrder.customerName}
*Tipe:* ${currentOrder.orderType}${currentOrder.orderType === 'DINE IN' ? ` (Meja: ${currentOrder.tableNumber || '-'})` : ''}
*Metode Bayar:* ${currentOrder.paymentMethod}
*Status Pembayaran:* ${currentOrder.paymentStatus === 'PAID' ? 'LUNAS / PAID' : currentOrder.paymentStatus}

*Rincian Menu:*
${waItemsText}

*TOTAL:* ${formatRupiah(currentOrder.totalAmount)}
---------------------------------
Halo Barista ${currentOrder.outletName}, saya ingin menanyakan status pesanan nomor *${currentOrder.orderNumber}*. Terima kasih!`;

  const waLink = createWhatsAppLink(outlet.whatsapp || '6281234567890', waMessage);

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 bg-[#F8FBFF] min-h-full font-sans relative">
      {/* Realtime Status Update Floating Toast/Banner for Customer */}
      <AnimatePresence>
        {inAppNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border backdrop-blur-md ${
              inAppNotice.type === 'ready'
                ? 'bg-emerald-900/95 text-white border-emerald-500/50 shadow-emerald-900/30'
                : 'bg-rose-900/95 text-white border-rose-500/50 shadow-rose-900/30'
            }`}
          >
            {inAppNotice.type === 'ready' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-display font-bold text-sm tracking-wide">
              {inAppNotice.message}
            </span>
            <button
              type="button"
              onClick={() => setInAppNotice(null)}
              className="ml-2 p-1 text-white/70 hover:text-white rounded-full bg-white/10"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP WELCOME GREETING MESSAGE (AS REQUESTED) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#E0F2FE] via-[#F0F9FF] to-white border border-[#BAE6FD] text-[#0369A1] shadow-sm flex items-center gap-3.5"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#BAE6FD] text-[#0284C7] flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 text-[#0284C7]" />
        </div>
        <div>
          <p className="font-display font-black text-sm sm:text-base text-[#0C4A6E] leading-snug">
            “Terima kasih sudah online, ditunggu di outlet ya untuk mengambil pesanannya.”
          </p>
          <span className="text-xs text-[#0284C7] font-medium block mt-0.5">
            Leton Coffee • {currentOrder.outletName}
          </span>
        </div>
      </motion.div>

      {/* 2. LIVE KITCHEN STATUS */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`rounded-3xl p-6 sm:p-8 border shadow-sm mb-8 transition-all overflow-hidden relative ${
          isOrderCancelled
            ? 'bg-gradient-to-br from-[#FFF1F2] via-white to-[#FFE4E6] border-[#FDA4AF]'
            : isOrderReady
            ? 'bg-gradient-to-br from-[#F0FDF4] via-white to-[#ECFDF5] border-[#86EFAC]'
            : 'bg-gradient-to-br from-[#F0F9FF] via-white to-[#E0F2FE] border-[#7DD3FC]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            {/* Header Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                  isOrderCancelled
                    ? 'bg-rose-100 text-rose-800'
                    : isOrderReady
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-[#E0F2FE] text-[#0284C7]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOrderCancelled
                      ? 'bg-rose-600'
                      : isOrderReady
                      ? 'bg-emerald-600'
                      : 'bg-[#0284C7] animate-ping'
                  }`}
                />
                <span>LIVE KITCHEN STATUS</span>
              </span>

              <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-[#0284C7]" />
                {currentOrder.outletName}
              </span>
            </div>

            {/* STATUS TITLE & MESSAGE */}
            <AnimatePresence mode="wait">
              {isOrderCancelled ? (
                <motion.div
                  key="status-cancelled"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600 shrink-0" />
                    <h2 className="font-display font-black text-2xl sm:text-3xl text-rose-900 tracking-tight">
                      Pesanan Ditolak
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-rose-800 pl-9 sm:pl-10">
                    {currentOrder.rejectionReason
                      ? `Alasan: "${currentOrder.rejectionReason}"`
                      : 'Pesananmu tidak dapat diproses oleh outlet.'}
                  </p>
                </motion.div>
              ) : isOrderReady ? (
                <motion.div
                  key="status-ready"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 shrink-0" />
                    <h2 className="font-display font-black text-2xl sm:text-3xl text-emerald-900 tracking-tight">
                      Pesanan sudah siap
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-emerald-800 pl-9 sm:pl-10">
                    Silakan datang ke outlet untuk mengambil pesanan.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="status-preparing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="w-7 h-7 sm:w-8 sm:h-8 text-[#0284C7] shrink-0 animate-bounce" />
                    <h2 className="font-display font-black text-2xl sm:text-3xl text-[#0C4A6E] tracking-tight">
                      Sebentar ya, lagi disiapin
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base text-[#0369A1] pl-9 sm:pl-10 font-medium">
                    Barista sedang meracik pesanan kopimu dengan bahan pilihan terbaik.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Order Number & Copy Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E0F2FE] shadow-sm flex flex-col items-center justify-center shrink-0 min-w-[220px]">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#64748B] font-bold">
              NOMOR ORDER
            </span>
            <span className="font-mono font-black text-2xl sm:text-3xl text-[#0284C7] tracking-wider my-1">
              {currentOrder.orderNumber}
            </span>
            <button
              type="button"
              onClick={handleCopyOrderNumber}
              className="mt-1 w-full py-1.5 px-3 rounded-xl bg-[#F0F7FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] text-[#0284C7] text-xs font-bold font-mono inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>SALIN NOMOR ORDER</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3. BILL / STRUK DIGITAL ONLINE (AS DETAILED IN SPECIFICATION) */}
      <div className="bg-white rounded-3xl border border-[#E0F2FE] shadow-md p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Decorative receipt top edge accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#0284C7] via-[#38BDF8] to-[#0284C7]" />

        {/* Bill Header */}
        <div className="text-center pt-2 pb-4 border-b border-dashed border-slate-300 space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F0F7FF] border border-[#BAE6FD] text-[#0284C7] font-black text-xl mb-1 shadow-xs">
            L
          </div>
          <h2 className="font-display font-black text-2xl text-[#172033] tracking-wider uppercase">
            LETON COFFEE
          </h2>
          <p className="text-xs font-mono text-[#64748B] uppercase tracking-widest">
            OFFICIAL DIGITAL ORDER BILL
          </p>
        </div>

        {/* RINGKASAN PESANAN (Meta Grid) */}
        <div className="bg-[#F8FBFF] rounded-2xl p-4 sm:p-5 border border-[#E0F2FE] space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0F2FE] pb-2.5">
            <h3 className="font-display font-black text-xs uppercase tracking-wider text-[#0284C7] flex items-center gap-1.5">
              <Receipt className="w-4 h-4" />
              <span>RINGKASAN PESANAN</span>
            </h3>
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              TERCATAT DI SISTEM
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">No. Pesanan:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base sm:text-lg text-[#0284C7]">
                  {currentOrder.orderNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  className="px-2 py-0.5 rounded-md bg-white hover:bg-[#E0F2FE] text-[#0284C7] text-[11px] font-mono font-bold border border-[#BAE6FD] cursor-pointer transition-colors"
                  title="Salin nomor order"
                >
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">Tanggal:</span>
              <span className="font-bold text-sm text-[#172033] block">
                {formatOrderDate(currentOrder.createdAt)}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">Jam Order:</span>
              <span className="font-mono font-bold text-sm text-[#0284C7] block">
                {formatOrderTime(currentOrder.createdAt)}
              </span>
            </div>

            <div className="space-y-1 bg-[#eef4ff] p-2 rounded-xl border border-[#c6e7ff]">
              <span className="font-mono text-[11px] text-[#006389] font-extrabold uppercase block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Jam Pengambilan:</span>
              </span>
              <span className="font-mono font-black text-sm text-[#006389] block">
                {currentOrder.pickupTime || currentOrder.pickup_time || '-'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">Outlet:</span>
              <span className="font-display font-bold text-sm text-[#172033] block">
                {currentOrder.outletName}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">Total:</span>
              <span className="font-mono font-black text-base text-[#0284C7] block">
                {formatRupiah(currentOrder.totalAmount)}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] text-[#64748B] uppercase block">Customer / Tipe:</span>
              <span className="font-display font-bold text-xs text-[#172033] block">
                {currentOrder.customerName} • {currentOrder.orderType === 'DINE IN' ? `Dine In (Meja ${currentOrder.tableNumber || '-'})` : 'Take Away'}
              </span>
              {currentOrder.customerPhone && (
                <span className="font-mono text-[11px] text-[#64748B] block">
                  {currentOrder.customerPhone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ----------------- DETAIL PESANAN ----------------- */}
        <div className="pt-4 border-t border-dashed border-slate-300 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-black text-sm uppercase tracking-wider text-[#172033]">
              DETAIL PESANAN
            </h3>
            <span className="text-xs font-mono text-[#64748B]">
              {(currentOrder.items || []).reduce((acc, it) => acc + (it?.quantity || 0), 0)} Total Item
            </span>
          </div>

          <div className="space-y-4">
            {(currentOrder.items || []).map((item, idx) => {
              const basePrice = item.price || 0;
              const sizePrice = item.size?.price || 0;
              const toppingPrice = item.topping?.price || 0;
              const syrupPrice = item.syrup?.price || 0;
              const customizationAddonPrice = sizePrice + toppingPrice + syrupPrice;
              const unitPrice = item.unitPrice || (basePrice + customizationAddonPrice);
              const itemSubtotal = unitPrice * (item.quantity || 1);

              const hasSize = item.size && item.size.name;
              const hasTopping = item.topping && item.topping.name !== 'No Topping';
              const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] space-y-2.5 text-xs"
                >
                  {/* Item Main Line */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-[#E0F2FE] text-[#0284C7] font-mono font-black flex items-center justify-center text-xs shrink-0">
                        {item.quantity}x
                      </span>
                      <div>
                        <h4 className="font-display font-bold text-sm text-[#172033]">
                          {item.name}
                        </h4>
                      </div>
                    </div>

                    <span className="font-mono font-black text-sm text-[#172033]">
                      {formatRupiah(itemSubtotal)}
                    </span>
                  </div>

                  {/* Customization Details List */}
                  <div className="pl-8.5 space-y-1 text-[#475569] font-mono text-[11px]">
                    {hasSize && (
                      <div className="flex items-center justify-between">
                        <span>• Size: {item.size!.name}</span>
                        <span>{sizePrice > 0 ? `+${formatRupiah(sizePrice)}` : '+Rp0'}</span>
                      </div>
                    )}
                    {hasTopping && (
                      <div className="flex items-center justify-between">
                        <span>• Topping: {item.topping!.name}</span>
                        <span>+{formatRupiah(toppingPrice)}</span>
                      </div>
                    )}
                    {hasSyrup && (
                      <div className="flex items-center justify-between">
                        <span>• Syrup: {item.syrup!.name}</span>
                        <span>+{formatRupiah(syrupPrice)}</span>
                      </div>
                    )}

                    {/* Price Breakdown Calculation */}
                    <div className="pt-2 mt-2 border-t border-[#E0F2FE] text-[#64748B] flex flex-col gap-0.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span>Harga dasar:</span>
                        <span>{formatRupiah(basePrice)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tambahan customization:</span>
                        <span>{formatRupiah(customizationAddonPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between font-bold text-[#172033] pt-0.5">
                        <span>Subtotal ({item.quantity}x @{formatRupiah(unitPrice)}):</span>
                        <span className="text-[#0284C7]">{formatRupiah(itemSubtotal)}</span>
                      </div>
                    </div>

                    {item.note && (
                      <div className="mt-1.5 p-2 rounded-lg bg-white border border-[#E0F2FE] text-slate-600 italic text-[11px]">
                        Catatan: "{item.note}"
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ----------------- TOTAL & PAYMENT ----------------- */}
        <div className="pt-4 border-t border-dashed border-slate-300 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-display font-black text-base text-[#172033] uppercase">
              TOTAL:
            </span>
            <span className="font-mono font-black text-2xl sm:text-3xl text-[#0284C7]">
              {formatRupiah(currentOrder.totalAmount)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-2">
            <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE]">
              <span className="text-[#64748B] font-mono">Payment:</span>
              <span className="font-bold text-[#172033] font-mono uppercase">
                {currentOrder.paymentMethod}
              </span>
            </div>

            <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE]">
              <span className="text-[#64748B] font-mono">Payment Status:</span>
              <span
                className={`font-bold font-mono uppercase text-xs ${
                  currentOrder.paymentStatus === 'PAID'
                    ? 'text-emerald-700 font-black'
                    : currentOrder.paymentStatus === 'WAITING VERIFICATION'
                    ? 'text-amber-700'
                    : 'text-[#0284C7]'
                }`}
              >
                {currentOrder.paymentStatus === 'PAID'
                  ? 'LUNAS / PAID'
                  : currentOrder.paymentStatus === 'WAITING VERIFICATION'
                  ? 'VERIFIKASI PEMBAYARAN'
                  : currentOrder.paymentStatus}
              </span>
            </div>
          </div>

          {/* Receipt image attachment preview if present */}
          {currentOrder.paymentReceiptUrl && (
            <div className="p-3 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#0284C7]" />
                <span className="text-[#64748B]">Bukti Transfer QRIS Terlampir:</span>
              </div>
              <a
                href={currentOrder.paymentReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0284C7] font-bold hover:underline font-mono"
              >
                Lihat Bukti Foto ↗
              </a>
            </div>
          )}

          {/* Special Instruction Notice */}
          <div className="p-4 rounded-2xl bg-[#F0F7FF] border border-[#BAE6FD] text-center space-y-1">
            <p className="font-bold text-xs sm:text-sm text-[#0369A1]">
              “Silakan tunjukkan nomor order ini saat mengambil pesanan di outlet.”
            </p>
            <p className="text-[11px] text-[#64748B] font-mono">
              Waktu Transaksi: {formatOrderDateTime(currentOrder.createdAt)}
            </p>
          </div>

          {/* Primary Action: SALIN NOMOR ORDER Button */}
          <button
            type="button"
            onClick={handleCopyOrderNumber}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-display font-black text-sm tracking-wider uppercase shadow-[0_4px_14px_rgba(2,132,199,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>NOMOR ORDER BERHASIL DISALIN!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>SALIN NOMOR ORDER</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. FOOTER ACTIONS */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>Chat Barista di WhatsApp</span>
        </a>

        <button
          type="button"
          onClick={onOrderAgain}
          className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-[#0284C7]" />
          <span>Pesan Menu Tambahan</span>
        </button>

        <button
          type="button"
          onClick={onBackToHome}
          className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Home className="w-4 h-4 text-[#0284C7]" />
          <span>Kembali ke Beranda</span>
        </button>
      </div>
    </div>
  );
};
