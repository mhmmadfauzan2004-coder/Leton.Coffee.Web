import React, { useState } from 'react';
import { CustomerOrder, OrderOutlet } from '../../../types';
import { formatRupiah, createWhatsAppLink } from '../../../utils/formatters';
import {
  CheckCircle2,
  Receipt,
  Store,
  Clock,
  QrCode,
  Banknote,
  Utensils,
  Package,
  MessageCircle,
  Home,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';

interface OrderConfirmationProps {
  order: CustomerOrder;
  outlet: OrderOutlet;
  onOrderAgain: () => void;
  onBackToHome: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  outlet,
  onOrderAgain,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // WhatsApp formatted receipt text
  const waItemsText = order.items
    .map((it) => `• ${it.quantity}x ${it.name} (${formatRupiah(it.price * it.quantity)})${it.note ? ` [Note: ${it.note}]` : ''}`)
    .join('\n');

  const waMessage = `*PESANAN BARU LETON COFFEE* ☕
---------------------------------
*No. Order:* ${order.orderNumber}
*Outlet:* ${order.outletName}
*Customer:* ${order.customerName}
*Tipe:* ${order.orderType}${order.orderType === 'DINE IN' ? ` (Meja: ${order.tableNumber})` : ''}
*Metode Bayar:* ${order.paymentMethod} (Bayar di Outlet)

*Rincian Menu:*
${waItemsText}

*TOTAL:* ${formatRupiah(order.totalAmount)}
*Status:* ${order.paymentStatus}
---------------------------------
Mohon konfirmasi pesanan saya. Terima kasih!`;

  const waLink = createWhatsAppLink(outlet.whatsapp || '6281234567890', waMessage);

  // Status badge style helper
  const getStatusBadge = () => {
    if (order.paymentStatus === 'WAITING VERIFICATION') {
      return (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold tracking-wider uppercase shadow-md">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>WAITING VERIFICATION</span>
        </div>
      );
    }
    if (order.paymentStatus === 'PAY AT STORE') {
      return (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase shadow-md">
          <Store className="w-3.5 h-3.5" />
          <span>PAY AT STORE</span>
        </div>
      );
    }
    if (order.paymentStatus === 'PAID') {
      return (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-[#00E5FF] text-xs font-mono font-bold tracking-wider uppercase shadow-md">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PAID (LUNAS)</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold tracking-wider uppercase shadow-md">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>{order.paymentStatus}</span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Animated Success Badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/20">
          <CheckCircle2 className="w-9 h-9 sm:w-12 sm:h-12" />
        </div>
        <div className="inline-block mb-2">{getStatusBadge()}</div>
        <h2 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
          PESANAN BERHASIL DIBUAT!
        </h2>
        <p className="mt-2 text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Silakan tunjukkan nomor pesanan ini ke kasir/barista outlet untuk menyelesaikan pembayaran.
        </p>
      </motion.div>

      {/* Cyber Digital Receipt Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-3xl bg-slate-900/95 border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#00E5FF]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Order Number Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between mb-6">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest block">
              NOMOR ORDER
            </span>
            <span className="font-mono font-black text-2xl sm:text-3xl text-[#00E5FF] tracking-wider">
              {order.orderNumber}
            </span>
          </div>

          <button
            onClick={handleCopyOrderNumber}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin</span>
              </>
            )}
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-800 text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 uppercase font-mono text-[10px]">Outlet</span>
            <div className="flex items-center gap-2 font-display font-bold text-white text-sm">
              <Store className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span>{order.outletName}</span>
            </div>
            <p className="text-[11px] text-slate-400">{outlet.address}</p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 uppercase font-mono text-[10px]">Tipe Pesanan</span>
            <div className="flex items-center gap-2 font-display font-bold text-white text-sm">
              {order.orderType === 'DINE IN' ? (
                <>
                  <Utensils className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>Dine In — Meja {order.tableNumber || '-'}</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>Take Away (Bawa Pulang)</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Customer: {order.customerName}</p>
          </div>
        </div>

        {/* Items List */}
        <div className="py-6 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Daftar Menu</span>
            <span>Subtotal</span>
          </div>

          <div className="space-y-2.5">
            {order.items.map((item, idx) => {
              const unitPrice =
                item.unitPrice ||
                item.price + (item.topping?.price || 0) + (item.syrup?.price || 0);
              const hasTopping = item.topping && item.topping.name !== 'No Topping';
              const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

              return (
                <div key={idx} className="flex items-start justify-between text-xs py-1 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{item.quantity}x</span>
                      <span className="text-slate-200 font-medium">{item.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 space-y-0.5">
                      {hasTopping && (
                        <div className="text-[#00E5FF]">
                          Topping: {item.topping!.name} (+{formatRupiah(item.topping!.price)})
                        </div>
                      )}
                      {hasSyrup && (
                        <div className="text-[#38BDF8]">
                          Syrup: {item.syrup!.name} (+{formatRupiah(item.syrup!.price)})
                        </div>
                      )}
                      {item.note && (
                        <span className="text-slate-400 block italic">Catatan: {item.note}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-slate-300 shrink-0">
                    {formatRupiah(unitPrice * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total & Payment Method */}
        <div className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {order.paymentMethod === 'QRIS' ? (
                <QrCode className="w-4 h-4 text-[#00E5FF]" />
              ) : (
                <Banknote className="w-4 h-4 text-[#00E5FF]" />
              )}
              <span className="text-xs text-slate-300">
                Metode: <strong className="text-white font-mono">{order.paymentMethod}</strong> (Bayar di Outlet)
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Total Bayar</span>
              <span className="font-mono font-black text-2xl text-[#00E5FF]">
                {formatRupiah(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Bukti Transfer Box if QRIS */}
          {order.paymentReceiptUrl && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Bukti Pembayaran QRIS</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                  Tersimpan di Cloud
                </span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href={order.paymentReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 block shrink-0 hover:border-[#00E5FF] transition-colors"
                >
                  <img
                    src={order.paymentReceiptUrl}
                    alt="Bukti Transfer"
                    className="w-full h-full object-cover"
                  />
                </a>
                <div className="text-[11px] text-slate-400">
                  <p className="text-slate-200 font-medium">Bukti pembayaran telah berhasil diupload.</p>
                  <a
                    href={order.paymentReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5FF] hover:underline font-mono inline-block mt-0.5"
                  >
                    Buka foto bukti transfer ↗
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Payment Guidance Notice */}
          <div className="p-4 rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/30 text-xs text-slate-300 leading-relaxed space-y-1">
            <p className="font-bold text-white">Langkah Selanjutnya:</p>
            {order.paymentMethod === 'QRIS' ? (
              <>
                <p>1. Bukti pembayaran QRIS Anda telah diterima dan dalam status <strong>WAITING VERIFICATION</strong>.</p>
                <p>2. Kasir/Barista <strong>{outlet.shortName || outlet.name}</strong> akan segera memverifikasi pembayaran Anda.</p>
                <p>3. Pesanan Anda akan langsung diproses dan disajikan begitu verifikasi selesai.</p>
              </>
            ) : (
              <>
                <p>1. Datangi kasir/barista di outlet <strong>{outlet.shortName || outlet.name}</strong>.</p>
                <p>2. Sebutkan nomor order <strong>{order.orderNumber}</strong> atau tunjukkan layar struk ini.</p>
                <p>3. Lakukan pembayaran <strong>TUNAI</strong> di kasir agar pesanan segera dibuat.</p>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="mt-8 space-y-3">
        {/* WhatsApp Receipt Button */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5"
        >
          <MessageCircle className="w-4 h-4" />
          <span>KIRIM STRUK KE WHATSAPP OUTLET</span>
        </a>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onOrderAgain}
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-display font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>PESAN LAGI</span>
          </button>

          <button
            onClick={onBackToHome}
            className="py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#2563EB]/30"
          >
            <Home className="w-3.5 h-3.5" />
            <span>KEMBALI KE BERANDA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
