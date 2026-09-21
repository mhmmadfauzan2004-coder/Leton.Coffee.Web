import React, { useState, useEffect } from 'react';
import { CustomerProfile, CustomerOrder } from '../../../types';
import { getSupabase, updateCustomerProfile, getCustomerOrdersRpc, getCustomerSessionToken } from '../../../utils/supabase';
import {
  User,
  Calendar,
  History,
  Save,
  LogOut,
  RefreshCw,
  Clock,
  Coffee,
  AlertCircle,
  CheckCircle,
  Search,
  Gift,
  Award,
  Coins,
  ArrowRight,
  Check,
  QrCode,
  X,
} from 'lucide-react';
import {
  getCustomerLoyalty,
  getLoyaltyRewards,
  getRewardRedemptions,
  getLoyaltyTransactions,
  redeemReward,
  CustomerLoyaltyData,
  LoyaltyReward,
  PointTransaction,
  RewardRedemption,
} from '../../../utils/supabaseLoyalty';

interface CustomerProfileTabProps {
  profile: CustomerProfile;
  onLogout: () => void;
  onProfileUpdate: (updated: Partial<CustomerProfile>) => void;
}

export default function CustomerProfileTab({ profile, onLogout, onProfileUpdate }: CustomerProfileTabProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Loyalty states
  const [activeSection, setActiveSection] = useState<'orders' | 'loyalty'>('orders');
  const [loyaltyData, setLoyaltyData] = useState<CustomerLoyaltyData | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [vouchers, setVouchers] = useState<RewardRedemption[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  const [redeemedVoucher, setRedeemedVoucher] = useState<RewardRedemption | null>(null);

  // Form Edit Profile
  const [namaLengkap, setNamaLengkap] = useState(profile?.namaLengkap || '');
  const [tanggalLahir, setTanggalLahir] = useState(profile?.tanggalLahir || '');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all loyalty data for the logged-in customer
  const loadLoyaltyData = async () => {
    const targetUserId = profile?.userId || profile?.id;
    const targetPhone = profile?.nomorHp;
    if (!targetUserId && !targetPhone) return;
    setLoadingLoyalty(true);
    try {
      const custLoyalty = await getCustomerLoyalty(targetUserId, targetPhone);
      setLoyaltyData(custLoyalty);

      const rewardsRes = await getLoyaltyRewards();
      // Only active rewards
      setRewards(rewardsRes.rewards.filter((r) => r.isActive));

      const vchList = await getRewardRedemptions(targetUserId);
      setVouchers(vchList);

      const txList = await getLoyaltyTransactions(targetUserId, targetPhone);
      setTransactions(txList);
    } catch (err) {
      console.error('Error loading loyalty data:', err);
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const handleRedeem = async (reward: LoyaltyReward) => {
    const targetUserId = profile?.userId || profile?.id;
    if (!targetUserId || !loyaltyData) return;

    if (loyaltyData.pointsBalance < reward.pointsRequired) {
      alert('Poin Anda tidak mencukupi untuk ditukar dengan reward ini.');
      return;
    }

    if (!window.confirm(`Konfirmasi penukaran ${reward.pointsRequired} Poin untuk voucher "${reward.name}"?`)) {
      return;
    }

    setRedeemingRewardId(reward.id);
    try {
      const res = await redeemReward(targetUserId, reward);
      if (res.success && res.redemptionId) {
        await loadLoyaltyData();
        // Open Success Voucher Display Modal
        const activeVouchers = await getRewardRedemptions(targetUserId);
        const newlyCreated = activeVouchers.find((v) => v.id === res.redemptionId);
        if (newlyCreated) {
          setRedeemedVoucher(newlyCreated);
        } else {
          setRedeemedVoucher({
            id: res.redemptionId,
            customerId: targetUserId,
            rewardId: reward.id,
            rewardName: reward.name,
            rewardType: reward.rewardType,
            rewardValue: reward.rewardValue,
            pointsSpent: reward.pointsRequired,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        alert(res.error || 'Terjadi kesalahan saat menukarkan poin.');
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal menukarkan poin.');
    } finally {
      setRedeemingRewardId(null);
    }
  };

  // Fetch customer orders from Supabase (Primary public.orders table / RPC)
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const client = getSupabase();
      let ordersData: any[] | null = null;

      // 1. Try secure session RPC
      const rpcResult = await getCustomerOrdersRpc();
      if (rpcResult.success && Array.isArray(rpcResult.orders)) {
        ordersData = rpcResult.orders;
      }

      // 2. Direct query fallback using customer_id
      if (!ordersData) {
        const { data, error } = await client
          .from('orders')
          .select('*')
          .eq('customer_id', profile.userId || profile.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          ordersData = data;
        } else if (error) {
          console.warn('Error fetching customer orders:', error.message);
        }
      }

      if (ordersData) {
        // Map database table fields to CamelCase TypeScript CustomerOrder properties
        const mappedOrders: CustomerOrder[] = ordersData.map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number || o.orderNumber || 'LTN-????',
          outletId: o.outlet_id || o.outletId || '',
          outletName: o.outlet_name || o.outletName || '',
          customerName: o.customer_name || o.customerName || '',
          customerPhone: o.customer_phone || o.customerPhone || '',
          customerId: o.customer_id || o.customerId,
          userId: o.user_id || o.userId,
          orderType: o.order_type || o.orderType || 'DINE IN',
          tableNumber: o.table_number || o.tableNumber || '',
          items: Array.isArray(o.items) ? o.items : [],
          totalAmount: Number(o.total_amount || o.totalAmount || 0),
          paymentMethod: o.payment_method || o.paymentMethod || 'QRIS',
          paymentStatus: o.payment_status || o.paymentStatus || 'WAITING PAYMENT',
          paymentReceiptUrl: o.payment_receipt_url || o.paymentReceiptUrl,
          paymentReceiptPath: o.payment_receipt_path || o.paymentReceiptPath,
          paymentProofPath: o.payment_proof_path || o.paymentProofPath,
          rejectionReason: o.rejection_reason || o.rejectionReason,
          orderStatus: o.order_status || o.orderStatus || 'NEW',
          customerNote: o.customer_note || o.customerNote || '',
          createdAt: o.created_at || o.createdAt,
          updatedAt: o.updated_at || o.updatedAt,
        }));
        setOrders(mappedOrders);
      }
    } catch (err) {
      console.error('Exception loading orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadLoyaltyData();

    const targetUserId = profile?.userId || profile?.id;
    if (!targetUserId) return;

    try {
      const client = getSupabase();
      const channel = client
        .channel(`customer_orders_realtime_${targetUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${targetUserId}`,
          },
          () => {
            loadOrders();
            loadLoyaltyData();
          }
        )
        .subscribe();

      return () => {
        try {
          client.removeChannel(channel);
        } catch (err) {
          console.warn('Error removing channel:', err);
        }
      };
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  }, [profile?.userId, profile?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!namaLengkap.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!tanggalLahir) {
      setErrorMsg('Tanggal Lahir wajib diisi.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateCustomerProfile(namaLengkap, tanggalLahir);
      if (res.success) {
        setSuccessMsg('Profil berhasil diperbarui!');
        onProfileUpdate({
          namaLengkap: namaLengkap.trim(),
          tanggalLahir: tanggalLahir,
        });
      } else {
        setErrorMsg(res.error || 'Gagal memperbarui profil.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSavingProfile(false);
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Pesanan Baru</span>;
      case 'ACCEPTED':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Diterima</span>;
      case 'PREPARING':
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Sedang Dibuat</span>;
      case 'READY':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Siap Diambil</span>;
      case 'COMPLETED':
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Selesai</span>;
      case 'CANCELLED':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Dibatalkan</span>;
      default:
        return <span className="bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full text-xs font-bold uppercase">{status}</span>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const cleanStatus = status.replace('_', ' ');
    switch (status) {
      case 'PAID':
        return <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Lunas</span>;
      case 'WAITING PAYMENT':
      case 'WAITING_PAYMENT':
        return <span className="text-amber-700 bg-amber-50 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Belum Bayar</span>;
      case 'WAITING VERIFICATION':
      case 'WAITING_VERIFICATION':
        return <span className="text-blue-700 bg-blue-50 border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Menunggu Verifikasi</span>;
      case 'PAY AT STORE':
        return <span className="text-cyan-700 bg-cyan-50 border border-cyan-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Bayar Di Toko</span>;
      case 'PAYMENT REJECTED':
      case 'REJECTED':
        return <span className="text-rose-700 bg-rose-50 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">Bukti Ditolak</span>;
      default:
        return <span className="text-gray-700 bg-gray-50 border border-gray-200 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase">{cleanStatus}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const num = o.orderNumber.toLowerCase();
    const outlet = o.outletName.toLowerCase();
    const query = searchQuery.toLowerCase();
    return num.includes(query) || outlet.includes(query);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. KARTU PROFIL, MEMBER CARD & EDIT DATA */}
      <div className="lg:col-span-1 space-y-4">
        {/* PREMIUM GOLD LETON COFFEE MEMBER CARD */}
        <div className="bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] rounded-2xl p-5 text-white shadow-md relative overflow-hidden border border-slate-800">
          {/* Accent design circles */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#C39A6B]/10 rounded-full blur-xl" />
          <div className="absolute -left-6 -top-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />

          <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
            <div>
              <span className="block text-[9px] font-mono tracking-widest text-[#C39A6B] uppercase font-bold">
                Leton Coffee
              </span>
              <span className="text-xs font-semibold text-slate-300">GOLD MEMBERSHIP</span>
            </div>
            <Award className="w-6 h-6 text-[#C39A6B]" />
          </div>

          <div className="space-y-4">
            <div>
              <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                Saldo Poin Aktif
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-display font-black text-amber-500">
                  {loyaltyData ? loyaltyData.pointsBalance : 0}
                </span>
                <span className="text-xs font-bold text-slate-400 font-mono uppercase">Poin</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-3 text-xs">
              <div>
                <span className="block text-[9px] text-slate-400 font-mono uppercase">
                  Total Diperoleh
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  +{loyaltyData ? loyaltyData.totalPointsEarned : 0} Pts
                </span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 font-mono uppercase">
                  Telah Ditukar
                </span>
                <span className="font-bold text-rose-400 font-mono">
                  -{loyaltyData ? loyaltyData.totalPointsRedeemed : 0} Pts
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveSection('loyalty');
                const element = document.getElementById('customer-tab-content-card');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full mt-1.5 py-2 px-3 bg-[#C39A6B] hover:bg-[#B38A5B] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>TUKAR POINT REWARD</span>
            </button>
          </div>
        </div>

        {/* PROFILE EDIT FORM */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-sm">
          <div className="flex items-center gap-3.5 border-b border-[#F2F4F7] pb-4 mb-4">
            <div className="w-12 h-12 bg-[#C39A6B]/10 rounded-full flex items-center justify-center text-[#C39A6B]">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#172033]">{profile.namaLengkap}</h4>
              <p className="text-xs text-[#667085] mt-0.5">Member Leton Coffee</p>
            </div>
          </div>

          <div className="space-y-3.5 mb-5 text-sm text-[#475467]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#667085]">Nomor HP:</span>
              <span className="font-semibold text-[#172033]">{profile.nomorHp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#667085]">Tanggal Lahir:</span>
              <span className="font-semibold text-[#172033]">
                {profile?.tanggalLahir && !isNaN(new Date(profile.tanggalLahir).getTime())
                  ? new Date(profile.tanggalLahir).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : profile?.tanggalLahir || '-'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 border-t border-[#F2F4F7] pt-4">
            <h5 className="text-xs font-bold text-[#172033] uppercase tracking-wider mb-2">Edit Profil</h5>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Tanggal Lahir</label>
              <input
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#C39A6B] hover:bg-[#B38A5B] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center justify-center gap-1.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2. DUAL TAB BAR: ORDERS HISTORY vs LOYALTY PORTAL */}
      <div id="customer-tab-content-card" className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-sm min-h-[450px] flex flex-col overflow-hidden">
          {/* Tab selectors at the top */}
          <div className="flex bg-[#F8FBFF] border-b border-[#F2F4F7] px-4 pt-3.5 gap-2 shrink-0">
            <button
              onClick={() => { setActiveSection('orders'); setSearchQuery(''); }}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase transition-all border-b-2 tracking-wider ${
                activeSection === 'orders'
                  ? 'border-[#C39A6B] text-[#C39A6B] bg-white'
                  : 'border-transparent text-[#667085] hover:text-[#172033]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                <span>Riwayat Pesanan ({orders.length})</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveSection('loyalty'); setSearchQuery(''); }}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase transition-all border-b-2 tracking-wider ${
                activeSection === 'loyalty'
                  ? 'border-[#C39A6B] text-[#C39A6B] bg-white'
                  : 'border-transparent text-[#667085] hover:text-[#172033]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                <span>Loyalty & Reward Poin</span>
              </div>
            </button>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            {/* SUB-SECTION 1: ORDERS */}
            {activeSection === 'orders' && (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                  <h4 className="font-bold text-xs sm:text-sm text-[#172033] uppercase tracking-wider">DAFTAR TRANSAKSI BELANJA</h4>
                  <button
                    onClick={loadOrders}
                    disabled={loadingOrders}
                    className="flex items-center gap-1.5 text-[#C39A6B] hover:text-[#B38A5B] font-semibold text-xs py-1 px-2.5 rounded-lg border border-[#E4E7EC] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {/* Search bar */}
                <div className="relative mb-4 shrink-0">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]" />
                  <input
                    type="text"
                    placeholder="Cari berdasarkan No. Pesanan atau Outlet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#C39A6B] transition-all"
                  />
                </div>

                {loadingOrders && orders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-[#98A2B3]">
                    <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">Memuat pesanan...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#172033]">Belum Ada Pesanan</p>
                    <p className="text-xs text-[#667085] mt-1 max-w-[280px] mx-auto">
                      {searchQuery ? 'Tidak ada pesanan yang sesuai dengan kata kunci pencarian.' : 'Ayo buat pesanan kopi pertamamu sekarang!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-xl border border-[#F2F4F7] hover:border-[#E4E7EC] bg-[#FCFCFD] transition-all space-y-3 shadow-[0_1px_4px_rgba(0,0,0,0.01)]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F2F4F7] pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-[#172033]">{order.orderNumber}</span>
                              <span className="text-[10px] text-gray-400">•</span>
                              <span className="text-xs font-semibold text-[#475467]">{order.outletName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#667085] mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(order.createdAt)}</span>
                              <span>•</span>
                              <span>{order.orderType}</span>
                              {order.tableNumber && (
                                <>
                                  <span>•</span>
                                  <span>Meja {order.tableNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            {getPaymentStatusBadge(order.paymentStatus)}
                            {getOrderStatusBadge(order.orderStatus)}
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="space-y-1.5">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs">
                              <div className="text-[#475467]">
                                <span className="font-bold text-[#172033]">{it.quantity}x</span> {it.name}
                                {(it.size || it.topping || it.syrup) && (
                                  <span className="text-[10px] text-gray-400 block mt-0.5 ml-4">
                                    {[it.size?.name, it.topping?.name, it.syrup?.name].filter(Boolean).join(', ')}
                                  </span>
                                )}
                                {it.note && <span className="text-[10px] text-red-500 italic block mt-0.5 ml-4">catatan: {it.note}</span>}
                              </div>
                              <span className="font-semibold text-[#172033]">
                                Rp {((it.unitPrice || it.price) * it.quantity).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Rejection Message if any */}
                        {order.rejectionReason && (
                          <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs leading-relaxed">
                            <strong>Alasan Penolakan:</strong> {order.rejectionReason}
                          </div>
                        )}

                        {/* Total price section */}
                        <div className="flex justify-between items-center border-t border-[#F2F4F7] pt-2.5 text-xs">
                          <span className="text-[#667085] font-medium">Metode Pembayaran: <strong className="text-[#475467]">{order.paymentMethod}</strong></span>
                          <span className="font-bold text-sm text-[#C39A6B]">
                            Total: Rp {order.totalAmount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* SUB-SECTION 2: LOYALTY CENTER */}
            {activeSection === 'loyalty' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-[#F2F4F7] pb-3 shrink-0">
                  <h4 className="font-bold text-xs sm:text-sm text-[#172033] uppercase tracking-wider">
                    REWARDS & VOUCHER UNTUK ANDA
                  </h4>
                  <button
                    onClick={loadLoyaltyData}
                    disabled={loadingLoyalty}
                    className="flex items-center gap-1.5 text-[#C39A6B] hover:text-[#B38A5B] font-semibold text-xs py-1 px-2.5 rounded-lg border border-[#E4E7EC] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLoyalty ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {loadingLoyalty && rewards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#98A2B3]">
                    <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-xs font-semibold">Menyinkronkan katalog hadiah...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* VOUCHER SAYA SECTION (IF REDEEMED ALREADY) */}
                    {vouchers.filter((v) => v.status === 'ACTIVE').length > 0 && (
                      <div className="space-y-3 bg-[#F8FBFF] p-4 border border-[#E0F2FE] rounded-2xl">
                        <span className="block text-[11px] font-bold text-[#0284C7] uppercase tracking-widest flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Voucher Aktif Anda ({vouchers.filter((v) => v.status === 'ACTIVE').length})</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {vouchers
                            .filter((v) => v.status === 'ACTIVE')
                            .map((v) => (
                              <div
                                key={v.id}
                                onClick={() => setRedeemedVoucher(v)}
                                className="bg-white border-2 border-dashed border-amber-300 rounded-xl p-3.5 flex justify-between items-center cursor-pointer hover:border-[#C39A6B] transition-all shadow-sm"
                              >
                                <div className="space-y-1">
                                  <span className="block text-xs font-black text-[#172033]">{v.rewardName}</span>
                                  <span className="block text-[10px] font-mono text-amber-600 font-bold uppercase tracking-wider">{v.id}</span>
                                </div>
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold uppercase shrink-0 border border-amber-100">
                                  Gunakan
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* REWARDS CATALOG */}
                    <div className="space-y-3">
                      <span className="block text-xs font-bold text-[#172033] uppercase tracking-wider">Klaim Hadiah</span>
                      {rewards.length === 0 ? (
                        <p className="text-xs text-slate-400">Tidak ada reward yang tersedia saat ini.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {rewards.map((reward) => {
                            const isEligible = (loyaltyData?.pointsBalance ?? 0) >= reward.pointsRequired;
                            return (
                              <div
                                key={reward.id}
                                className="p-4 bg-white border border-[#E4E7EC] rounded-2xl flex flex-col justify-between hover:border-[#C39A6B]/50 transition-colors relative"
                              >
                                <div className="absolute right-3.5 top-3.5 px-2.5 py-1 bg-amber-500 text-white font-mono font-bold text-[10px] rounded-lg">
                                  {reward.pointsRequired} Pts
                                </div>

                                <div className="space-y-1.5 pr-14">
                                  <h5 className="font-bold text-[#172033] text-sm leading-tight">{reward.name}</h5>
                                  <p className="text-[11px] text-[#667085] leading-normal">{reward.description || 'Klaim penukaran poin Anda.'}</p>
                                </div>

                                <button
                                  onClick={() => handleRedeem(reward)}
                                  disabled={!isEligible || redeemingRewardId === reward.id}
                                  className={`w-full mt-4 py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                    isEligible
                                      ? 'bg-[#C39A6B] hover:bg-[#B38A5B] text-white shadow-sm'
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  {redeemingRewardId === reward.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : isEligible ? (
                                    <span>Tukarkan {reward.pointsRequired} Poin</span>
                                  ) : (
                                    <span>Poin Tidak Cukup</span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* LOGS AND TRANSACTIONS HISTORY TABLE */}
                    <div className="space-y-3 pt-3 border-t border-[#F2F4F7]">
                      <span className="block text-xs font-bold text-[#172033] uppercase tracking-wider">
                        Riwayat Point (Poin Ledger)
                      </span>
                      {transactions.length === 0 ? (
                        <p className="text-xs text-slate-400">Belum ada mutasi poin.</p>
                      ) : (
                        <div className="border border-[#F2F4F7] rounded-xl overflow-hidden text-[11px]">
                          <div className="divide-y divide-[#F2F4F7]">
                            {transactions.slice(0, 5).map((t) => (
                              <div key={t.id} className="p-3 bg-slate-50/50 flex justify-between items-center">
                                <div className="space-y-0.5">
                                  <span className="block font-semibold text-[#172033]">{t.reason}</span>
                                  <span className="block text-[10px] text-slate-400">
                                    {new Date(t.createdAt).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <span className={`font-mono font-black text-xs ${t.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {t.points > 0 ? `+${t.points}` : t.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 3: SUCCESSFUL REDEEM VOUCHER SHOWCASE */}
      {redeemedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#F2F4F7] animate-scaleUp text-center">
            <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white relative">
              <button
                onClick={() => setRedeemedVoucher(null)}
                className="absolute right-4 top-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-xl"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <Award className="w-12 h-12 text-white mx-auto mb-2" />
              <h3 className="font-display font-black text-lg uppercase tracking-wider">REDEEM SUKSES!</h3>
              <p className="text-[11px] text-white/90">Voucher baru Anda telah berhasil dicairkan.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Jenis Voucher</span>
                <span className="block text-base font-black text-[#172033]">{redeemedVoucher.rewardName}</span>
              </div>

              {/* Coupon style representation */}
              <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl space-y-2 relative overflow-hidden">
                <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-widest">KODE KUPON REWARD:</span>
                <span className="block font-mono font-black text-xl text-slate-800 tracking-wider">
                  {redeemedVoucher.id}
                </span>
                <div className="flex justify-center pt-2">
                  <div className="h-6 w-32 border-l border-r border-slate-400/50 flex gap-1 justify-center">
                    {/* Simulated barcode */}
                    {[...Array(14)].map((_, i) => (
                      <div key={i} className={`h-full ${i % 3 === 0 ? 'w-0.5' : i % 2 === 0 ? 'w-[1.5px]' : 'w-[1px]'} bg-slate-700`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                Salin kode kupon di atas atau tunjukkan layar ini ke kasir/barista Leton Coffee untuk mendapatkan keuntungan langsung di outlet!
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(redeemedVoucher.id);
                  alert('Kode kupon berhasil disalin!');
                  setRedeemedVoucher(null);
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-colors"
              >
                Salin Kode & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
