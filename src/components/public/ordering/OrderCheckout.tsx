import React, { useState } from 'react';
import { useContent } from '../../../context/ContentContext';
import { resolveMediaUrl } from '../../../utils/api';
import {
  CartItem,
  OrderOutlet,
  OrderType,
  PaymentMethod,
  CustomerProfile,
} from '../../../types';
import { calculateItemUnitPrice } from '../../../data/addOnsData';
import { formatRupiah } from '../../../utils/formatters';
import { uploadPaymentReceipt } from '../../../utils/supabaseOrders';
import { isMenuItemAvailableForOutlet } from '../../../utils/supabaseStock';
import {
  Utensils,
  Package,
  ArrowLeft,
  CheckCircle2,
  Store,
  UploadCloud,
  FileCheck,
  AlertCircle,
  Bolt,
  ShieldCheck,
  Trash2,
  Layers,
  Sparkles,
  Droplets,
  Award,
  User,
} from 'lucide-react';

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
    isMemberChoice?: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
  customerProfile?: CustomerProfile | null;
}

export const OrderCheckout: React.FC<OrderCheckoutProps> = ({
  outlet,
  cart,
  generalNote,
  onBackToCart,
  onSubmitOrder,
  isSubmitting,
  customerProfile,
}) => {
  const { data } = useContent();
  const activeQrisUrl = outlet.qrisImage || data?.siteSettings?.qrisImage;

  // Form State
  const [orderType, setOrderType] = useState<OrderType>('DINE IN');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(customerProfile?.namaLengkap || '');
  const [customerPhone, setCustomerPhone] = useState<string>(customerProfile?.nomorHp || '');
  const [isMemberChoice, setIsMemberChoice] = useState<boolean>(customerProfile ? true : false);
  const [orderNote, setOrderNote] = useState<string>(generalNote || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [formError, setFormError] = useState<string>('');

  // QRIS Receipt Upload State
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [uploadedReceiptPath, setUploadedReceiptPath] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);

  const subtotal = cart.reduce(
    (acc, item) =>
      acc + calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup, item.customOptions) * item.quantity,
    0
  );
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const grandTotal = subtotal;

  // File upload handler for QRIS
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setReceiptUploadError('Ukuran file maksimal 5 MB.');
      return;
    }

    setIsUploadingReceipt(true);
    setReceiptUploadError(null);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / 1024).toFixed(0)} KB`);

    try {
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
    setUploadedFileName(null);
    setUploadedFileSize(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Outlet Stock Validation
    const unavailableItem = cart.find(
      (it) => !isMenuItemAvailableForOutlet(it.product, outlet.id)
    );
    if (unavailableItem) {
      setFormError(
        `Menu "${unavailableItem.product.name}" saat ini sedang HABIS di cabang ${outlet.shortName || outlet.name}. Silakan kembali ke keranjang untuk menghapusnya.`
      );
      return;
    }

    if (!customerName.trim()) {
      setFormError('Nama pemesan wajib diisi.');
      return;
    }

    if (orderType === 'DINE IN' && !tableNumber.trim()) {
      setFormError('Nomor meja wajib diisi untuk pesanan Dine In (Makan di Tempat).');
      return;
    }

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
      isMemberChoice,
    });
  };

  const isPlaceOrderDisabled =
    isSubmitting ||
    isUploadingReceipt ||
    (paymentMethod === 'QRIS' && !uploadedReceiptUrl);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-[#F8FBFF]">
      {/* Top Step Bar & Visual Indicator */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E0F2FE] text-[#0284C7] text-xs font-bold uppercase tracking-wider">
              Checkout &amp; Instant Pay
            </span>
            <span className="text-xs text-[#64748B] font-mono">{outlet.name} Barista Station</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-[#172033] tracking-tight mt-1">
            Konfirmasi &amp; Bayar Pesanan
          </h1>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-[#E0F2FE] shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#0284C7] text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <span className="text-xs text-[#172033] font-medium">Review</span>
          </div>
          <div className="w-6 h-0.5 bg-[#0284C7]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#0284C7] text-white flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-xs text-[#0284C7] font-bold">QRIS Pay</span>
          </div>
          <div className="w-6 h-0.5 bg-[#E0F2FE]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#F0F7FF] text-[#64748B] flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs text-[#64748B]">Seduh</span>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={onBackToCart}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-[#64748B] hover:text-[#0284C7] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#0284C7]" />
          <span>Kembali ke Keranjang Pesanan</span>
        </button>
      </div>

      {formError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* 2-COLUMN MAIN CONTENT */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================= LEFT COLUMN: ORDER DETAILS & CUSTOMER ================= */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 1. Outlet & Service Type Confirmation */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-5">
            {/* Selected Outlet Header */}
            <div className="flex items-center justify-between bg-[#F8FBFF] p-4 rounded-xl border border-[#E0F2FE]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold font-mono">
                    Outlet Ditugaskan
                  </span>
                  <span className="font-display font-black text-base text-[#172033]">
                    {outlet.name}
                  </span>
                  <span className="text-xs text-[#64748B]">{outlet.address}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onBackToCart}
                className="text-xs text-[#0284C7] hover:underline font-bold transition-colors cursor-pointer"
              >
                Ubah
              </button>
            </div>

            {/* Service Type Switcher (Dine-in / Take-away) */}
            <div className="space-y-2">
              <label className="text-xs text-[#172033] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                <Utensils className="w-4 h-4 text-[#0284C7]" />
                <span>Tipe Layanan</span>
              </label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-[#F0F7FF] rounded-xl border border-[#E0F2FE]">
                <button
                  type="button"
                  onClick={() => setOrderType('DINE IN')}
                  className={`py-3 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orderType === 'DINE IN'
                      ? 'bg-white text-[#0284C7] shadow-sm border border-[#E0F2FE]'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>Dine In (Makan di Tempat)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('TAKE AWAY')}
                  className={`py-3 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orderType === 'TAKE AWAY'
                      ? 'bg-white text-[#0284C7] shadow-sm border border-[#E0F2FE]'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Take Away (Bawa Pulang)</span>
                </button>
              </div>
            </div>

            {/* Table Number Selector (When Dine In) */}
            {orderType === 'DINE IN' && (
              <div className="space-y-1.5">
                <label className="text-xs text-[#172033] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="text-[#0284C7] font-mono">#</span>
                  <span>Nomor Meja Pelanggan <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Meja 14 (Lantai 1)"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E0F2FE] rounded-xl text-sm font-semibold text-[#172033] focus:outline-none focus:border-[#38BDF8]"
                  />
                  <span className="absolute right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#0284C7] text-[10px] font-bold">
                    Dine In
                  </span>
                </div>
              </div>
            )}

            {/* Customer Info Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#172033] font-bold">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  {customerProfile && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C39A6B]">
                      <Award className="w-3 h-3 text-[#C39A6B] shrink-0" />
                      <span>Member Leton</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={Boolean(customerProfile)}
                  placeholder="Nama pemesan..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#38BDF8] ${
                    customerProfile 
                      ? 'bg-amber-50/50 border-[#C39A6B]/30 font-semibold text-[#172033]' 
                      : 'bg-white border border-[#E0F2FE]'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#172033] font-bold">No. WhatsApp</label>
                <input
                  type="tel"
                  disabled={Boolean(customerProfile)}
                  placeholder="0812-xxxx-xxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#38BDF8] ${
                    customerProfile 
                      ? 'bg-amber-50/50 border-[#C39A6B]/30 font-semibold text-[#172033]' 
                      : 'bg-white border border-[#E0F2FE]'
                  }`}
                />
              </div>

              {/* Pilihan Keanggotaan Member Saat Checkout */}
              <div className="space-y-2 md:col-span-2 pt-2 border-t border-[#E0F2FE]">
                <label className="text-xs text-[#172033] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Award className="w-4 h-4 text-[#0284C7]" />
                  <span>Keanggotaan Member</span>
                </label>
                {customerProfile ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-[#C39A6B]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#C39A6B] text-white flex items-center justify-center font-bold text-xs">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#172033] block">
                          Terdaftar sebagai Member: <span className="text-[#0284C7]">{customerProfile.namaLengkap}</span>
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          Pesanan akan otomatis terhubung dengan akun member Anda.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#F0F7FF] rounded-2xl border border-[#E0F2FE]">
                    <button
                      type="button"
                      onClick={() => setIsMemberChoice(true)}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isMemberChoice
                          ? 'bg-white text-[#0284C7] shadow-sm border border-[#E0F2FE] ring-1 ring-[#0284C7]/20'
                          : 'text-[#64748B] hover:text-[#172033]'
                      }`}
                    >
                      <Award className="w-4 h-4 text-[#0284C7]" />
                      <span>Jadi Member</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMemberChoice(false)}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        !isMemberChoice
                          ? 'bg-white text-slate-700 shadow-sm border border-[#E0F2FE] ring-1 ring-slate-400/20'
                          : 'text-[#64748B] hover:text-[#172033]'
                      }`}
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Tidak Jadi Member</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#172033] font-bold">Catatan Tambahan untuk Barista</label>
                <input
                  type="text"
                  placeholder="Contoh: Pisahkan es batu, less sweet, dll..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E0F2FE] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            </div>
          </div>

          {/* 2. Cart Items List */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-base text-[#172033] uppercase">
                  Rincian Minuman &amp; Makanan
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#F0F7FF] text-[#0284C7] text-xs font-bold">
                {totalItems} Menu Dipilih
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {cart.map((item, idx) => {
                const unitPrice = calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup, item.customOptions);
                const hasSize = item.size && item.size.name;
                const hasTopping = item.topping && item.topping.name !== 'No Topping';
                const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-white border border-[#E0F2FE] flex items-center justify-center font-bold text-[#0284C7] shrink-0 font-mono">
                        {item.quantity}x
                      </div>
                      <div className="flex flex-col">
                        <span className="font-display font-bold text-sm text-[#172033]">
                          {item.product.name}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5 text-[11px] text-[#64748B]">
                          {hasSize && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono font-medium">
                              Size: {item.size!.name}{item.size!.price > 0 ? ` (+${formatRupiah(item.size!.price)})` : ''}
                            </span>
                          )}
                          {hasTopping && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono font-medium">
                              Top: {item.topping!.name} (+{formatRupiah(item.topping!.price)})
                            </span>
                          )}
                          {hasSyrup && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono font-medium">
                              Syr: {item.syrup!.name} (+{formatRupiah(item.syrup!.price)})
                            </span>
                          )}
                          {item.customOptions && item.customOptions.length > 0 && (
                            item.customOptions.map((co) => (
                              <span key={co.groupId} className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono font-medium">
                                {co.groupName}: {co.optionName}{co.price > 0 ? ` (+${formatRupiah(co.price)})` : ''}
                              </span>
                            ))
                          )}
                        </div>
                        {item.note && (
                          <span className="text-[11px] text-slate-500 italic mt-0.5">
                            Catatan: {item.note}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="font-bold text-sm text-[#172033] block">
                        {formatRupiah(unitPrice * item.quantity)}
                      </span>
                      <span className="text-[10px] text-[#64748B]">
                        @{formatRupiah(unitPrice)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total summary */}
            <div className="pt-3 border-t border-[#E0F2FE] flex justify-between items-center text-sm">
              <span className="font-bold text-[#172033]">Total Pembayaran</span>
              <span className="font-mono font-black text-lg text-[#0284C7]">
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: QRIS PAYMENT & UPLOAD ================= */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. Payment Method Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex flex-col gap-1 border-b border-[#E0F2FE] pb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#0284C7] font-bold">
                  Metode Pembayaran
                </span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>QRIS BI Aktif</span>
                </div>
              </div>
              <h3 className="font-display font-black text-sm text-[#172033] uppercase">
                QRIS Instant Pay (Semua Bank &amp; E-Wallet)
              </h3>
            </div>

            {/* Bank Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['BCA', 'Mandiri', 'BRI', 'BNI', 'GoPay', 'OVO', 'DANA', 'ShopeePay'].map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0284C7] font-mono text-[10px] font-bold border border-[#E0F2FE]"
                >
                  {b}
                </span>
              ))}
            </div>

            {/* QRIS SVG Representation */}
            <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-[#E0F2FE] flex flex-col items-center justify-center text-center">
              <div className="text-[11px] font-bold text-[#172033] mb-1">
                LETON COFFEE {outlet.shortName?.toUpperCase() || 'SUDIRMAN'}
              </div>
              <div className="text-[10px] font-mono text-[#64748B] mb-3">
                NMID: ID102003921829
              </div>

              {/* QR Code Display */}
              {activeQrisUrl ? (
                <div className="p-3 bg-white rounded-xl border border-[#E0F2FE] shadow-sm relative w-[#220px] max-w-full flex items-center justify-center">
                  <img
                    src={resolveMediaUrl(activeQrisUrl)}
                    alt={`QRIS ${outlet.name}`}
                    className="w-full h-auto rounded-lg object-contain max-h-64"
                  />
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-[#E0F2FE] shadow-sm relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full text-[#172033]" fill="none" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                    <rect fill="currentColor" height="35" rx="4" width="35" x="10" y="10" />
                    <rect fill="#ffffff" height="25" rx="2" width="25" x="15" y="15" />
                    <rect fill="currentColor" height="15" rx="1" width="15" x="20" y="20" />
                    <rect fill="currentColor" height="35" rx="4" width="35" x="95" y="10" />
                    <rect fill="#ffffff" height="25" rx="2" width="25" x="100" y="15" />
                    <rect fill="currentColor" height="15" rx="1" width="15" x="105" y="20" />
                    <rect fill="currentColor" height="35" rx="4" width="35" x="10" y="95" />
                    <rect fill="#ffffff" height="25" rx="2" width="25" x="15" y="100" />
                    <rect fill="currentColor" height="15" rx="1" width="15" x="20" y="105" />
                    {/* Data Points */}
                    <rect fill="currentColor" height="6" width="6" x="52" y="12" />
                    <rect fill="currentColor" height="6" width="6" x="62" y="12" />
                    <rect fill="currentColor" height="6" width="6" x="72" y="12" />
                    <rect fill="currentColor" height="6" width="6" x="82" y="12" />
                    <rect fill="currentColor" height="6" width="6" x="52" y="24" />
                    <rect fill="currentColor" height="6" width="6" x="72" y="24" />
                    <rect fill="currentColor" height="6" width="6" x="52" y="36" />
                    <rect fill="currentColor" height="6" width="6" x="62" y="36" />
                    <rect fill="currentColor" height="6" width="6" x="82" y="36" />
                    <rect fill="currentColor" height="6" width="6" x="12" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="24" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="36" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="48" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="86" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="98" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="110" y="52" />
                    <rect fill="currentColor" height="6" width="6" x="12" y="64" />
                    <rect fill="currentColor" height="6" width="6" x="36" y="64" />
                    <rect fill="currentColor" height="6" width="6" x="98" y="64" />
                    <rect fill="currentColor" height="6" width="6" x="12" y="76" />
                    <rect fill="currentColor" height="6" width="6" x="48" y="76" />
                    <rect fill="currentColor" height="6" width="6" x="86" y="76" />
                    <rect fill="currentColor" height="6" width="6" x="52" y="98" />
                    <rect fill="currentColor" height="6" width="6" x="64" y="98" />
                    <rect fill="currentColor" height="6" width="6" x="76" y="98" />
                    <rect fill="currentColor" height="6" width="6" x="88" y="98" />
                    <rect fill="currentColor" height="6" width="6" x="100" y="98" />
                    <rect fill="currentColor" height="6" width="6" x="52" y="110" />
                    <rect fill="currentColor" height="6" width="6" x="76" y="110" />
                    <rect fill="currentColor" height="6" width="6" x="100" y="110" />
                    <rect fill="currentColor" height="6" width="6" x="52" y="122" />
                    <rect fill="currentColor" height="6" width="6" x="64" y="122" />
                    <rect fill="currentColor" height="6" width="6" x="88" y="122" />
                  </svg>
                  {/* Central Brand Tag */}
                  <div className="absolute inset-0 m-auto w-10 h-10 rounded-lg bg-white border border-[#E0F2FE] shadow-md flex items-center justify-center font-display font-black text-xs text-[#0284C7]">
                    LTC
                  </div>
                </div>
              )}

              <div className="mt-3 inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-[#E0F2FE] shadow-sm">
                <span className="text-[10px] text-[#64748B]">Total Scan:</span>
                <span className="text-xs font-mono font-extrabold text-[#0284C7]">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Bukti Pembayaran Upload Area (Mandatory for QRIS) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-xs sm:text-sm text-[#172033] uppercase">
                Bukti Transfer / Screenshot
              </span>
              <span className="text-[10px] font-bold text-rose-600 font-mono">Wajib Diunggah</span>
            </div>

            {uploadedReceiptUrl ? (
              <div className="p-3.5 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#172033] truncate max-w-[180px]">
                      {uploadedFileName || 'Bukti_Transfer.jpg'}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Berhasil Diunggah ({uploadedFileSize || 'Siap'})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearReceipt}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                  title="Hapus / Ganti File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="p-5 rounded-xl bg-[#F8FBFF] border-2 border-dashed border-[#BAE6FD] hover:border-[#0284C7] flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={isUploadingReceipt}
                  className="hidden"
                />
                <UploadCloud className="w-7 h-7 text-[#0284C7] mb-1.5 animate-bounce" />
                <span className="text-xs font-bold text-[#172033]">
                  {isUploadingReceipt ? 'Mengunggah Bukti Pembayaran...' : 'Klik untuk Upload Bukti Transfer'}
                </span>
                <span className="text-[10px] text-[#64748B] mt-0.5">
                  Format JPG, PNG, atau Screenshot m-Banking (Maks. 5 MB)
                </span>
              </label>
            )}

            {receiptUploadError && (
              <p className="text-[11px] text-rose-600 font-medium">{receiptUploadError}</p>
            )}
          </div>

          {/* 4. Final Submit Button */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isPlaceOrderDisabled}
              id="submit-order-btn"
              className={`w-full py-4 px-6 rounded-xl font-display font-black text-sm tracking-wider uppercase shadow-md flex items-center justify-center gap-2 transition-all ${
                isPlaceOrderDisabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-[0_4px_14px_rgba(2,132,199,0.25)] cursor-pointer'
              }`}
            >
              <span>{isSubmitting ? 'MEMPROSES PESANAN...' : 'PLACE ORDER & VERIFIKASI SEKARANG'}</span>
              <Bolt className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F0F7FF] border border-[#E0F2FE] text-xs text-[#64748B]">
              <ShieldCheck className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
              <span>
                Pesanan Anda akan langsung diteruskan ke Kitchen Display Barista {outlet.name} secara real-time.
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
