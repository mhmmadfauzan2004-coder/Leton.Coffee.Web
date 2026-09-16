import React, { useState } from 'react';
import {
  CartItem,
  OrderOutlet,
  OrderType,
  PaymentMethod,
} from '../../../types';
import { calculateItemUnitPrice, generateCartItemId } from '../../../data/addOnsData';
import { formatRupiah } from '../../../utils/formatters';
import { QrisPaymentCard } from './QrisPaymentCard';
import { uploadPaymentReceipt } from '../../../utils/supabaseOrders';
import {
  Utensils,
  Package,
  QrCode,
  Banknote,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  User,
  Phone,
  Sparkles,
  Store,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { motion } from 'motion/react';

interface OrderCheckoutProps {
  outlet: OrderOutlet;
  cart: CartItem[];
  generalNote: string;
  onBackToCart: () => void;
  onSubmitOrder: (orderDetails: {
    customerName: string;
    customerPhone: string;
    orderType: OrderType;
    tableNumber: string;
    paymentMethod: PaymentMethod;
    paymentReceiptUrl?: string;
    paymentReceiptPath?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export const OrderCheckout: React.FC<OrderCheckoutProps> = ({
  outlet,
  cart,
  generalNote,
  onBackToCart,
  onSubmitOrder,
  isSubmitting,
}) => {
  // Form State
  const [orderType, setOrderType] = useState<OrderType>('DINE IN');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [formError, setFormError] = useState<string>('');

  // QRIS Receipt Upload State
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [uploadedReceiptPath, setUploadedReceiptPath] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);

  const subtotal = cart.reduce(
    (acc, item) =>
      acc + calculateItemUnitPrice(item.product.price, item.topping, item.syrup) * item.quantity,
    0
  );
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // File upload handler for QRIS
  const handleUploadReceiptFile = async (file: File) => {
    setIsUploadingReceipt(true);
    setReceiptUploadError(null);
    try {
      // Temporary order code reference for unique file identification
      const tempOrderRef = `ORD-${Date.now().toString().slice(-6)}`;
      const result = await uploadPaymentReceipt(file, tempOrderRef);
      if (result.success && result.url) {
        setUploadedReceiptUrl(result.url);
        setUploadedReceiptPath(result.path || result.url);
      } else {
        setReceiptUploadError(result.error || 'Gagal mengupload bukti pembayaran.');
      }
    } catch (err: any) {
      setReceiptUploadError('Terjadi kendala saat mengupload. Silakan coba lagi.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleClearReceipt = () => {
    setUploadedReceiptUrl(null);
    setUploadedReceiptPath(null);
    setReceiptUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError('Nama pemesan wajib diisi.');
      return;
    }

    if (orderType === 'DINE IN' && !tableNumber.trim()) {
      setFormError('Nomor meja wajib diisi untuk pesanan Dine In (Makan di Tempat).');
      return;
    }

    // QRIS Validation: Bukti pembayaran WAJIB diupload sebelum customer dapat menekan tombol PLACE ORDER
    if (paymentMethod === 'QRIS' && !uploadedReceiptUrl) {
      setFormError('Bukti transfer / pembayaran QRIS wajib diupload sebelum Anda dapat menekan tombol PLACE ORDER.');
      return;
    }

    await onSubmitOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      orderType,
      tableNumber: tableNumber.trim(),
      paymentMethod,
      paymentReceiptUrl: paymentMethod === 'QRIS' ? (uploadedReceiptUrl || undefined) : undefined,
      paymentReceiptPath: paymentMethod === 'QRIS' ? (uploadedReceiptPath || undefined) : undefined,
    });
  };

  const isPlaceOrderDisabled =
    isSubmitting ||
    isUploadingReceipt ||
    (paymentMethod === 'QRIS' && !uploadedReceiptUrl);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={onBackToCart}
        className="inline-flex items-center gap-2 text-xs font-mono uppercase text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-[#00E5FF]" />
        <span>Kembali ke Keranjang</span>
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/40 text-[#60A5FA] text-xs font-mono tracking-widest uppercase mb-3 shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>LANGKAH 3 — TIPE PESANAN & PEMBAYARAN</span>
        </div>
        <h2 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
          KONFIRMASI PESANAN
        </h2>
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400 mt-2">
          <Store className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>{outlet.name}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Pilih Order Type (DINE IN / TAKE AWAY) */}
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-xs font-mono">
              1
            </span>
            <span>TIPE PESANAN</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* DINE IN */}
            <button
              type="button"
              onClick={() => setOrderType('DINE IN')}
              className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                orderType === 'DINE IN'
                  ? 'bg-[#2563EB]/20 border-[#00E5FF] shadow-lg shadow-[#00E5FF]/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Utensils
                  className={`w-6 h-6 ${
                    orderType === 'DINE IN' ? 'text-[#00E5FF]' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    orderType === 'DINE IN'
                      ? 'border-[#00E5FF] bg-[#00E5FF]'
                      : 'border-slate-600'
                  }`}
                >
                  {orderType === 'DINE IN' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display font-black text-sm text-white uppercase">DINE IN</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Makan / Minum di Meja Outlet</p>
              </div>
            </button>

            {/* TAKE AWAY */}
            <button
              type="button"
              onClick={() => setOrderType('TAKE AWAY')}
              className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                orderType === 'TAKE AWAY'
                  ? 'bg-[#2563EB]/20 border-[#00E5FF] shadow-lg shadow-[#00E5FF]/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Package
                  className={`w-6 h-6 ${
                    orderType === 'TAKE AWAY' ? 'text-[#00E5FF]' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    orderType === 'TAKE AWAY'
                      ? 'border-[#00E5FF] bg-[#00E5FF]'
                      : 'border-slate-600'
                  }`}
                >
                  {orderType === 'TAKE AWAY' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                  )}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display font-black text-sm text-white uppercase">TAKE AWAY</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Bungkus / Bawa Pulang</p>
              </div>
            </button>
          </div>

          {/* Conditional Table Number for DINE IN */}
          {orderType === 'DINE IN' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-2"
            >
              <label className="block text-xs font-mono uppercase text-slate-300 font-bold mb-1.5">
                Nomor Meja <span className="text-[#00E5FF]">*Wajib Diisi</span>
              </label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Contoh: Meja 04, Bar 02..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Silakan lihat nomor yang tertera pada meja tempat Anda duduk di {outlet.shortName || outlet.name}.
              </p>
            </motion.div>
          )}
        </div>

        {/* Step 2: Data Diri Pemesan */}
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-xs font-mono">
              2
            </span>
            <span>INFORMASI PEMESAN</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Nama Customer <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pemesan..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>No. WhatsApp (Opsional)</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0812xxxxxx..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Metode Pembayaran (QRIS / TUNAI) */}
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5">
          <h3 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-xs font-mono">
              3
            </span>
            <span>PILIH METODE PEMBAYARAN</span>
          </h3>

          {/* Toggle buttons between QRIS and TUNAI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Opsi 1: QRIS */}
            <button
              type="button"
              onClick={() => setPaymentMethod('QRIS')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-start gap-3.5 cursor-pointer ${
                paymentMethod === 'QRIS'
                  ? 'bg-[#2563EB]/20 border-[#00E5FF] shadow-lg shadow-[#00E5FF]/10 ring-1 ring-[#00E5FF]/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  paymentMethod === 'QRIS'
                    ? 'bg-[#00E5FF] text-slate-950 font-black shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <QrCode className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-black text-base text-white uppercase">QRIS</h4>
                  {paymentMethod === 'QRIS' && (
                    <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Scan QRIS & upload bukti transfer.
                </p>
                <span className="inline-block mt-2 text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  Status: WAITING VERIFICATION
                </span>
              </div>
            </button>

            {/* Opsi 2: TUNAI */}
            <button
              type="button"
              onClick={() => setPaymentMethod('TUNAI')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-start gap-3.5 cursor-pointer ${
                paymentMethod === 'TUNAI'
                  ? 'bg-[#2563EB]/20 border-[#00E5FF] shadow-lg shadow-[#00E5FF]/10 ring-1 ring-[#00E5FF]/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  paymentMethod === 'TUNAI'
                    ? 'bg-[#00E5FF] text-slate-950 font-black shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Banknote className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-black text-base text-white uppercase">TUNAI</h4>
                  {paymentMethod === 'TUNAI' && (
                    <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Bayar langsung di kasir outlet.
                </p>
                <span className="inline-block mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Status: PAY AT STORE
                </span>
              </div>
            </button>
          </div>

          {/* Conditional Payment UI based on method selection */}
          {paymentMethod === 'QRIS' ? (
            /* QRIS Flow: QRIS image, total, instructions, and upload field */
            <div className="pt-2">
              <QrisPaymentCard
                totalAmount={subtotal}
                outlet={outlet}
                uploadedReceiptUrl={uploadedReceiptUrl}
                uploadedReceiptPath={uploadedReceiptPath}
                isUploading={isUploadingReceipt}
                uploadError={receiptUploadError}
                onReceiptUploaded={(url, path) => {
                  setUploadedReceiptUrl(url);
                  setUploadedReceiptPath(path || url);
                }}
                onClearReceipt={handleClearReceipt}
                onUploadFile={handleUploadReceiptFile}
              />
            </div>
          ) : (
            /* TUNAI Flow: Bayar di kasir, tidak perlu upload */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
            >
              <div className="flex items-center gap-2 text-white font-display font-black text-sm uppercase">
                <Banknote className="w-5 h-5 text-[#00E5FF]" />
                <span>TUNAI</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed space-y-1">
                <p className="font-bold text-emerald-300">
                  “Pembayaran dilakukan langsung di kasir outlet.”
                </p>
                <p className="text-slate-300">
                  Tidak perlu upload bukti pembayaran. Setelah menekan tombol <strong>PLACE ORDER</strong>, Anda akan menerima nomor pesanan untuk ditunjukkan ke kasir {outlet.shortName || outlet.name}.
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">Status Pembayaran Setelah Order:</span>
                <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-500/40">
                  PAY AT STORE
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Ringkasan Pesanan */}
        <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h4 className="font-display font-black text-sm text-white uppercase tracking-wider">
            RINGKASAN ITEM ({totalItems} ITEM)
          </h4>

          <div className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
            {cart.map((item) => {
              const itemId =
                item.id ||
                generateCartItemId(item.product.id, item.topping?.name, item.syrup?.name);
              const unitPrice = calculateItemUnitPrice(
                item.product.price,
                item.topping,
                item.syrup
              );
              const hasTopping = item.topping && item.topping.name !== 'No Topping';
              const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

              return (
                <div key={itemId} className="py-2.5 flex items-start justify-between text-xs gap-3">
                  <div className="flex items-start gap-2">
                    <span className="font-mono font-bold text-white px-1.5 py-0.5 rounded bg-slate-800 shrink-0">
                      {item.quantity}x
                    </span>
                    <div>
                      <span className="text-slate-200 font-medium">{item.product.name}</span>
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
                          <span className="text-slate-400 block italic">"{item.note}"</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-slate-300 shrink-0">
                    {formatRupiah(unitPrice * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
            <span className="font-display font-bold text-sm text-white uppercase">TOTAL AKHIR</span>
            <span className="font-mono font-black text-2xl text-[#00E5FF]">
              {formatRupiah(subtotal)}
            </span>
          </div>
        </div>

        {formError && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Place Order Action Section */}
        <div className="pt-2 space-y-3">
          {paymentMethod === 'QRIS' && !uploadedReceiptUrl && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-mono">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Tombol Place Order akan aktif setelah Anda mengunggah bukti pembayaran QRIS di atas.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPlaceOrderDisabled}
            id="place-order-submit-btn"
            className={`w-full py-4 px-6 rounded-2xl font-display font-black text-sm sm:text-base tracking-wider uppercase transition-all flex items-center justify-center gap-3 ${
              isPlaceOrderDisabled
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-[#2563EB] via-[#1d4ed8] to-[#00E5FF] hover:from-[#1d4ed8] hover:to-[#38bdf8] text-white shadow-xl shadow-blue-500/25 hover:shadow-cyan-500/40 active:scale-[0.99] cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>MEMPROSES PESANAN...</span>
              </>
            ) : isUploadingReceipt ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>MENGUNGGAH BUKTI TRANSFER...</span>
              </>
            ) : (
              <>
                <span>PLACE ORDER</span>
                <span className="text-lg leading-none">→</span>
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 font-mono">
            {paymentMethod === 'QRIS'
              ? 'Pesanan akan masuk dengan status WAITING VERIFICATION untuk diverifikasi admin.'
              : 'Pesanan akan masuk dengan status PAY AT STORE untuk diselesaikan di kasir.'}
          </p>
        </div>
      </form>
    </div>
  );
};
