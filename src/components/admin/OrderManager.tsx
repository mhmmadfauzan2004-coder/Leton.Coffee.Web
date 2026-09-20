import React, { useState, useEffect, useMemo } from 'react';
import { CustomerOrder, OrderStatus, PaymentStatus } from '../../types';
import { useContent } from '../../context/ContentContext';
import { matchesOutlet } from '../../data/adminAccounts';
import {
  fetchAllOrders,
  updateOrderStatus,
  deleteOrder,
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
  ClipboardList,
  Printer,
  ExternalLink,
  ShieldCheck,
  Building2,
  Lock,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KitchenSlipModal } from './KitchenSlipModal';
import { OrderDetailModal } from './OrderDetailModal';

export const OrderManager: React.FC = () => {
  const { auth, showToast } = useContent();
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

  // Lightbox & Modal states
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Rejection modal states
  const [rejectingOrder, setRejectingOrder] = useState<CustomerOrder | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Deletion modal states
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Kitchen Slip / Checker modal states
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<CustomerOrder | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState<boolean>(false);

  // Order Detail modal states
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<CustomerOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // New order notification state
  const [notificationState, setNotificationState] = useState<{
    showBanner: boolean;
    currentOrder: CustomerOrder | null;
    orderCount: number;
  }>({
    showBanner: false,
    currentOrder: null,
    orderCount: 0,
  });
  const notifiedOrderIdsRef = React.useRef<Set<string>>(new Set());

  // Play synthetic chime when new order arrives (with resume for autoplay policy safety)
  const playOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Note 1: High crisp ding
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.4, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: Harmonious dong
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.14); // A5
      gain2.gain.setValueAtTime(0, now + 0.14);
      gain2.gain.linearRampToValueAtTime(0.45, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.85);
    } catch (e) {
      // Non-blocking catch if browser restricts audio
      console.warn('[Audio Notification Warning]:', e);
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
      (newOrder) => {
        if (!notifiedOrderIdsRef.current.has(newOrder.id)) {
          notifiedOrderIdsRef.current.add(newOrder.id);
          playOrderChime();
          setNotificationState((prev) => ({
            showBanner: true,
            currentOrder: newOrder,
            orderCount: prev.orderCount + 1,
          }));
        }
      },
      targetId
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [soundEnabled, effectiveOutletScope]);


  // Handle status update with instant Optimistic UI + non-blocking background sync + rollback
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    newPaymentStatus?: PaymentStatus,
    rejectionReason?: string
  ) => {
    // 1. Snapshot previous state for rollback
    const previousOrders = [...orders];

    // 2. OPTIMISTIC UPDATE: Update UI immediately (0ms delay)
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

    // 3. Background sync to Supabase without blocking UI
    try {
      const success = await updateOrderStatus(orderId, newStatus, newPaymentStatus, rejectionReason);
      if (!success) {
        throw new Error('Gagal memperbarui status di cloud');
      }
    } catch (err: any) {
      console.error('[Order Status Update Failed - Rolling Back UI]:', err);
      setOrders(previousOrders);
      showToast('Gagal memperbarui status pesanan: ' + (err?.message || 'Koneksi terputus') + '. Perubahan dibatalkan.', 'error');
    }
  };

  // Action 1: [ SIAP ]
  const handleMarkReady = async (order: CustomerOrder) => {
    // Strict Outlet Isolation Check
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }

    setUpdatingOrderId(order.id);
    try {
      if (order.orderStatus === 'READY') {
        // Toggle or mark completed if already ready
        await handleUpdateStatus(order.id, 'COMPLETED');
        showToast(`Pesanan #${order.orderNumber} telah ditandai SELESAI.`, 'success');
      } else {
        // Mark as READY (Siap diambil) and confirm payment if QRIS with receipt or cash
        const nextPayment = (order.paymentMethod === 'QRIS' && order.paymentReceiptUrl) || order.paymentMethod === 'TUNAI'
          ? 'PAID'
          : order.paymentStatus;

        await handleUpdateStatus(order.id, 'READY', nextPayment, '');
        showToast(`Pesanan #${order.orderNumber} berhasil ditandai SIAP ☕`, 'success');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Action 2: [ TOLAK ]
  const handleOpenRejectDialog = (order: CustomerOrder) => {
    // Strict Outlet Isolation Check
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }
    setRejectingOrder(order);
    setRejectionReasonInput('Stok bahan habis / toko sedang tutup / transaksi tidak valid.');
  };

  const handleSubmitRejectOrder = async () => {
    if (!rejectingOrder) return;
    setIsSubmittingReject(true);
    try {
      await handleUpdateStatus(
        rejectingOrder.id,
        'CANCELLED',
        'REJECTED',
        rejectionReasonInput.trim() || 'Pesanan ditolak oleh kasir outlet.'
      );
      showToast(`Pesanan #${rejectingOrder.orderNumber} telah DITOLAK.`, 'info');
      setRejectingOrder(null);
      setRejectionReasonInput('');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Action 3: [ HAPUS PESANAN ]
  const handleOpenDeleteDialog = (order: CustomerOrder) => {
    // Strict Outlet Isolation Check
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }
    setOrderToDelete(order);
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsSubmittingDelete(true);
    const targetId = orderToDelete.id;
    const targetNumber = orderToDelete.orderNumber;

    try {
      // Optimistic delete from UI
      setOrders((prev) => prev.filter((o) => o.id !== targetId));

      await deleteOrder(targetId, assignedOutletId, auth.role);
      showToast(`Pesanan #${targetNumber} berhasil dihapus dari daftar.`, 'success');
      setOrderToDelete(null);
    } catch (err: any) {
      showToast('Gagal menghapus pesanan: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsSubmittingDelete(false);
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
      {/* New Order Notification Banner */}
      <AnimatePresence>
        {notificationState.showBanner && notificationState.currentOrder && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="dark-navy-card fixed top-20 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 p-4 rounded-2xl bg-slate-950 border border-[#00E5FF] shadow-2xl shadow-[#00E5FF]/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00E5FF]/20 flex items-center justify-center shrink-0 animate-pulse">
                <ShoppingBag className="w-5 h-5 text-[#00E5FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-white text-sm uppercase flex items-center gap-2">
                  <span className="text-[#00E5FF]">🔔</span> PESANAN BARU
                </h3>
                <div className="mt-2 space-y-1 text-xs text-slate-300 font-mono">
                  <p>Order: <span className="font-bold text-white">{notificationState.currentOrder.orderNumber.startsWith('#') ? notificationState.currentOrder.orderNumber : `#${notificationState.currentOrder.orderNumber}`}</span></p>
                  <p>Customer: <span className="text-white">{notificationState.currentOrder.customerName}</span></p>
                  <p>Outlet: <span className="text-white">{notificationState.currentOrder.outletName}</span></p>
                  <p>Total: <span className="font-bold text-[#00E5FF]">{formatRupiah(notificationState.currentOrder.totalAmount)}</span></p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedOrderDetail(notificationState.currentOrder);
                      setIsDetailModalOpen(true);
                      setNotificationState((prev) => ({ ...prev, showBanner: false }));
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#00E5FF] text-slate-950 font-black text-[11px] uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
                  >
                    LIHAT PESANAN
                  </button>
                  <button
                    onClick={() => setNotificationState((prev) => ({ ...prev, showBanner: false }))}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold text-[11px] uppercase tracking-wider hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                onClick={() => {
                  setSelectedOrderDetail(order);
                  setIsDetailModalOpen(true);
                }}
                className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900/95 border transition-all cursor-pointer hover:bg-slate-900/70 hover:border-slate-700/80 hover:shadow-xl ${
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderForSlip(order);
                        setIsSlipModalOpen(true);
                      }}
                      className="font-mono font-black text-lg sm:text-xl text-[#00E5FF] hover:text-cyan-300 tracking-wider flex items-center gap-1.5 transition-all cursor-pointer group text-left focus:outline-none bg-transparent border-0 p-0"
                      title="Klik untuk membuka Slip Dapur / Barista"
                    >
                      <span>{order.orderNumber}</span>
                      <ClipboardList className="w-4 h-4 text-[#00E5FF]/70 group-hover:text-[#00E5FF] transition-all group-hover:scale-110" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderForSlip(order);
                        setIsSlipModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 hover:border-[#00E5FF]/60 flex items-center gap-1 transition-all cursor-pointer"
                      title="Cetak atau Lihat Slip Dapur"
                    >
                      <Printer className="w-3 h-3" />
                      <span>SLIP DAPUR</span>
                    </button>

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
                            onClick={(e) => e.stopPropagation()}
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
                          {/* Thumbnail (Clickable to view full preview) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(order.paymentReceiptUrl || null);
                            }}
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
                              File tersimpan di Cloud Storage
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImageUrl(order.paymentReceiptUrl || null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-[#00E5FF]" />
                                <span>Perbesar Foto</span>
                              </button>
                              <a
                                href={order.paymentReceiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                                <span>Buka Tab Baru</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Customer belum mengunggah file bukti transfer untuk pesanan ini.
                      </p>
                    )}

                    {/* Rejection Note Alert if rejected */}
                    {(order.orderStatus === 'CANCELLED' || order.paymentStatus === 'PAYMENT REJECTED' || order.paymentStatus === 'REJECTED') && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-rose-300 uppercase font-mono">
                            Status Penolakan:
                          </strong>
                          <span>{order.rejectionReason || 'Alasan tidak dispesifikasikan.'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TUNAI PAYMENT INFO BAR (For Cash at Store) */}
                {order.paymentMethod === 'TUNAI' && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                    <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">
                      Pembayaran Tunai di Kasir. Status:{' '}
                      <strong className="font-mono text-emerald-400">{order.paymentStatus}</strong>
                    </span>
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
                      const customsPrice = (it.customOptions || []).reduce((sum, c) => sum + (c.price || 0), 0);
                      const unitPrice = it.unitPrice || (it.price + sizePrice + topPrice + syrPrice + customsPrice);
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

                            {/* Dynamic Customization Options */}
                            {it.customOptions && it.customOptions.length > 0 && (
                              it.customOptions.map((co) => (
                                <div key={co.groupId} className="text-[11px] font-mono text-[#00E5FF] flex items-center justify-between pl-1">
                                  <span>{co.groupName}: {co.optionName}</span>
                                  <span>{co.price > 0 ? `+${formatRupiah(co.price)}` : 'Rp0'}</span>
                                </div>
                              ))
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

                {/* SIMPLIFIED ADMIN OUTLET ACTIONS: [ SIAP ] [ TOLAK ] [ HAPUS PESANAN ] */}
                <div className="pt-4 mt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* 1. [ SIAP ] ACTION */}
                    {order.orderStatus !== 'READY' && order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'CANCELLED' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkReady(order);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>SIAP</span>
                      </button>
                    ) : order.orderStatus === 'READY' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Pesanan Sudah Siap (Menunggu Customer Ambil)</span>
                        </span>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkReady(order);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs uppercase font-bold transition-all cursor-pointer border border-slate-700"
                        >
                          Selesai
                        </button>
                      </div>
                    ) : order.orderStatus === 'CANCELLED' ? (
                      <span className="px-3.5 py-2 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-300 font-mono font-bold text-xs flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Pesanan Ditolak</span>
                      </span>
                    ) : (
                      <span className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-mono font-bold text-xs flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Pesanan Selesai</span>
                      </span>
                    )}

                    {/* 2. [ TOLAK ] ACTION */}
                    {order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'COMPLETED' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRejectDialog(order);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>TOLAK</span>
                      </button>
                    )}

                    {/* 3. [ HAPUS PESANAN ] ACTION */}
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteDialog(order);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Hapus pesanan dari antrean"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>HAPUS PESANAN</span>
                    </button>
                  </div>

                  {/* Operational Utilities: Slip & Detail */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderForSlip(order);
                        setIsSlipModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Slip Dapur</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderDetail(order);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>Detail</span>
                    </button>
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

      {/* Rejection Modal for TOLAK */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-display font-black text-base uppercase">
                  TOLAK PESANAN
                </h3>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin menolak pesanan{' '}
              <strong className="text-white font-mono">#{rejectingOrder.orderNumber}</strong> ({rejectingOrder.customerName})?
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-slate-400 font-bold block">
                Alasan Penolakan:
              </label>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Contoh: Stok bahan habis, toko sedang tutup, antrean penuh..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                disabled={isSubmittingReject}
                onClick={handleSubmitRejectOrder}
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

      {/* Deletion Confirmation Modal for HAPUS PESANAN */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-display font-black text-base uppercase">
                  HAPUS PESANAN
                </h3>
              </div>
              <button
                onClick={() => setOrderToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Hapus pesanan{' '}
                <strong className="text-white font-mono">#{orderToDelete.orderNumber}</strong> ({orderToDelete.customerName}) dari daftar?
              </p>
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300">
                ⚠️ Tindakan ini akan menghapus pesanan dari antrean operasional outlet.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleConfirmDeleteOrder}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30"
              >
                {isSubmittingDelete ? (
                  <span>Menghapus...</span>
                ) : (
                  <span>YA, HAPUS PESANAN</span>
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

      {/* Kitchen / Bar Slip Modal */}
      <KitchenSlipModal
        isOpen={isSlipModalOpen}
        onClose={() => {
          setIsSlipModalOpen(false);
          setSelectedOrderForSlip(null);
        }}
        order={selectedOrderForSlip}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOrderDetail(null);
        }}
        order={orders.find((o) => o.id === selectedOrderDetail?.id) || selectedOrderDetail}
      />
    </div>
  );
};
