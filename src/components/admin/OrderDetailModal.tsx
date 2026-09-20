import React, { useState } from 'react';
import { CustomerOrder } from '../../types';
import { formatRupiah, createWhatsAppLink } from '../../utils/formatters';
import {
  X,
  Clock,
  User,
  Phone,
  MapPin,
  Utensils,
  Package,
  QrCode,
  Banknote,
  ClipboardList,
  MessageCircle,
  Eye,
  AlertCircle,
  FileCheck,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CustomerOrder | null;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ isOpen, onClose, order }) => {
  const [zoomReceipt, setZoomReceipt] = useState<boolean>(false);

  if (!order) return null;

  const notifyWaText = `Halo Kak ${order.customerName}, pesanan Leton Coffee dengan nomor *${order.orderNumber}* saat ini berstatus: *${order.orderStatus}* (Status Pembayaran: *${order.paymentStatus}*). Terima kasih!`;
  const customerWaLink = order.customerPhone
    ? createWhatsAppLink(order.customerPhone, notifyWaText)
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="order-detail-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={(e) => {
            if ((e.target as HTMLElement).id === 'order-detail-modal-overlay') {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF]">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white text-lg tracking-wider">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      | Detail Transaksi Lengkap
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Memantau rincian pemesanan & pelunasan customer secara aktual
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
              {/* Top Banner: Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Status Pemesanan</span>
                    <span className="font-display font-black text-base text-white tracking-wide uppercase mt-1 block">
                      {order.orderStatus}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider ${
                      order.orderStatus === 'NEW'
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 animate-pulse'
                        : order.orderStatus === 'ACCEPTED'
                        ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                        : order.orderStatus === 'PREPARING'
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                        : order.orderStatus === 'READY'
                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                        : order.orderStatus === 'COMPLETED'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Status Pembayaran</span>
                    <span className="font-display font-black text-base text-white tracking-wide uppercase mt-1 block">
                      {order.paymentStatus}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider ${
                      order.paymentStatus === 'PAID'
                        ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-400'
                        : order.paymentStatus === 'WAITING VERIFICATION' || order.paymentStatus === 'WAITING_VERIFICATION'
                        ? 'bg-amber-950 border border-amber-500/60 text-amber-300 animate-pulse'
                        : order.paymentStatus === 'PAY AT STORE'
                        ? 'bg-blue-950 border border-blue-500/50 text-blue-300'
                        : order.paymentStatus === 'PAYMENT REJECTED'
                        ? 'bg-rose-950 border border-rose-500/60 text-rose-300'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Grid 2 Columns for detailed segments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column Left: Customer and Payment details */}
                <div className="space-y-4">
                  {/* Customer Information Block */}
                  <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
                    <h4 className="font-display font-black text-xs text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                      <User className="w-4 h-4 text-[#00E5FF]" />
                      <span>Informasi Pelanggan</span>
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">Nama Lengkap</span>
                        <span className="col-span-2 font-bold text-white text-sm">{order.customerName}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">No. WhatsApp</span>
                        <div className="col-span-2 space-y-1">
                          {order.customerPhone ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-white">{order.customerPhone}</span>
                              {customerWaLink && (
                                <a
                                  href={customerWaLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Kirim Pesan</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Tidak dilampirkan</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">Outlet Cabang</span>
                        <span className="col-span-2 font-semibold text-white flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#00E5FF]" />
                          {order.outletName}
                        </span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">Tipe / Meja</span>
                        <span className="col-span-2 font-mono font-bold text-white uppercase">
                          {order.orderType === 'DINE IN' ? (
                            <span className="text-indigo-400">DINE IN (MEJA: {order.tableNumber || '-'})</span>
                          ) : (
                            <span className="text-pink-400">TAKE AWAY (Bawa Pulang)</span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">Waktu Transaksi</span>
                        <span className="col-span-2 font-mono text-slate-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(order.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Block */}
                  <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
                    <h4 className="font-display font-black text-xs text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                      <CreditCard className="w-4 h-4 text-[#00E5FF]" />
                      <span>Metode & Verifikasi Pembayaran</span>
                    </h4>

                    <div className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400">Metode Bayar</span>
                        <span className="col-span-2 font-mono font-black text-white text-sm flex items-center gap-1.5">
                          {order.paymentMethod === 'QRIS' ? (
                            <>
                              <QrCode className="w-4 h-4 text-[#00E5FF]" />
                              <span>QRIS LETON (Auto-Upload)</span>
                            </>
                          ) : (
                            <>
                              <Banknote className="w-4 h-4 text-emerald-400" />
                              <span>BAYAR DI KASIR / TUNAI</span>
                            </>
                          )}
                        </span>
                      </div>

                      {order.paymentMethod === 'QRIS' && (
                        <div className="space-y-2">
                          <span className="text-slate-400 block mb-1">Bukti Slip Transfer QRIS:</span>
                          {order.paymentReceiptUrl ? (
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                              <div
                                onClick={() => setZoomReceipt(true)}
                                className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden cursor-pointer relative group shrink-0"
                                title="Klik untuk memperbesar gambar"
                              >
                                <img
                                  src={order.paymentReceiptUrl}
                                  alt="Struk Transfer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 block w-max mb-1">
                                  ✓ Berkas Terlampir
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setZoomReceipt(true)}
                                  className="text-xs text-cyan-400 font-mono hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Perbesar Bukti</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>Struk bukti transfer belum diunggah oleh customer.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {order.rejectionReason && (
                        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-rose-300 font-mono uppercase">Bukti Ditolak:</strong>
                            <span>{order.rejectionReason}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Right: Menu items breakdown and pricing */}
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4 h-full flex flex-col justify-between">
                    <div>
                      <h4 className="font-display font-black text-xs text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                        <ShoppingBag className="w-4 h-4 text-[#00E5FF]" />
                        <span>Rincian Item Belanja ({order.items.reduce((a, b) => a + b.quantity, 0)} Pcs)</span>
                      </h4>

                      {/* Items loop */}
                      <div className="divide-y divide-slate-800/80 max-h-[35vh] overflow-y-auto pr-1 mt-3 space-y-3">
                        {order.items.map((it, idx) => {
                          const sizePrice = it.size?.price || 0;
                          const topPrice = it.topping?.price || 0;
                          const syrPrice = it.syrup?.price || 0;
                          const customsPrice = (it.customOptions || []).reduce((sum, c) => sum + (c.price || 0), 0);
                          const unitPrice = it.unitPrice || (it.price + sizePrice + topPrice + syrPrice + customsPrice);
                          const itemSubtotal = unitPrice * it.quantity;

                          return (
                            <div key={idx} className="pt-3 first:pt-0 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono font-black text-xs text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20 mt-0.5">
                                    {it.quantity}x
                                  </span>
                                  <div>
                                    <h5 className="font-bold text-white text-sm">{it.name}</h5>
                                    <div className="pl-1.5 space-y-0.5 mt-1 border-l border-slate-800 text-[11px] text-slate-400 font-mono">
                                      {it.size && it.size.name && (
                                        <p className="text-indigo-400">Cup: {it.size.name} ({sizePrice > 0 ? `+${formatRupiah(sizePrice)}` : 'Rp0'})</p>
                                      )}
                                      {it.topping && it.topping.name !== 'No Topping' && (
                                        <p className="text-cyan-400">Topping: {it.topping.name} (+{formatRupiah(topPrice)})</p>
                                      )}
                                      {it.syrup && it.syrup.name !== 'No Syrup' && (
                                        <p className="text-pink-400">Syrup: {it.syrup.name} (+{formatRupiah(syrPrice)})</p>
                                      )}
                                      {it.customOptions && it.customOptions.length > 0 &&
                                        it.customOptions.map((co, cidx) => (
                                          <p key={cidx} className="text-emerald-400">
                                            {co.groupName}: {co.optionName} {co.price > 0 ? `(+${formatRupiah(co.price)})` : ''}
                                          </p>
                                        ))
                                      }
                                      {it.note && (
                                        <p className="text-amber-300 italic bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/60 mt-1 max-w-xs">
                                          "Catatan: {it.note}"
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-mono text-xs font-bold text-white shrink-0">
                                  {formatRupiah(itemSubtotal)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Total Summary Block */}
                    <div className="border-t border-slate-800 pt-4 mt-4 space-y-2">
                      {order.customerNote && (
                        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-300 text-xs font-mono mb-2">
                          <strong className="block text-[10px] uppercase text-slate-400 mb-0.5">Catatan Customer:</strong>
                          <span>"{order.customerNote}"</span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs text-slate-400 font-mono">
                        <span>Subtotal Rincian</span>
                        <span>{formatRupiah(order.totalAmount)}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-800/60">
                        <span className="font-display font-black text-xs text-white uppercase tracking-wider">Total Pembayaran</span>
                        <span className="font-mono font-black text-xl text-[#00E5FF]">
                          {formatRupiah(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700"
              >
                TUTUP DETAIL
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Embedded zoom receipt lightbox modal */}
      {zoomReceipt && order.paymentReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400">Bukti Pembayaran QRIS - {order.orderNumber}</span>
              <button
                onClick={() => setZoomReceipt(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto max-h-[70vh] bg-black/50 p-2 rounded-xl flex items-center justify-center">
              <img
                src={order.paymentReceiptUrl}
                alt="Zoomed Slip"
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>
            <button
              onClick={() => setZoomReceipt(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Kembali
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
