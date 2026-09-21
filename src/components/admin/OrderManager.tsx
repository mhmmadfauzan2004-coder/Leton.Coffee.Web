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
  Coffee,
  Bell,
  User,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KitchenSlipModal } from './KitchenSlipModal';
import { OrderDetailModal } from './OrderDetailModal';
import { processOrderPointsEarning } from '../../utils/supabaseLoyalty';
import { Sparkles } from 'lucide-react';

// Compact item customization summary helper (Stitch Design)
const getItemCustomizationSummary = (it: any): string => {
  const parts: string[] = [];
  if (it.size && it.size.name) parts.push(it.size.name);
  if (it.topping && it.topping.name && it.topping.name !== 'No Topping') parts.push(it.topping.name);
  if (it.syrup && it.syrup.name && it.syrup.name !== 'No Syrup') parts.push(it.syrup.name);
  if (it.customOptions && Array.isArray(it.customOptions) && it.customOptions.length > 0) {
    it.customOptions.forEach((c: any) => {
      if (c && c.optionName) parts.push(c.optionName);
    });
  }
  if (it.note) {
    parts.push(`Note: ${it.note}`);
  }
  return parts.join(' • ');
};

// Compact relative timestamp helper (Stitch Design)
const getOrderTimestamp = (createdAt: string) => {
  try {
    const d = new Date(createdAt);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    let relStr = '';
    if (diffMins < 1) {
      relStr = '(baru saja)';
    } else if (diffMins < 60) {
      relStr = `(${diffMins}m lalu)`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        relStr = `(${diffHours}j lalu)`;
      }
    }
    return { timeStr, relStr };
  } catch {
    return { timeStr: '', relStr: '' };
  }
};

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


  // Handle status update - Awaits database confirmation before updating UI to prevent optimistic UI discrepancy
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    newPaymentStatus?: PaymentStatus,
    rejectionReason?: string
  ) => {
    try {
      // 1. Direct synchronous update in Supabase & wait for database confirmation
      const success = await updateOrderStatus(orderId, newStatus, newPaymentStatus, rejectionReason);
      if (!success) {
        throw new Error('Gagal memperbarui status di cloud');
      }

      // 2. Only update UI state after database confirms success
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
    } catch (err: any) {
      console.error('[Order Status Update Failed]:', err);
      showToast('Gagal memperbarui status pesanan: ' + (err?.message || 'Koneksi terputus') + '. Perubahan dibatalkan.', 'error');
      throw err;
    }
  };

  // Action: [ TERIMA PESANAN ]
  const handleAcceptOrder = async (order: CustomerOrder) => {
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }
    setUpdatingOrderId(order.id);
    try {
      const nextPayment =
        (order.paymentMethod === 'QRIS' && order.paymentReceiptUrl) || order.paymentStatus === 'PAID'
          ? 'PAID'
          : order.paymentStatus;
      await handleUpdateStatus(order.id, 'ACCEPTED', nextPayment);
      showToast(`Pesanan #${order.orderNumber} diterima! Siap diseduh.`, 'success');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Action: [ MULAI DISEDUH ]
  const handleStartBrewing = async (order: CustomerOrder) => {
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }
    setUpdatingOrderId(order.id);
    try {
      await handleUpdateStatus(order.id, 'PREPARING');
      showToast(`Pesanan #${order.orderNumber} mulai diseduh.`, 'success');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Action: [ SELESAIKAN ]
  const handleCompleteOrder = async (order: CustomerOrder) => {
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }
    setUpdatingOrderId(order.id);
    try {
      const nextPayment =
        order.paymentStatus === 'PAID'
          ? 'PAID'
          : order.paymentMethod === 'TUNAI'
          ? 'PAID'
          : order.paymentStatus;
      await handleUpdateStatus(order.id, 'COMPLETED', nextPayment);
      showToast(`Pesanan #${order.orderNumber} selesai disajikan!`, 'success');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Action 1: [ SIAP DISAJIKAN ]
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

  // Award loyalty points to customer manually
  const [isAwardingPointsId, setIsAwardingPointsId] = useState<string | null>(null);

  const handleAwardPoints = async (order: CustomerOrder) => {
    if (!order) return;
    if (isOutletAdmin && !matchesOutlet(order.outletId, assignedOutletId)) {
      showToast('Akses Ditolak: Anda hanya dapat memproses pesanan di cabang Anda.', 'error');
      return;
    }

    setIsAwardingPointsId(order.id);
    try {
      const res = await processOrderPointsEarning(order);
      if (res.success) {
        showToast(`Poin berhasil diberikan ke customer! (+${res.pointsEarned || 0} poin) 🌟`, 'success');
      } else {
        showToast(res.error || 'Gagal memberikan poin.', 'error');
      }
    } catch (err: any) {
      console.error('[Manual Award Points Error]:', err);
      showToast('Gagal memberikan poin: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsAwardingPointsId(null);
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

      {/* Live Kitchen Pulse & Summary Banner (Stitch Design) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#eef4ff] border border-[#dbe9ff] shadow-[0_2px_8px_rgba(0,99,137,0.05)]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006389] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#006389]"></span>
          </span>
          <span className="text-xs sm:text-sm text-[#041d32] font-bold">
            {isOutletAdmin ? assignedOutletName : 'Barista Bar Dumai - Monitoring Pesanan'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#3e484f] font-medium">
          <span className="text-[#006389] font-bold">{stats.newCount} Baru</span>
          <span>•</span>
          <span>Total: <strong className="text-[#041d32] font-bold">{stats.total} Pesanan</strong></span>
        </div>
      </div>

      {/* Segmented Scrollable Filter Pills (Stitch Design) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" id="orderFilterTabs">
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('ALL')}
          className={`filter-btn flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            selectedStatusFilter === 'ALL'
              ? 'active bg-[#006389] text-white shadow-sm'
              : 'bg-white text-[#3e484f] border border-[#dbe9ff] hover:bg-[#eef4ff]'
          }`}
        >
          Semua <span className="ml-1 opacity-90 text-[11px] font-semibold">({stats.total})</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('NEW')}
          className={`filter-btn flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            selectedStatusFilter === 'NEW'
              ? 'active bg-[#006389] text-white shadow-sm'
              : 'bg-white text-[#3e484f] border border-[#dbe9ff] hover:bg-[#eef4ff]'
          }`}
        >
          Baru <span className="ml-1 text-[#006389] font-bold text-[11px]">({stats.newCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('PREPARING')}
          className={`filter-btn flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            selectedStatusFilter === 'PREPARING'
              ? 'active bg-[#006389] text-white shadow-sm'
              : 'bg-white text-[#3e484f] border border-[#dbe9ff] hover:bg-[#eef4ff]'
          }`}
        >
          Proses <span className="ml-1 text-[#825100] font-bold text-[11px]">({stats.preparingCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('READY')}
          className={`filter-btn flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            selectedStatusFilter === 'READY'
              ? 'active bg-[#006389] text-white shadow-sm'
              : 'bg-white text-[#3e484f] border border-[#dbe9ff] hover:bg-[#eef4ff]'
          }`}
        >
          Siap <span className="ml-1 text-[#525e79] font-bold text-[11px]">({orders.filter((o) => o.orderStatus === 'READY').length})</span>
        </button>
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
        <div
          id="orderCardsContainer"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-8"
        >
          {filteredOrders.map((order) => {
            const isUpdating = updatingOrderId === order.id;
            const { timeStr, relStr } = getOrderTimestamp(order.createdAt);

            return (
              <motion.div
                key={order.id}
                id={`order-${order.orderNumber}`}
                data-status={order.orderStatus.toLowerCase()}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedOrderDetail(order);
                  setIsDetailModalOpen(true);
                }}
                className={`order-card group flex flex-col p-3.5 rounded-xl bg-white shadow-[0_2px_10px_rgba(0,99,137,0.06)] border transition-all duration-200 cursor-pointer hover:shadow-md hover:border-[#006389]/30 ${
                  order.paymentStatus === 'WAITING VERIFICATION'
                    ? 'border-amber-300 ring-1 ring-amber-400/30'
                    : order.orderStatus === 'NEW'
                    ? 'border-[#006389]/30 ring-1 ring-[#006389]/20'
                    : 'border-[#e4efff]'
                }`}
              >
                {/* 1. Top Row: Order Number + Status Badge + Timestamp */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-[15px] sm:text-base text-[#041d32] tracking-tight truncate">
                      {order.orderNumber}
                    </span>

                    {/* Quick Kitchen Slip Print Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderForSlip(order);
                        setIsSlipModalOpen(true);
                      }}
                      title="Cetak Slip Dapur"
                      className="p-1 rounded-md text-[#006389] hover:bg-[#eef4ff] transition-colors cursor-pointer shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Status Badge (Stitch Design) */}
                    {order.orderStatus === 'NEW' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#c6e7ff] text-[#004c6b] shrink-0">
                        BARU
                      </span>
                    ) : order.orderStatus === 'ACCEPTED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#dbe9ff] text-[#004c6b] flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>DITERIMA</span>
                      </span>
                    ) : order.orderStatus === 'PREPARING' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ffddb8] text-[#653e00] flex items-center gap-1 shrink-0">
                        <Coffee className="w-3 h-3 animate-pulse" />
                        <span>DISEDUH</span>
                      </span>
                    ) : order.orderStatus === 'READY' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#d7e2ff] text-[#0e1b32] flex items-center gap-1 shrink-0">
                        <Bell className="w-3 h-3" />
                        <span>SIAP</span>
                      </span>
                    ) : order.orderStatus === 'COMPLETED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#eef4ff] text-[#525e79] flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-[#006389]" />
                        <span>SELESAI</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ffdad6] text-[#93000a] flex items-center gap-1 shrink-0">
                        <X className="w-3 h-3" />
                        <span>DITOLAK</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[#3e484f] text-[11px] shrink-0 font-mono">
                    <Clock className="w-3 h-3 text-[#6e7880]" />
                    <span>
                      {timeStr} {relStr && <span className="text-[#006389] font-medium">{relStr}</span>}
                    </span>
                  </div>
                </div>

                {/* 2. Customer & Dining Context Bar */}
                <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-[#eef4ff] my-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-[#006389] shrink-0" />
                    <span className="text-xs text-[#041d32] font-bold truncate">
                      {order.customerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#007dad] text-xs font-bold shrink-0">
                    {order.orderType === 'DINE IN' ? (
                      <>
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Dine In • Meja {order.tableNumber || '-'}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5 text-[#525e79]" />
                        <span className="text-[#525e79]">Take Away</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 3. Compact Menu Item Specs */}
                <div className="flex flex-col gap-1 py-1">
                  {(order.items || []).slice(0, 3).map((it, idx) => {
                    const customSummary = getItemCustomizationSummary(it);
                    return (
                      <div key={idx} className="flex items-start gap-1.5 text-[#041d32] text-xs">
                        <span
                          className={`font-bold min-w-[20px] shrink-0 ${
                            order.orderStatus === 'PREPARING'
                              ? 'text-[#825100]'
                              : order.orderStatus === 'READY'
                              ? 'text-[#525e79]'
                              : 'text-[#006389]'
                          }`}
                        >
                          {it.quantity}x
                        </span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-[#041d32] leading-snug truncate">
                            {it.name}
                          </span>
                          {customSummary ? (
                            <span className="text-[11px] text-[#3e484f] truncate" title={customSummary}>
                              {customSummary}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {(order.items || []).length > 3 && (
                    <div className="text-[11px] text-[#006389] font-medium pl-6 pt-0.5">
                      + {(order.items || []).length - 3} menu lainnya...
                    </div>
                  )}
                </div>

                {/* 4. Total & Payment Verification Status */}
                <div className="flex items-center justify-between pt-2 pb-2.5 mt-1 border-t border-[#f1f5f9]">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[#6e7880] font-bold">
                      Total Pembayaran
                    </span>
                    <span className="text-sm sm:text-[15px] font-extrabold text-[#041d32]">
                      {formatRupiah(order.totalAmount)}
                    </span>
                  </div>

                  {/* Payment Verification Status Badge */}
                  {order.paymentMethod === 'QRIS' ? (
                    order.paymentStatus === 'PAID' ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#dbe9ff] text-[#006389] text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#006389]" />
                        <span>QRIS • Lunas</span>
                      </div>
                    ) : order.paymentStatus === 'PAYMENT REJECTED' || order.paymentStatus === 'REJECTED' ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#ffdad6] text-[#93000a] text-[11px] font-bold">
                        <X className="w-3.5 h-3.5" />
                        <span>QRIS • Ditolak</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#ffddb8] text-[#2a1700] text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#825100] animate-pulse"></span>
                        <span>QRIS • Menunggu Cek</span>
                      </div>
                    )
                  ) : (
                    // TUNAI
                    order.paymentStatus === 'PAID' ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#dbe9ff] text-[#041d32] text-[11px] font-bold">
                        <Banknote className="w-3.5 h-3.5 text-[#006389]" />
                        <span>Tunai • Lunas</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#eef4ff] text-[#006389] text-[11px] font-bold">
                        <Banknote className="w-3.5 h-3.5 text-[#006389]" />
                        <span>Tunai • Kasir</span>
                      </div>
                    )
                  )}
                </div>

                {/* 5. Compact Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#f1f5f9]">
                  {/* Left: Detail button & tools */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderDetail(order);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#c6d7e8] bg-white text-[#041d32] text-xs font-bold hover:bg-[#eef4ff] transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#52606d]" />
                      <span>Detail</span>
                    </button>

                    {/* Delete button (small icon) */}
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteDialog(order);
                      }}
                      title="Hapus Pesanan"
                      className="p-1.5 rounded-lg border border-[#c6d7e8] bg-white text-[#52606d] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/30 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Member points if eligible */}
                    {order.customerId && (
                      <button
                        type="button"
                        disabled={isAwardingPointsId === order.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAwardPoints(order);
                        }}
                        title="Beri Poin Loyalty"
                        className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right: Operational Barista / Admin Workflow Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Tolak Button (Available when order can still be rejected) */}
                    {order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'COMPLETED' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRejectDialog(order);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#ffdad6] bg-[#fff8f7] text-[#ba1a1a] text-xs font-bold hover:bg-[#ffdad6] transition-colors cursor-pointer shrink-0"
                      >
                        Tolak
                      </button>
                    )}

                    {/* Primary Status Progression Button */}
                    {order.orderStatus === 'NEW' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptOrder(order);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#006389] text-white text-xs font-bold hover:bg-[#004f6e] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Terima</span>
                      </button>
                    ) : order.orderStatus === 'ACCEPTED' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartBrewing(order);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#006389] text-white text-xs font-bold hover:bg-[#004f6e] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1 shrink-0"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        <span>Mulai Diseduh</span>
                      </button>
                    ) : order.orderStatus === 'PREPARING' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkReady(order);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#006389] text-white text-xs font-bold hover:bg-[#004f6e] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1 shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Siap</span>
                      </button>
                    ) : order.orderStatus === 'READY' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteOrder(order);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#041d32] text-white text-xs font-bold hover:bg-[#1a3349] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Selesai</span>
                      </button>
                    ) : null}
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
