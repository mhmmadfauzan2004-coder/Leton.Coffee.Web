import React, { useState, useEffect } from 'react';
import { CustomerProfile, CustomerOrder } from '../../../types';
import { getSupabase, updateCustomerProfile, getCustomerOrdersRpc, getCustomerSessionToken } from '../../../utils/supabase';
import { User, Calendar, History, Save, LogOut, RefreshCw, Clock, Coffee, AlertCircle, CheckCircle, Search } from 'lucide-react';

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

  // Form Edit Profile
  const [namaLengkap, setNamaLengkap] = useState(profile?.namaLengkap || '');
  const [tanggalLahir, setTanggalLahir] = useState(profile?.tanggalLahir || '');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 1. KARTU PROFIL & EDIT DATA */}
      <div className="md:col-span-1 space-y-4">
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

      {/* 2. DAFTAR RIWAYAT PESANAN */}
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F2F4F7] pb-4 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#C39A6B]" />
              <h4 className="font-bold text-[#172033]">Riwayat Pesanan Anda</h4>
            </div>
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
          <div className="relative mb-4">
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
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl border border-[#F2F4F7] hover:border-[#E4E7EC] bg-[#FCFCFD] transition-all space-y-3"
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
                          {it.note && <span className="text-[10px] text-red-500 italic block ml-4">catatan: {it.note}</span>}
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
        </div>
      </div>
    </div>
  );
}
