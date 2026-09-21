import React, { useState, useEffect, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  fetchRegisteredCustomers,
  subscribeToCustomersRealtime,
  deleteRegisteredCustomer,
  RegisteredCustomer,
} from '../../utils/supabaseCustomers';
import { fetchCustomerOrdersForAdmin } from '../../utils/supabaseOrders';
import { CustomerOrder } from '../../types';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Calendar,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Radio,
  MessageCircle,
  ShoppingBag,
  Clock,
  X,
  ChevronRight,
  Receipt,
  Store,
  Award,
  Trash2,
} from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const { auth, isRealtimeConnected } = useContent();
  const isSuperAdmin = auth.role === 'super_admin';

  const [customers, setCustomers] = useState<RegisteredCustomer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Customer Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<RegisteredCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // Confirm delete modal state & success toast
  const [confirmingCustomer, setConfirmingCustomer] = useState<RegisteredCustomer | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete customer handler (triggers confirmation dialog)
  const handleDeleteCustomer = (customer: RegisteredCustomer) => {
    setConfirmingCustomer(customer);
  };

  // Execute permanent delete in Supabase
  const handleExecuteDelete = async () => {
    if (!confirmingCustomer) return;

    const customerId = confirmingCustomer.id;
    setDeletingId(customerId);
    try {
      const result = await deleteRegisteredCustomer(customerId, auth.role);
      if (result.success) {
        // 1. Remove member from local list immediately
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
        // 2. Close detail modal if open for this customer
        if (selectedCustomer?.id === customerId) {
          setSelectedCustomer(null);
        }
        // 3. Close confirmation modal
        setConfirmingCustomer(null);
        // 4. Show success toast
        setSuccessToast('Member berhasil dihapus');
        setTimeout(() => setSuccessToast(null), 3500);
        // 5. Re-fetch customer data to ensure sync with source of truth
        await loadCustomers();
      } else {
        console.error('[CustomerManager] Gagal menghapus:', result);
        alert(result.error || 'Gagal menghapus member dari database.');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan sistem saat menghapus member.');
    } finally {
      setDeletingId(null);
    }
  };

  // Load customer data directly from Supabase
  const loadCustomers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchRegisteredCustomers(auth.role);
      setCustomers(data);
    } catch (err: any) {
      console.error('[CustomerManager] Gagal memuat data customer:', err);
      setErrorMessage(err?.message || 'Gagal menyinkronkan data customer dari database Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;

    loadCustomers();

    // Setup realtime subscription to public.customers table
    const unsubscribe = subscribeToCustomersRealtime((updatedList) => {
      setCustomers(updatedList);
    }, auth.role);

    return () => {
      unsubscribe();
    };
  }, [isSuperAdmin, auth.role]);

  // Copy phone number helper
  const handleCopyPhone = (id: string, phone: string) => {
    if (!phone || phone === '-') return;
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => {
      setCopiedPhoneId(null);
    }, 2000);
  };

  // Open member detail modal & fetch order history
  const handleOpenCustomerDetail = async (customer: RegisteredCustomer) => {
    setSelectedCustomer(customer);
    setIsLoadingOrders(true);
    try {
      const orders = await fetchCustomerOrdersForAdmin(
        customer.id,
        customer.nomorHp,
        customer.namaLengkap
      );
      setCustomerOrders(orders);
    } catch (err) {
      console.warn('[handleOpenCustomerDetail] Error:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Format date helper (Indonesian locale)
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  // Filter customers by Search Query (Nama atau Nomor HP)
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase().trim();
    const cleanNumQuery = query.replace(/[^0-9]/g, '');

    return customers.filter((customer) => {
      const nameMatch = customer.namaLengkap.toLowerCase().includes(query);
      const rawPhone = customer.nomorHp.toLowerCase();
      const cleanPhone = customer.nomorHp.replace(/[^0-9]/g, '');

      const phoneMatch =
        rawPhone.includes(query) ||
        (cleanNumQuery.length > 0 && cleanPhone.includes(cleanNumQuery));

      return nameMatch || phoneMatch;
    });
  }, [customers, searchQuery]);

  // Restrict access if not Super Admin / Admin Pusat
  if (!isSuperAdmin) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-[#E0F2FE] text-center max-w-xl mx-auto shadow-sm my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="font-display font-black text-xl text-[#172033] uppercase">
          Akses Terbatas
        </h2>
        <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
          Halaman <strong>DATA CUSTOMER</strong> hanya dapat diakses oleh Super Admin / Admin Pusat Leton HQ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* HEADER SECTION                                       */}
      {/* ---------------------------------------------------- */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E0F2FE] text-[#0284C7] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ADMIN PUSAT (SUPER ADMIN)</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-[#172033] tracking-tight uppercase">
              DATA CUSTOMER
            </h1>
            <p className="text-[#64748B] text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Daftar seluruh pelanggan yang telah mendaftar di sistem Leton Coffee. Data tersinkronisasi langsung secara realtime dari database Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Realtime Live Sync Badge */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#F0F7FF] border border-[#E0F2FE] flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-[11px] font-mono font-bold text-[#172033] uppercase">
                {isRealtimeConnected ? 'REALTIME LIVE' : 'SYNC POLLING'}
              </span>
            </div>

            {/* Total Count Badge */}
            <div className="px-4 py-2.5 rounded-2xl bg-[#F0F7FF] border border-[#E0F2FE] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#0284C7] text-white flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#64748B] uppercase font-bold block">
                  Total Customer
                </span>
                <span className="font-display font-black text-lg text-[#172033] leading-none">
                  {customers.length}
                </span>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadCustomers}
              disabled={isLoading}
              className="p-3 rounded-2xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              title="Refresh Data Customer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={loadCustomers}
            className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-800 font-bold hover:bg-rose-50 transition-colors uppercase tracking-wider text-[10px] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SEARCH BAR & FILTER CONTROLS                         */}
      {/* ---------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E0F2FE] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau nomor HP customer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] text-xs font-sans text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7] focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B] hover:text-[#172033] px-1"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto text-xs text-[#64748B] font-mono">
          <span>
            Menampilkan <strong className="text-[#172033]">{filteredCustomers.length}</strong> dari {customers.length} customer
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CUSTOMER LIST / TABLE VIEW                           */}
      {/* ---------------------------------------------------- */}
      {isLoading && customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#E0F2FE] shadow-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0284C7] mx-auto mb-3" />
          <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">
            Memuat Data Customer dari Supabase...
          </p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#E0F2FE] shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] text-[#0284C7] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-display font-black text-base uppercase text-[#172033]">
            {searchQuery ? 'Customer Tidak Ditemukan' : 'Belum Ada Customer Terdaftar'}
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            {searchQuery
              ? `Tidak ada data customer yang cocok dengan kata kunci "${searchQuery}".`
              : 'Customer yang mendaftar melalui halaman aplikasi akan otomatis muncul di sini secara realtime.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-[#F0F7FF] text-[#0284C7] text-xs font-bold uppercase tracking-wider hover:bg-[#E0F2FE] transition-colors"
            >
              Reset Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* DESKTOP / TABLET TABLE (hidden on small mobile screens) */}
          <div className="hidden md:block bg-white rounded-3xl border border-[#E0F2FE] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
                    <th className="py-3.5 px-6 font-bold w-12 text-center">#</th>
                    <th className="py-3.5 px-6 font-bold">Nama Customer</th>
                    <th className="py-3.5 px-6 font-bold">Nomor Handphone / WhatsApp</th>
                    <th className="py-3.5 px-6 font-bold text-center">Tanggal Lahir</th>
                    <th className="py-3.5 px-6 font-bold text-center">Saldo Poin</th>
                    <th className="py-3.5 px-6 font-bold text-center">Poin Diperoleh / Ditukar</th>
                    <th className="py-3.5 px-6 font-bold text-right">Tanggal Terdaftar</th>
                    <th className="py-3.5 px-6 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0F2FE] text-xs">
                  {filteredCustomers.map((customer, index) => {
                    const cleanPhone = customer.nomorHp ? customer.nomorHp.replace(/[^0-9]/g, '') : '';
                    const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
                    const initial = customer.namaLengkap ? customer.namaLengkap.charAt(0).toUpperCase() : 'C';

                    return (
                      <tr
                        key={customer.id || index}
                        className="hover:bg-[#F8FBFF] transition-colors group"
                      >
                        {/* No */}
                        <td className="py-4 px-6 text-center font-mono text-[#64748B] text-xs font-semibold">
                          {index + 1}
                        </td>

                        {/* Customer Name */}
                        <td className="py-4 px-6">
                          <button
                            type="button"
                            onClick={() => handleOpenCustomerDetail(customer)}
                            className="flex items-center gap-3 text-left group/btn cursor-pointer focus:outline-none"
                            title="Klik untuk melihat detail & riwayat pesanan"
                          >
                            <div className="w-9 h-9 rounded-xl bg-[#0284C7] group-hover/btn:bg-[#0369A1] text-white flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm transition-colors">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[#172033] group-hover/btn:text-[#0284C7] block truncate text-sm transition-colors underline-offset-2 group-hover/btn:underline">
                                {customer.namaLengkap}
                              </span>
                              <span className="text-[10px] text-[#0284C7] font-semibold flex items-center gap-1 mt-0.5">
                                <Receipt className="w-3 h-3 text-[#0284C7]" />
                                Lihat Riwayat Pesanan
                              </span>
                            </div>
                          </button>
                        </td>

                        {/* Phone Number with quick actions */}
                        <td className="py-4 px-6 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#172033]">
                              {customer.nomorHp || '-'}
                            </span>
                            {customer.nomorHp && customer.nomorHp !== '-' && (
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleCopyPhone(customer.id, customer.nomorHp)}
                                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0284C7] hover:bg-[#F0F7FF] transition-colors"
                                  title="Salin Nomor HP"
                                >
                                  {copiedPhoneId === customer.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                {waPhone && (
                                  <a
                                    href={`https://wa.me/${waPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-lg text-[#64748B] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Hubungi via WhatsApp"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Tanggal Lahir */}
                        <td className="py-4 px-6 text-center font-mono text-xs text-[#475569]">
                          {customer.tanggalLahir || '-'}
                        </td>

                        {/* Saldo Poin */}
                        <td className="py-4 px-6 text-center text-xs">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0F9FF] text-[#0284C7] font-bold border border-[#E0F2FE]">
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span>{customer.pointsBalance ?? 0} Poin</span>
                          </div>
                        </td>

                        {/* Poin Diperoleh / Ditukar */}
                        <td className="py-4 px-6 text-center text-xs font-mono space-y-0.5">
                          <div className="text-emerald-600 font-bold" title="Total Poin Diperoleh">
                            +{customer.totalPointsEarned ?? 0}
                          </div>
                          <div className="text-rose-600 font-bold" title="Total Poin Ditukarkan">
                            -{customer.totalPointsRedeemed ?? 0}
                          </div>
                        </td>

                        {/* Registered Date */}
                        <td className="py-4 px-6 text-right text-[#64748B] font-mono text-xs">
                          <div className="flex items-center justify-end gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                            <span>{formatDate(customer.createdAt)}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-6 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={deletingId === customer.id}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Hapus Member"
                          >
                            {deletingId === customer.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE RESPONSIVE CARD LIST (Visible on screens < md) */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer, index) => {
              const cleanPhone = customer.nomorHp ? customer.nomorHp.replace(/[^0-9]/g, '') : '';
              const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
              const initial = customer.namaLengkap ? customer.namaLengkap.charAt(0).toUpperCase() : 'C';

              return (
                <div
                  key={customer.id || index}
                  className="p-4 rounded-2xl bg-white border border-[#E0F2FE] shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center font-display font-black text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-[#172033] text-sm block truncate">
                          {customer.namaLengkap}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B] block">
                          #{index + 1} {customer.tanggalLahir ? `| Lahir: ${customer.tanggalLahir}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Points summary block */}
                  <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#E0F2FE] grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[9px] font-mono text-[#64748B] uppercase block">Saldo Poin</span>
                      <span className="font-bold text-[#0284C7]">{customer.pointsBalance ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-[#64748B] uppercase block">Diperoleh</span>
                      <span className="font-bold text-emerald-600">+{customer.totalPointsEarned ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-[#64748B] uppercase block">Ditukarkan</span>
                      <span className="font-bold text-rose-600">-{customer.totalPointsRedeemed ?? 0}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E0F2FE] flex items-center justify-between text-xs">
                    {/* Phone details */}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="font-mono font-bold text-[#172033]">
                        {customer.nomorHp || '-'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerDetail(customer)}
                        className="px-2.5 py-1 rounded-lg bg-[#F0F7FF] text-[#0284C7] text-[11px] font-bold flex items-center gap-1 hover:bg-[#E0F2FE] transition-colors"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>Riwayat</span>
                      </button>
                      {customer.nomorHp && customer.nomorHp !== '-' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(customer.id, customer.nomorHp)}
                            className="p-1.5 rounded-lg bg-[#F0F7FF] text-[#0284C7] hover:bg-[#E0F2FE] transition-colors"
                            title="Salin Nomor"
                          >
                            {copiedPhoneId === customer.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E0F2FE] flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#94A3B8]" />
                      <span>Terdaftar: {formatDate(customer.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(customer)}
                        disabled={deletingId === customer.id}
                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                        title="Hapus Member"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{deletingId === customer.id ? '...' : 'Hapus'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerDetail(customer)}
                        className="text-[#0284C7] font-bold flex items-center gap-0.5 hover:underline"
                      >
                        <span>Detail</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MEMBER DETAIL & ORDER HISTORY MODAL                  */}
      {/* ---------------------------------------------------- */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#E0F2FE] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-[#0284C7] to-[#0369A1] text-white relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center font-display font-black text-2xl shadow-inner shrink-0">
                  {selectedCustomer.namaLengkap ? selectedCustomer.namaLengkap.charAt(0).toUpperCase() : 'M'}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                    <Award className="w-3 h-3 text-amber-300" />
                    <span>Detail Member</span>
                  </div>
                  <h2 className="font-display font-black text-xl sm:text-2xl text-white">
                    {selectedCustomer.namaLengkap}
                  </h2>
                  <p className="text-sky-100 text-xs font-mono mt-0.5">
                    No. HP: {selectedCustomer.nomorHp || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body Info Stats */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F0F7FF] border border-[#E0F2FE]">
                  <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase block">
                    Tanggal Terdaftar
                  </span>
                  <span className="font-mono font-bold text-xs text-[#172033] mt-1 block">
                    {formatDate(selectedCustomer.createdAt)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F0F7FF] border border-[#E0F2FE]">
                  <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase block">
                    Total Pesanan
                  </span>
                  <span className="font-display font-black text-base text-[#0284C7] mt-0.5 block">
                    {customerOrders.length} Order
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F0F7FF] border border-[#E0F2FE] col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase block">
                    Status Member
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] mt-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Member Aktif
                  </span>
                </div>
              </div>

              {/* Order History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-black text-sm uppercase text-[#172033] flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#0284C7]" />
                    <span>Riwayat Pesanan ({customerOrders.length})</span>
                  </h3>
                  {isLoadingOrders && (
                    <span className="text-xs font-mono text-[#0284C7] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Memuat...
                    </span>
                  )}
                </div>

                {isLoadingOrders ? (
                  <div className="p-8 text-center bg-[#F8FBFF] rounded-2xl border border-[#E0F2FE]">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#0284C7] mx-auto mb-2" />
                    <p className="text-xs font-mono text-[#64748B]">Retrieving order history from Supabase...</p>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-8 text-center bg-[#F8FBFF] rounded-2xl border border-[#E0F2FE] space-y-2">
                    <Receipt className="w-8 h-8 text-[#94A3B8] mx-auto" />
                    <p className="text-xs font-bold text-[#172033]">Belum Ada Riwayat Pesanan</p>
                    <p className="text-[11px] text-[#64748B]">Member ini belum pernah membuat pesanan di outlet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {customerOrders.map((ord) => {
                      const isReady = ord.orderStatus === 'READY';
                      const isCompleted = ord.orderStatus === 'COMPLETED';
                      const isCancelled = ord.orderStatus === 'CANCELLED';

                      return (
                        <div
                          key={ord.id}
                          className="p-4 rounded-2xl bg-white border border-[#E0F2FE] hover:border-[#0284C7]/40 shadow-sm transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-[#172033]">
                                  #{ord.orderNumber}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0284C7] font-bold">
                                  {ord.orderType}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#64748B] flex items-center gap-1 mt-1">
                                <Store className="w-3 h-3 text-[#0284C7]" />
                                {ord.outletName || 'Cabang Leton'}
                              </span>
                            </div>

                            <div className="text-right">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                                  isCompleted || isReady
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCancelled
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ord.orderStatus}
                              </span>
                              <span className="text-[10px] text-[#64748B] font-mono block mt-1">
                                {formatDate(ord.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Ordered Items Summary */}
                          <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] text-xs space-y-1">
                            {Array.isArray(ord.items) && ord.items.map((it: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span className="font-semibold text-[#172033]">
                                  {it.quantity}x {it.name || it.productName}
                                </span>
                                <span className="font-mono text-[#64748B]">
                                  Rp {((it.unitPrice || it.price || 0) * (it.quantity || 1)).toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1 text-xs">
                            <span className="text-[#64748B] font-mono">Total Pembayaran:</span>
                            <span className="font-display font-black text-sm text-[#0284C7]">
                              Rp {Number(ord.totalAmount || 0).toLocaleString('id-ID')}
                            </span>
                          </div>

                          {ord.rejectionReason && (
                            <div className="p-2 rounded-xl bg-rose-50 text-rose-700 text-[11px]">
                              <strong>Alasan Penolakan:</strong> {ord.rejectionReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F8FBFF] border-t border-[#E0F2FE] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteCustomer(selectedCustomer)}
                disabled={deletingId === selectedCustomer.id}
                className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingId === selectedCustomer.id ? 'Menghapus...' : 'Hapus Member Ini'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 rounded-xl bg-white border border-[#E0F2FE] text-xs font-bold text-[#172033] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#E0F2FE] shadow-2xl overflow-hidden p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-black text-xl text-[#172033]">
                Hapus member ini secara permanen?
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Data profil dan data loyalty member <strong className="text-[#172033]">{confirmingCustomer.namaLengkap}</strong> ({confirmingCustomer.nomorHp}) akan dihapus.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingCustomer(null)}
                disabled={deletingId === confirmingCustomer.id}
                className="flex-1 py-3 px-4 rounded-xl bg-white border border-[#E0F2FE] font-bold text-xs text-[#172033] hover:bg-[#F8FBFF] transition-colors cursor-pointer disabled:opacity-50"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deletingId === confirmingCustomer.id}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingId === confirmingCustomer.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>MENGHAPUS...</span>
                  </>
                ) : (
                  <span>HAPUS PERMANEN</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce">
          <Check className="w-5 h-5" />
          <span className="font-bold text-xs">{successToast}</span>
        </div>
      )}
    </div>
  );
};
