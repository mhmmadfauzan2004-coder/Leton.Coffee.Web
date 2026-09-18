import React, { useState, useEffect, useMemo } from 'react';
import { CustomerOrder, OrderStatus, PaymentStatus } from '../../types';
import { useContent } from '../../context/ContentContext';
import { matchesOutlet } from '../../data/adminAccounts';
import {
  fetchAllOrders,
  updateOrderStatus,
  subscribeToOrdersRealtime,
  ORDERS_SQL_SCHEMA,
} from '../../utils/supabaseOrders';
import { formatRupiah, createWhatsAppLink } from '../../utils/formatters';
import {
  ShoppingBag,
  Clock,
  Utensils,
  Package,
  QrCode,
  Banknote,
  Search,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Code,
  Copy,
  Check,
  MessageCircle,
  Store,
  Eye,
  XCircle,
  X,
  FileCheck,
  ExternalLink,
  ShieldCheck,
  Building2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OrderManager: React.FC = () => {
  const { auth } = useContent();
  const isOutletAdmin = auth.role === 'outlet_admin';
  const assignedOutletId = auth.outletId || '';
  const assignedOutletName = auth.outletName || (isOutletAdmin ? 'Outlet Ditugaskan' : 'Semua Cabang');

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(
    isOutletAdmin && assignedOutletId ? assignedOutletId : 'ALL'
  );
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Lightbox & Rejection dialog states
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<CustomerOrder | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Play synthetic chime when new order arrives
  const playOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start();
      osc1.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio context might be blocked until user gesture
    }
  };

  // Determine active target outlet filter
  const effectiveOutletScope = isOutletAdmin ? assignedOutletId : selectedOutletFilter;

  // Initial fetch and subscription
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      const targetId = effectiveOutletScope !== 'ALL' ? effectiveOutletScope : undefined;
      const data = await fetchAllOrders(targetId);
      if (mounted) {
        setOrders(data);
        setIsLoading(false);
      }
    };

    load();

    // Subscribe to realtime orders for this outlet scope
    const targetId = effectiveOutletScope !== 'ALL' ? effectiveOutletScope : undefined;
    const unsubscribe = subscribeToOrdersRealtime(
      (updatedList) => {
        if (mounted) {
          setOrders(updatedList);
        }
      },
      (_newOrder) => {
        playOrderChime();
      },
      targetId
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [soundEnabled, effectiveOutletScope]);

  // Handle status update
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    newPaymentStatus?: PaymentStatus,
    rejectionReason?: string
  ) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus, newPaymentStatus, rejectionReason);
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              orderStatus: newStatus,
              paymentStatus: newPaymentStatus || o.paymentStatus,
              rejectionReason: rejectionReason !== undefined ? rejectionReason : o.rejectionReason,
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        })
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Quick Action: Verify Payment to PAID
  const handleVerifyPayment = async (order: CustomerOrder) => {
    // If order is NEW, advance to ACCEPTED simultaneously for faster workflow
    const nextOrderStatus = order.orderStatus === 'NEW' ? 'ACCEPTED' : order.orderStatus;
    await handleUpdateStatus(order.id, nextOrderStatus, 'PAID', '');
  };

  // Open Reject Dialog
  const handleOpenRejectDialog = (order: CustomerOrder) => {
    setRejectingOrder(order);
    setRejectionReasonInput('Nominal transfer tidak sesuai atau bukti pembayaran tidak valid.');
  };

  // Submit Rejection
  const handleSubmitRejectPayment = async () => {
    if (!rejectingOrder) return;
    setIsSubmittingReject(true);
    try {
      await handleUpdateStatus(
        rejectingOrder.id,
        rejectingOrder.orderStatus,
        'PAYMENT REJECTED',
        rejectionReasonInput.trim() || 'Bukti pembayaran ditolak oleh kasir.'
      );
      setRejectingOrder(null);
      setRejectionReasonInput('');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchOutlet = matchesOutlet(order.outletId, effectiveOutletScope);
      const matchStatus =
        selectedStatusFilter === 'ALL' || order.orderStatus === selectedStatusFilter;
      const matchPayment =
        selectedPaymentFilter === 'ALL' || order.paymentStatus === selectedPaymentFilter;
      const matchSearch =
        !searchQuery.trim() ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.tableNumber && order.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchOutlet && matchStatus && matchPayment && matchSearch;
    });
  }, [orders, effectiveOutletScope, selectedStatusFilter, selectedPaymentFilter, searchQuery]);

  // Statistics scoped to role or selected outlet
  const stats = useMemo(() => {
    const scoped = isOutletAdmin
      ? orders
      : (selectedOutletFilter === 'ALL' ? orders : orders.filter((o) => matchesOutlet(o.outletId, selectedOutletFilter)));

    const total = scoped.length;
    const newCount = scoped.filter((o) => o.orderStatus === 'NEW').length;
    const waitingVerificationCount = scoped.filter(
      (o) => o.paymentStatus === 'WAITING VERIFICATION'
    ).length;
    const preparingCount = scoped.filter((o) => o.orderStatus === 'PREPARING').length;
    const waitingPaymentCount = scoped.filter(
      (o) => o.paymentStatus === 'WAITING PAYMENT' || o.paymentStatus === 'PAY AT STORE'
    ).length;
    const totalRevenue = scoped
      .filter((o) => o.orderStatus !== 'CANCELLED')
      .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

    return {
      total,
      newCount,
      waitingVerificationCount,
      preparingCount,
      waitingPaymentCount,
      totalRevenue,
    };
  }, [orders, isOutletAdmin, selectedOutletFilter]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(ORDERS_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Role & Outlet Scope Notification Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isOutletAdmin
            ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            : 'bg-cyan-950/30 border-[#00E5FF]/40 text-cyan-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOutletAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-[#00E5FF]/20 text-[#00E5FF]'
            }`}
          >
            {isOutletAdmin ? <Building2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider ${
                  isOutletAdmin
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#00E5FF] text-slate-950'
                }`}
              >
                {isOutletAdmin ? 'OUTLET ADMIN' : 'SUPER ADMIN'}
              </span>
              <span className="text-xs font-mono font-bold text-white uppercase">
                {assignedOutletName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isOutletAdmin
                ? 'Mode Terisolasi: Pesanan, verifikasi pembayaran, notifikasi suara, dan statistik dibatasi hanya untuk outlet ini.'
                : 'Mode Penuh: Memantau seluruh transaksi, omset, dan pesanan real-time dari 3 cabang Leton.'}
            </p>
          </div>
        </div>

        {/* Super Admin Quick Outlet Switcher */}
        {!isOutletAdmin && (
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-[11px] font-mono">
            <span className="text-slate-500 px-2 text-[10px]">FILTER:</span>
            {[
              { id: 'ALL', label: 'SEMUA' },
              { id: 'sudirman', label: 'SUDIRMAN' },
              { id: 'ratusima', label: 'RATU SIMA' },
              { id: 'letgo', label: "LET'GO" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedOutletFilter(btn.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedOutletFilter === btn.id
                    ? 'bg-[#00E5FF] text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono uppercase tracking-widest mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>REALTIME ORDER TRACKER</span>
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            MANAJEMEN PESANAN & PEMBAYARAN ONLINE
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Verifikasi bukti transfer QRIS, proses pembayaran kasir, dan kelola status dapur Leton Coffee.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 text-xs font-mono cursor-pointer ${
              soundEnabled
                ? 'bg-slate-900 border-[#00E5FF]/50 text-[#00E5FF]'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Notifikasi Suara Aktif' : 'Notifikasi Suara Nonaktif'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{soundEnabled ? 'Suara Aktif' : 'Mute'}</span>
          </button>

          {/* SQL Schema helper */}
          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="p-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Code className="w-4 h-4 text-[#00E5FF]" />
            <span>Skema SQL Supabase</span>
          </button>
        </div>
      </div>

      {/* Stats Overview Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* NEW ORDERS */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
            PESANAN BARU
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-[#00E5FF]">
              {stats.newCount}
            </span>
            {stats.newCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Perlu Dikonfirmasi</span>
        </div>

        {/* WAITING VERIFICATION (QRIS) */}
        <div className={`p-4 rounded-2xl border transition-all ${
          stats.waitingVerificationCount > 0
            ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider block font-bold">
              VERIFIKASI QRIS
            </span>
            {stats.waitingVerificationCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                PERLU CEK
              </span>
            )}
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-amber-400">
              {stats.waitingVerificationCount}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Bukti Transfer Masuk</span>
        </div>

        {/* PREPARING */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
            SEDANG DIRACIK
          </span>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-blue-400">
              {stats.preparingCount}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Proses Barista</span>
        </div>

        {/* TOTAL ORDERS */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
            TOTAL ORDER
          </span>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-white">
              {stats.total}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Seluruh Riwayat</span>
        </div>

        {/* TOTAL REVENUE */}
        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-slate-900/90 border border-[#2563EB]/40">
          <span className="text-[10px] font-mono uppercase text-[#60A5FA] tracking-wider block">
            TOTAL OMSET ORDER
          </span>
          <div className="mt-2">
            <span className="font-mono font-black text-lg sm:text-xl text-white">
              {formatRupiah(stats.totalRevenue)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Non-Cancelled</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari #Order, Nama Customer, Meja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-[#00E5FF] transition-colors font-mono"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Outlet filter */}
          {isOutletAdmin ? (
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-1.5 font-mono">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{assignedOutletName}</span>
              <Lock className="w-3 h-3 text-amber-400/70" />
            </div>
          ) : (
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-[#00E5FF]"
            >
              <option value="ALL">Semua Cabang</option>
              <option value="sudirman">Sudirman (Ch. 5)</option>
              <option value="ratusima">Ratusima (Ch. 6)</option>
              <option value="letgo">LetGo (MPP)</option>
            </select>
          )}

          {/* Order Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-[#00E5FF]"
          >
            <option value="ALL">Status Pesanan: Semua</option>
            <option value="NEW">NEW (Baru)</option>
            <option value="ACCEPTED">ACCEPTED (Diterima)</option>
            <option value="PREPARING">PREPARING (Dirajik)</option>
            <option value="READY">READY (Siap)</option>
            <option value="COMPLETED">COMPLETED (Selesai)</option>
            <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
          </select>

          {/* Payment Status filter */}
          <select
            value={selectedPaymentFilter}
            onChange={(e) => setSelectedPaymentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-[#00E5FF]"
          >
            <option value="ALL">Status Bayar: Semua</option>
            <option value="WAITING VERIFICATION">WAITING VERIFICATION (QRIS)</option>
            <option value="PAY AT STORE">PAY AT STORE (Tunai)</option>
            <option value="PAID">PAID (Lunas)</option>
            <option value="PAYMENT REJECTED">PAYMENT REJECTED (Ditolak)</option>
            <option value="WAITING PAYMENT">WAITING PAYMENT</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <span className="w-8 h-8 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin mb-3" />
          <p className="font-mono text-xs text-slate-400">Memuat data pesanan realtime...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800">
          <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="font-display font-bold text-white text-base">Belum Ada Pesanan yang Sesuai</p>
          <p className="text-slate-400 text-xs mt-1">
            Pesanan baru yang dibuat oleh customer akan otomatis muncul di sini secara realtime.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isUpdating = updatingOrderId === order.id;

            // Notification message for customer WhatsApp
            const notifyWaText = `Halo Kak ${order.customerName}, pesanan Leton Coffee dengan nomor *${order.orderNumber}* saat ini berstatus: *${order.orderStatus}* (Status Pembayaran: *${order.paymentStatus}*). Terima kasih!`;
            const customerWaLink = order.customerPhone
              ? createWhatsAppLink(order.customerPhone, notifyWaText)
              : null;

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/95 border transition-all ${
                  order.paymentStatus === 'WAITING VERIFICATION'
                    ? 'border-amber-500/80 shadow-lg shadow-amber-500/10'
                    : order.orderStatus === 'NEW'
                    ? 'border-[#00E5FF]/80 shadow-lg shadow-[#00E5FF]/10'
                    : 'border-slate-800/90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-black text-lg sm:text-xl text-[#00E5FF] tracking-wider">
                      {order.orderNumber}
                    </span>

                    {/* Order Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider ${
                        order.orderStatus === 'NEW'
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 animate-pulse'
                          : order.orderStatus === 'ACCEPTED'
                          ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                          : order.orderStatus === 'PREPARING'
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                          : order.orderStatus === 'READY'
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                          : order.orderStatus === 'COMPLETED'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                      }`}
                    >
                      {order.orderStatus}
                    </span>

                    {/* Payment Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-400'
                          : order.paymentStatus === 'WAITING VERIFICATION'
                          ? 'bg-amber-950 border border-amber-500/60 text-amber-300 animate-pulse'
                          : order.paymentStatus === 'PAY AT STORE'
                          ? 'bg-blue-950 border border-blue-500/50 text-blue-300'
                          : order.paymentStatus === 'PAYMENT REJECTED'
                          ? 'bg-rose-950 border border-rose-500/60 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Outlet & Table */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      OUTLET & MEJA
                    </span>
                    <div className="flex items-center gap-2 font-display font-bold text-white text-sm">
                      <Store className="w-4 h-4 text-[#00E5FF] shrink-0" />
                      <span>{order.outletName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      {order.orderType === 'DINE IN' ? (
                        <>
                          <Utensils className="w-3.5 h-3.5 text-[#00E5FF]" />
                          <span className="font-mono font-bold text-white">
                            Dine In (Meja: {order.tableNumber || '-'})
                          </span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>Take Away (Bawa Pulang)</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      PEMESAN
                    </span>
                    <p className="font-display font-bold text-white text-sm">
                      {order.customerName}
                    </p>
                    {order.customerPhone ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">{order.customerPhone}</span>
                        {customerWaLink && (
                          <a
                            href={customerWaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No. HP tidak diisi</span>
                    )}
                  </div>

                  {/* Payment & Total */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      METODE & TOTAL
                    </span>
                    <div className="flex items-center gap-2 text-slate-300">
                      {order.paymentMethod === 'QRIS' ? (
                        <QrCode className="w-4 h-4 text-[#00E5FF]" />
                      ) : (
                        <Banknote className="w-4 h-4 text-[#00E5FF]" />
                      )}
                      <span className="font-mono font-bold text-white">
                        {order.paymentMethod}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({order.paymentMethod === 'QRIS' ? 'Upload QRIS' : 'Bayar Kasir'})
                      </span>
                    </div>
                    <div className="font-mono font-black text-lg text-[#00E5FF]">
                      Total: {formatRupiah(order.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* QRIS PAYMENT PROOF DETAIL & THUMBNAIL (For QRIS) */}
                {order.paymentMethod === 'QRIS' && (
                  <div className="mb-4 p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-[#00E5FF]" />
                        <span className="font-display font-bold text-xs uppercase text-white tracking-wider">
                          BUKTI PEMBAYARAN QRIS CUSTOMER
                        </span>
                      </div>

                      {order.paymentReceiptUrl ? (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          ✓ File Bukti Tersedia
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">
                          ⚠️ Bukti Belum Terlampir
                        </span>
                      )}
                    </div>

                    {order.paymentReceiptUrl ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-3.5">
                          {/* Thumbnail */}
                          <div
                            onClick={() => setPreviewImageUrl(order.paymentReceiptUrl || null)}
                            className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 cursor-pointer relative group"
                            title="Klik untuk memperbesar bukti transfer"
                          >
                            <img
                              src={order.paymentReceiptUrl}
                              alt="Bukti Transfer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="font-mono text-xs text-slate-300 block">
                              File tersimpan di Supabase Storage
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImageUrl(order.paymentReceiptUrl || null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-[#00E5FF]" />
                                <span>Perbesar Foto</span>
                              </button>
                              <a
                                href={order.paymentReceiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                                <span>Buka Tab Baru</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Admin Action: Verify or Reject */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          {order.paymentStatus !== 'PAID' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleVerifyPayment(order)}
                              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>VERIFIKASI / LUNAS</span>
                            </button>
                          )}

                          {order.paymentStatus !== 'PAYMENT REJECTED' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleOpenRejectDialog(order)}
                              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <XCircle className="w-4 h-4 text-rose-400" />
                              <span>TOLAK BUKTI</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Customer belum mengunggah file bukti transfer untuk pesanan ini.
                      </p>
                    )}

                    {/* Rejection Note Alert if rejected */}
                    {order.paymentStatus === 'PAYMENT REJECTED' && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-rose-300 uppercase font-mono">
                            Bukti Pembayaran Ditolak:
                          </strong>
                          <span>{order.rejectionReason || 'Alasan tidak dispesifikasikan.'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TUNAI PAYMENT ACTION BAR (For Cash at Store) */}
                {order.paymentMethod === 'TUNAI' && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">
                        Pembayaran Tunai di Kasir. Status:{' '}
                        <strong className="font-mono text-emerald-400">{order.paymentStatus}</strong>
                      </span>
                    </div>

                    {order.paymentStatus !== 'PAID' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleVerifyPayment(order)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>TERIMA PEMBAYARAN TUNAI (LUNAS)</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Items Breakdown */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    RINCIAN MENU ({order.items.reduce((a, b) => a + b.quantity, 0)} Item)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {order.items.map((it, idx) => {
                      const sizePrice = it.size?.price || 0;
                      const topPrice = it.topping?.price || 0;
                      const syrPrice = it.syrup?.price || 0;
                      const unitPrice = it.unitPrice || (it.price + sizePrice + topPrice + syrPrice);
                      const itemSubtotal = unitPrice * it.quantity;
                      const hasSize = it.size && it.size.name;
                      const hasTopping = it.topping && it.topping.name !== 'No Topping';
                      const hasSyrup = it.syrup && it.syrup.name !== 'No Syrup';

                      return (
                        <div
                          key={idx}
                          className="flex flex-col justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-black text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20 shrink-0">
                                  {it.quantity}x
                                </span>
                                <span className="font-bold text-white text-sm truncate">
                                  {it.name}
                                </span>
                              </div>
                              <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap shrink-0">
                                Menu: {formatRupiah(it.price)}
                              </span>
                            </div>

                            {/* Size Details */}
                            {hasSize && (
                              <div className="text-[11px] font-mono text-[#00E5FF] flex items-center justify-between pl-1">
                                <span>Size: {it.size!.name}</span>
                                <span>{sizePrice > 0 ? `+${formatRupiah(sizePrice)}` : 'Rp0'}</span>
                              </div>
                            )}

                            {/* Topping Details */}
                            {hasTopping ? (
                              <div className="text-[11px] font-mono text-[#38BDF8] flex items-center justify-between pl-1">
                                <span>Topping: {it.topping!.name}</span>
                                <span>+{formatRupiah(topPrice)}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-slate-500 pl-1">
                                Topping: No Topping (Rp0)
                              </div>
                            )}

                            {/* Syrup Details */}
                            {hasSyrup ? (
                              <div className="text-[11px] font-mono text-[#818CF8] flex items-center justify-between pl-1">
                                <span>Syrup: {it.syrup!.name}</span>
                                <span>+{formatRupiah(syrPrice)}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-slate-500 pl-1">
                                Syrup: No Syrup (Rp0)
                              </div>
                            )}

                            {it.note && (
                              <div className="text-slate-300 text-[11px] italic bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80">
                                Catatan: "{it.note}"
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
                            <span className="text-slate-400 text-[10px] uppercase">
                              Subtotal Item
                            </span>
                            <span className="font-bold text-[#00E5FF]">
                              {formatRupiah(itemSubtotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {order.customerNote && (
                    <div className="pt-2 text-xs text-amber-300/90 font-mono">
                      Catatan Pemesan: "{order.customerNote}"
                    </div>
                  )}
                </div>

                {/* Operational Action Bar: Prominent PESANAN SUDAH SIAP Button */}
                <div className="pt-4 mt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {order.orderStatus !== 'READY' && order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'CANCELLED' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>PESANAN SUDAH SIAP</span>
                      </button>
                    ) : order.orderStatus === 'READY' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Pesanan Sudah Siap (Menunggu Customer Ambil)</span>
                        </span>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs uppercase font-bold transition-all cursor-pointer border border-slate-700"
                        >
                          Tandai Selesai
                        </button>
                      </div>
                    ) : null}

                    {/* Order Status Stepper Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">
                        Status Manual:
                      </span>
                      {(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as OrderStatus[]).map(
                        (st) => {
                          const isCurrent = order.orderStatus === st;
                          return (
                            <button
                              key={st}
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(order.id, st)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-[#00E5FF] text-slate-950 font-black shadow-md shadow-cyan-500/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Payment Status Dropdown for Full Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono uppercase text-slate-400">Bayar:</span>
                    <select
                      disabled={isUpdating}
                      value={order.paymentStatus}
                      onChange={(e) =>
                        handleUpdateStatus(
                          order.id,
                          order.orderStatus,
                          e.target.value as PaymentStatus
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#00E5FF] cursor-pointer"
                    >
                      <option value="WAITING VERIFICATION">WAITING VERIFICATION</option>
                      <option value="PAY AT STORE">PAY AT STORE</option>
                      <option value="PAID">PAID (Lunas)</option>
                      <option value="PAYMENT REJECTED">PAYMENT REJECTED</option>
                      <option value="WAITING PAYMENT">WAITING PAYMENT</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview Modal for Receipt */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white uppercase flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#00E5FF]" />
                  <span>Detail Bukti Pembayaran QRIS</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Periksa kejelasan nominal transfer, nama rekening tujuan, dan tanggal transaksi.
                </span>
              </div>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl bg-black/60 p-2 flex items-center justify-center">
              <img
                src={previewImageUrl}
                alt="Bukti Transfer Penuh"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#00E5FF] hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka gambar resolusi asli</span>
              </a>

              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-display font-black text-base uppercase">
                  TOLAK BUKTI PEMBAYARAN
                </h3>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Order: <strong className="text-white font-mono">{rejectingOrder.orderNumber}</strong> ({rejectingOrder.customerName})
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-slate-400 font-bold block">
                Alasan Penolakan Bukti:
              </label>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Contoh: Nominal transfer kurang, bukti transfer tidak terbaca, transaksi kadaluarsa..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs uppercase tracking-wider"
              >
                BATAL
              </button>
              <button
                type="button"
                disabled={isSubmittingReject}
                onClick={handleSubmitRejectPayment}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30"
              >
                {isSubmittingReject ? (
                  <span>Menyimpan...</span>
                ) : (
                  <span>KONFIRMASI TOLAK</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Schema Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-lg text-white uppercase">
                  Skema Database Supabase untuk Online Ordering & Pembayaran
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Jalankan skrip ini sekali di SQL Editor Supabase untuk membuat tabel orders lengkap dengan kolom payment_receipt_url, payment_receipt_path, dan rejection_reason.
                </p>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              <pre className="whitespace-pre-wrap">{ORDERS_SQL_SCHEMA}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Copy script di atas lalu paste ke Supabase SQL Editor
              </span>
              <button
                onClick={handleCopySql}
                className="px-4 py-2 rounded-xl bg-[#00E5FF] text-slate-950 font-display font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Tersalin ke Clipboard!' : 'Salin Semua SQL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
