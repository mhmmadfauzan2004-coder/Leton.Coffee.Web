import React, { useState, useEffect, useMemo } from 'react';
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
import { formatRupiah, formatOrderDate, formatOrderTime } from '../../../utils/formatters';
import { uploadPaymentReceipt } from '../../../utils/supabaseOrders';
import { isMenuItemAvailableForOutlet } from '../../../utils/supabaseStock';
import {
  subscribeToOutletAvailabilityRealtime,
  normalizeOutletKey,
} from '../../../utils/supabaseOutletStatus';
import {
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
  Sparkles,
  Award,
  User,
  Coffee,
  Check,
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  QrCode,
  Eye,
  EyeOff,
  Lock,
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
    pickupTime: string;
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
  const [customerName, setCustomerName] = useState<string>(customerProfile?.namaLengkap || '');
  const [customerPhone, setCustomerPhone] = useState<string>(customerProfile?.nomorHp || '');
  const [isMemberChoice, setIsMemberChoice] = useState<boolean>(customerProfile ? true : false);
  const [orderNote, setOrderNote] = useState<string>(generalNote || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isOutletOpen, setIsOutletOpen] = useState<boolean>(true);

  // Subscribe to live outlet availability updates
  useEffect(() => {
    const unsub = subscribeToOutletAvailabilityRealtime((statusMap) => {
      const normKey = normalizeOutletKey(outlet?.id);
      setIsOutletOpen(statusMap[normKey] !== false);
    });
    return () => unsub();
  }, [outlet?.id]);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);
  const [showQrisInstructions, setShowQrisInstructions] = useState<boolean>(false);
  const [isQrisVisible, setIsQrisVisible] = useState<boolean>(false);

  // QRIS Receipt Upload State
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [uploadedReceiptPath, setUploadedReceiptPath] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);

  // Timer countdown & Current Live Clock (Asia/Jakarta timezone)
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const subtotal = cart.reduce(
    (acc, item) =>
      acc + calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup, item.customOptions) * item.quantity,
    0
  );
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const grandTotal = subtotal;

  const handleCopyAmount = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(grandTotal.toString());
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  // Quick note chips
  const quickNotes = [
    'Pisahkan es batu',
    'Less sugar (50%)',
    'Sedotan ramah lingkungan',
    'Label nama di cup',
  ];

  const handleAddQuickNote = (note: string) => {
    setOrderNote((prev) => (prev ? `${prev}, ${note}` : note));
  };

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
    const unavailableItem = (cart || []).find(
      (it) => it?.product && !isMenuItemAvailableForOutlet(it.product, outlet?.id)
    );
    if (unavailableItem) {
      setFormError(
        `Menu "${unavailableItem.product.name}" saat ini sedang HABIS di cabang ${outlet?.shortName || outlet?.name || 'ini'}. Silakan kembali ke keranjang untuk menghapusnya.`
      );
      return;
    }

    if (!isOutletOpen) {
      setFormError('Cabang ini sedang tidak menerima pesanan online saat ini. Silakan pilih cabang lain.');
      return;
    }

    if (!customerName.trim()) {
      setFormError('Nama pemesan wajib diisi.');
      return;
    }

    if (paymentMethod === 'QRIS' && !uploadedReceiptUrl) {
      setFormError('Bukti transfer / screenshot pembayaran QRIS wajib diunggah sebelum melanjutkan.');
      return;
    }

    await onSubmitOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      orderType: 'TAKE AWAY',
      tableNumber: '',
      paymentMethod,
      paymentReceiptUrl: paymentMethod === 'QRIS' ? (uploadedReceiptUrl || undefined) : undefined,
      paymentReceiptPath: paymentMethod === 'QRIS' ? (uploadedReceiptPath || undefined) : undefined,
      isMemberChoice,
      pickupTime: pickupTime.trim(),
    });
  };

  const isPlaceOrderDisabled =
    !isOutletOpen ||
    isSubmitting ||
    isUploadingReceipt ||
    (paymentMethod === 'QRIS' && !uploadedReceiptUrl);

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 bg-[#f8f9ff] text-[#041d32] min-h-screen">
      {/* Closed Outlet Banner Alert */}
      {!isOutletOpen && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 shadow-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-extrabold text-rose-900 text-sm">Penerimaan Pesanan Tutup</h4>
            <p className="mt-0.5 text-rose-700">
              Cabang <strong>{outlet.name}</strong> saat ini sedang <strong>TIDAK MENERIMA PESANAN ONLINE</strong>.
              Silakan kembali ke keranjang atau pilih cabang lain yang sedang buka.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Stitch Stepper */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToCart}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006389] hover:underline mb-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Keranjang</span>
          </button>
          <h1 className="font-extrabold text-xl sm:text-2xl text-[#041d32] tracking-tight">
            Checkout &amp; Pembayaran
          </h1>
          <p className="text-xs text-[#3e484f] mt-0.5">
            Outlet: {outlet.name} • Siap diproses Barista
          </p>
        </div>

        {/* Stitch Progress Tracker */}
        <div className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-[#e4efff] shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-xs font-semibold text-[#041d32]">Review</span>
          </div>
          <div className="w-4 h-0.5 bg-[#006389]" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#006389] text-white flex items-center justify-center text-[10px] font-bold">
              2
            </div>
            <span className="text-xs font-bold text-[#006389]">QRIS</span>
          </div>
          <div className="w-4 h-0.5 bg-[#e4efff]" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#eef4ff] text-[#3e484f] flex items-center justify-center text-[10px] font-bold">
              <Coffee className="w-3 h-3" />
            </div>
            <span className="text-xs text-[#3e484f]">Seduh</span>
          </div>
        </div>
      </div>

      {formError && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Checkout Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Outlet Card */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#eef4ff] text-[#006389] flex items-center justify-center shrink-0">
              <Store className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-[#3e484f] font-bold block">
                Outlet Ditugaskan
              </span>
              <h3 className="font-extrabold text-sm text-[#041d32] truncate">
                Leton Coffee — {outlet.name}
              </h3>
              <p className="text-[11px] text-[#3e484f] truncate">{outlet.address}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToCart}
            className="text-xs font-bold text-[#006389] hover:underline px-2 py-1 rounded hover:bg-[#eef4ff] transition-colors cursor-pointer shrink-0"
          >
            Ubah
          </button>
        </div>

        {/* Section 1.5: Informasi Waktu Checkout (Asia/Jakarta WIB) */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#eef4ff] text-[#006389] flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#3e484f] font-bold block">
                Informasi Waktu Checkout (Asia/Jakarta • UTC+7)
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm font-extrabold text-[#041d32]">
                <span>Tanggal: <span className="font-mono text-[#006389]">{formatOrderDate(currentTime)}</span></span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span>Jam: <span className="font-mono text-[#006389]">{formatOrderTime(currentTime)}</span></span>
              </div>
            </div>
          </div>
          <div className="text-[11px] font-medium text-[#3e484f] bg-[#f8f9ff] px-3 py-1.5 rounded-lg border border-[#e4efff] shrink-0">
            Timestamp resmi dicatat saat pesanan dikonfirmasi
          </div>
        </div>

        {/* Section 2: Ringkasan Pesanan (Order Items Summary) */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#eef4ff] pb-2.5">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm text-[#041d32] uppercase tracking-wide">
                Ringkasan Pesanan
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#eef4ff] text-[#006389] text-[11px] font-bold">
              {totalItems} Menu
            </span>
          </div>

          <div className="divide-y divide-[#eef4ff]">
            {cart.map((item, idx) => {
              const unitPrice = calculateItemUnitPrice(
                item.product.price,
                item.size,
                item.topping,
                item.syrup,
                item.customOptions
              );
              const hasSize = item.size && item.size.name;
              const hasTopping = item.topping && item.topping.name !== 'No Topping';
              const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

              return (
                <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#eef4ff] overflow-hidden shrink-0 flex items-center justify-center">
                      {item.product.image ? (
                        <img
                          src={resolveMediaUrl(item.product.image)}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Coffee className="w-5 h-5 text-[#006389]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#006389]">
                          {item.quantity}x
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-[#041d32] truncate">
                          {item.product.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-[#3e484f]">
                        {hasSize && (
                          <span className="px-1.5 py-0.2 rounded bg-[#eef4ff] text-[#006389] font-medium">
                            {item.size!.name}
                          </span>
                        )}
                        {hasTopping && (
                          <span className="px-1.5 py-0.2 rounded bg-[#eef4ff] text-[#006389] font-medium">
                            {item.topping!.name}
                          </span>
                        )}
                        {hasSyrup && (
                          <span className="px-1.5 py-0.2 rounded bg-[#eef4ff] text-[#006389] font-medium">
                            {item.syrup!.name}
                          </span>
                        )}
                        {item.customOptions && item.customOptions.map((co) => (
                          <span key={co.groupId} className="px-1.5 py-0.2 rounded bg-[#eef4ff] text-[#006389] font-medium">
                            {co.optionName}
                          </span>
                        ))}
                      </div>
                      {item.note && (
                        <p className="text-[11px] text-amber-700 italic mt-0.5">
                          Catatan: {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="font-extrabold text-xs sm:text-sm text-[#041d32] whitespace-nowrap shrink-0">
                    {formatRupiah(unitPrice * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#eef4ff] flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToCart}
              className="text-xs font-bold text-[#006389] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah pesanan lain</span>
            </button>
            <span className="text-xs font-bold text-[#3e484f]">
              Subtotal: <strong className="text-[#041d32]">{formatRupiah(subtotal)}</strong>
            </span>
          </div>
        </div>

        {/* Section: "MAU PICKUP JAM BERAPA?" */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs space-y-2">
          <label htmlFor="input-pickup-time" className="block font-extrabold text-sm text-[#041d32] uppercase tracking-wide">
            MAU PICKUP JAM BERAPA?
          </label>
          <input
            id="input-pickup-time"
            type="text"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            placeholder="Contoh: Jam 17.00"
            className="w-full px-3.5 py-2.5 bg-white border border-[#e4efff] rounded-lg text-xs sm:text-sm font-semibold text-[#041d32] placeholder:text-slate-400 focus:outline-none focus:border-[#006389] shadow-2xs"
          />
        </div>

        {/* Section 4: Data Pemesan & Member */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-[#041d32] uppercase tracking-wide">
              Informasi Pemesan
            </h2>
            {customerProfile && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Member Terdaftar</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#041d32]">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={Boolean(customerProfile)}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Anda..."
                className={`w-full px-3.5 py-2 rounded-lg text-xs sm:text-sm text-[#041d32] focus:outline-none focus:border-[#006389] ${
                  customerProfile
                    ? 'bg-amber-50/60 border border-amber-200 font-semibold'
                    : 'bg-white border border-[#e4efff]'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#041d32]">
                No. WhatsApp <span className="text-slate-400 font-normal">(Untuk Notifikasi)</span>
              </label>
              <input
                type="tel"
                disabled={Boolean(customerProfile)}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className={`w-full px-3.5 py-2 rounded-lg text-xs sm:text-sm text-[#041d32] focus:outline-none focus:border-[#006389] ${
                  customerProfile
                    ? 'bg-amber-50/60 border border-amber-200 font-semibold'
                    : 'bg-white border border-[#e4efff]'
                }`}
              />
            </div>
          </div>

          {/* Member Choice Section */}
          {!customerProfile && (
            <div className="pt-2 border-t border-[#eef4ff]">
              <label className="text-xs font-bold text-[#041d32] block mb-2">
                Keanggotaan Member Leton
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#eef4ff] rounded-xl border border-[#e4efff]">
                <button
                  type="button"
                  onClick={() => setIsMemberChoice(true)}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isMemberChoice
                      ? 'bg-white text-[#006389] shadow-xs border border-[#e4efff]'
                      : 'text-[#3e484f] hover:text-[#041d32]'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-[#006389]" />
                  <span>Daftar Jadi Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMemberChoice(false)}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !isMemberChoice
                      ? 'bg-white text-slate-700 shadow-xs border border-[#e4efff]'
                      : 'text-[#3e484f] hover:text-[#041d32]'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tanpa Member</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Catatan Tambahan */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs space-y-2.5">
          <label className="text-xs font-bold text-[#041d32] block">
            Catatan Pesanan <span className="text-slate-400 font-normal">(Opsional)</span>
          </label>
          <input
            type="text"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Contoh: Pisahkan es batu, less sweet, dll..."
            className="w-full px-3.5 py-2.5 bg-white border border-[#e4efff] rounded-lg text-xs sm:text-sm text-[#041d32] focus:outline-none focus:border-[#006389]"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-[#3e484f] font-semibold">Cepat tambah:</span>
            {quickNotes.map((qn) => (
              <button
                key={qn}
                type="button"
                onClick={() => handleAddQuickNote(qn)}
                className="px-2 py-0.5 rounded-full bg-[#eef4ff] hover:bg-[#e4efff] text-[#006389] text-[10px] font-bold transition-colors cursor-pointer"
              >
                + {qn}
              </button>
            ))}
          </div>
        </div>

        {/* Section 6: Detail Pembayaran (Ringkasan Biaya) */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#e4efff] shadow-xs space-y-2.5">
          <h2 className="font-extrabold text-sm text-[#041d32] uppercase tracking-wide border-b border-[#eef4ff] pb-2">
            Rincian Pembayaran
          </h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#3e484f]">
              <span>Subtotal Pesanan</span>
              <span className="font-bold text-[#041d32]">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#3e484f]">
              <span>Biaya Layanan &amp; Antar</span>
              <span className="font-bold text-emerald-600">GRATIS</span>
            </div>
            <div className="flex justify-between text-[#3e484f]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Poin Leton yang Didapat</span>
              </span>
              <span className="font-bold text-amber-600">+{Math.floor(grandTotal / 1000)} Pts</span>
            </div>
            <div className="pt-2 border-t border-[#eef4ff] flex justify-between items-center text-sm">
              <span className="font-extrabold text-[#041d32]">Total Pembayaran</span>
              <span className="font-black text-lg text-[#006389]">{formatRupiah(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Section 7: QRIS Payment Card (Stitch Design) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#e4efff] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eef4ff] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#006389] uppercase tracking-wider bg-[#eef4ff] px-2 py-0.5 rounded-full">
                  QRIS INSTANT PAY
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Sistem Realtime</span>
                </span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#041d32] mt-1">
                Scan QRIS Semua Bank &amp; E-Wallet
              </h3>
            </div>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Selesaikan dalam {formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Copy Amount Box */}
          <div className="p-3 rounded-xl bg-[#eef4ff] border border-[#e4efff] flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-[#3e484f] uppercase tracking-wider block font-bold">
                Total yang harus dibayar:
              </span>
              <span className="font-black text-lg text-[#006389]">
                {formatRupiah(grandTotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyAmount}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#e4efff] text-xs font-bold text-[#006389] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              {copiedAmount ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Nominal</span>
                </>
              )}
            </button>
          </div>

          {/* QR Code Container with Toggle Flow */}
          <div className="bg-[#f8f9ff] rounded-xl p-4 sm:p-5 border border-[#e4efff] flex flex-col items-center justify-center text-center transition-all duration-300">
            {!isQrisVisible ? (
              <div className="py-4 px-2 flex flex-col items-center justify-center text-center max-w-sm w-full space-y-3.5">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#c6e7ff] flex items-center justify-center text-[#006389] shadow-xs">
                  <QrCode className="w-6 h-6 text-[#006389]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-[#041d32]">
                    Pembayaran QRIS
                  </h4>
                  <p className="text-xs text-[#3e484f]">
                    Silakan lakukan pembayaran menggunakan QRIS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrisVisible(true)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#006389] hover:bg-[#004c6b] text-white font-extrabold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>TAMPILKAN QRIS</span>
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                {/* Notice and Hide Button above QRIS */}
                <div className="w-full mb-3 pb-2.5 border-b border-[#e4efff] flex flex-col sm:flex-row items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#006389] text-center sm:text-left">
                    Silahkan screenshot dan melakukan pembayaran dengan QRIS ini
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsQrisVisible(false)}
                    className="px-3 py-1 rounded-lg bg-white border border-[#e4efff] hover:bg-[#eef4ff] text-[11px] font-bold text-[#3e484f] hover:text-[#006389] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>SEMBUNYIKAN QRIS</span>
                  </button>
                </div>

                <div className="text-[11px] font-extrabold text-[#041d32] uppercase tracking-wide mb-0.5">
                  LETON COFFEE {outlet.shortName?.toUpperCase() || 'DUMAI'}
                </div>
                <div className="text-[10px] text-[#3e484f] mb-3 font-mono">
                  NMID: ID102003921829 • Standar Pembayaran Nasional
                </div>

                {/* QR Box with corner styling */}
                <div className="p-3.5 bg-white rounded-xl border border-[#e4efff] shadow-sm relative w-56 max-w-full flex items-center justify-center">
                  {activeQrisUrl ? (
                    <img
                      src={resolveMediaUrl(activeQrisUrl)}
                      alt={`QRIS ${outlet.name}`}
                      className="w-full h-auto rounded-lg object-contain max-h-56"
                    />
                  ) : (
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      <svg className="w-full h-full text-[#041d32]" fill="none" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                        <rect fill="currentColor" height="35" rx="4" width="35" x="10" y="10" />
                        <rect fill="#ffffff" height="25" rx="2" width="25" x="15" y="15" />
                        <rect fill="currentColor" height="15" rx="1" width="15" x="20" y="20" />
                        <rect fill="currentColor" height="35" rx="4" width="35" x="95" y="10" />
                        <rect fill="#ffffff" height="25" rx="2" width="25" x="100" y="15" />
                        <rect fill="currentColor" height="15" rx="1" width="15" x="105" y="20" />
                        <rect fill="currentColor" height="35" rx="4" width="35" x="10" y="95" />
                        <rect fill="#ffffff" height="25" rx="2" width="25" x="15" y="100" />
                        <rect fill="currentColor" height="15" rx="1" width="15" x="20" y="105" />
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
                        <rect fill="currentColor" height="110" width="6" x="52" y="52" />
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
                      <div className="absolute inset-0 m-auto w-10 h-10 rounded-lg bg-white border border-[#e4efff] shadow-md flex items-center justify-center font-black text-xs text-[#006389]">
                        LTC
                      </div>
                    </div>
                  )}
                </div>

                {/* Bank/Wallet Logos Chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-sm">
                  {['BCA', 'Mandiri', 'BRI', 'BNI', 'GoPay', 'OVO', 'DANA', 'ShopeePay'].map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded bg-white text-[#006389] font-mono text-[10px] font-bold border border-[#e4efff]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Bukti Transfer (Mandatory for QRIS) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#041d32] uppercase tracking-wide">
                Unggah Bukti Transfer / Screenshot
              </label>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Wajib Diunggah
              </span>
            </div>

            {uploadedReceiptUrl ? (
              <div className="p-3.5 rounded-xl bg-[#eef4ff] border border-[#e4efff] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#e4efff] flex items-center justify-center text-[#006389] shrink-0">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#041d32] truncate block">
                      {uploadedFileName || 'Bukti_Pembayaran.jpg'}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Berhasil Diunggah ({uploadedFileSize || 'Siap'})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearReceipt}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer shrink-0"
                  title="Ganti Foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="p-4 sm:p-5 rounded-xl bg-[#f8f9ff] border-2 border-dashed border-[#c6e7ff] hover:border-[#006389] flex flex-col items-center justify-center text-center cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={isUploadingReceipt}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-[#006389] mb-1 group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-xs font-bold text-[#041d32]">
                  {isUploadingReceipt ? 'Mengunggah Bukti Pembayaran...' : 'PILIH FOTO / SCREENSHOT STRUK'}
                </span>
                <span className="text-[10px] text-[#3e484f] mt-0.5">
                  Format JPG, PNG, atau Screenshot m-Banking (Maks. 5 MB)
                </span>
              </label>
            )}

            {receiptUploadError && (
              <p className="text-[11px] text-rose-600 font-medium">{receiptUploadError}</p>
            )}

            <p className="text-[11px] text-[#3e484f]">
              Menyertakan struk akan mempercepat barista kami memulai pesanan Anda.
            </p>
          </div>

          {/* Accordion Cara Membayar QRIS */}
          <div className="border-t border-[#eef4ff] pt-2">
            <button
              type="button"
              onClick={() => setShowQrisInstructions(!showQrisInstructions)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#006389] py-1 cursor-pointer"
            >
              <span>Cara Membayar dengan QRIS</span>
              {showQrisInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showQrisInstructions && (
              <div className="mt-2 text-xs text-[#3e484f] space-y-1.5 pl-3 border-l-2 border-[#006389]/30">
                <p>1. Buka aplikasi m-Banking (BCA, Mandiri, BRI, dll) atau E-Wallet (GoPay, OVO, Dana, ShopeePay).</p>
                <p>2. Pilih menu <strong>Scan / Bayar QRIS</strong> dan arahkan kamera ke barcode di atas (atau screenshot).</p>
                <p>3. Masukkan nominal tepat <strong>{formatRupiah(grandTotal)}</strong> sesuai total pesanan.</p>
                <p>4. Selesaikan pembayaran, simpan screenshot bukti, dan unggah pada kotak di atas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 8: Final Submit Button */}
        <div className="space-y-3 pt-2">
          <button
            type="submit"
            disabled={isPlaceOrderDisabled}
            id="submit-order-btn"
            className={`w-full py-4 px-6 rounded-xl font-black text-sm tracking-wide uppercase shadow-md flex items-center justify-center gap-2 transition-all ${
              isPlaceOrderDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#006389] hover:bg-[#004c6b] text-white shadow-[0_4px_16px_rgba(0,99,137,0.25)] active:scale-[0.99] cursor-pointer'
            }`}
          >
            {!isOutletOpen ? (
              <>
                <Lock className="w-4.5 h-4.5 text-slate-400" />
                <span>CABANG TIDAK MENERIMA ORDER</span>
              </>
            ) : isSubmitting ? (
              <span>MEMPROSES PESANAN...</span>
            ) : (
              <>
                <span>BUAT PESANAN SEKARANG</span>
                <Bolt className="w-4.5 h-4.5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-[#3e484f]">
            <ShieldCheck className="w-4 h-4 text-[#006389]" />
            <span>Pembayaran terenkripsi &amp; diverifikasi otomatis oleh sistem Leton</span>
          </div>
        </div>
      </form>
    </div>
  );
};

