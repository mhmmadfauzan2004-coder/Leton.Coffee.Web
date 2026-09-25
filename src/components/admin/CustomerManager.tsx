import React, { useState, useEffect, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  fetchRegisteredCustomers,
  subscribeToCustomersRealtime,
  deleteRegisteredCustomer,
  RegisteredCustomer,
  fetchMemberInactivitySettings,
  saveMemberInactivitySettings,
  triggerMemberInactivityCleanup,
  fetchMemberInactivityCandidates,
} from '../../utils/supabaseCustomers';
import { fetchCustomerOrdersForAdmin } from '../../utils/supabaseOrders';
import { CustomerOrder, MemberInactivitySettings, MemberInactivityCandidate } from '../../types';
import { formatOrderDateTime } from '../../utils/formatters';
import {
  getMembershipTierSettings,
  MembershipTierSettings,
  DEFAULT_MEMBERSHIP_TIER_SETTINGS,
} from '../../utils/supabaseMembershipTier';
import {
  Users,
  Search,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  MessageCircle,
  Receipt,
  Award,
  Trash2,
  AlertTriangle,
  Settings,
  Play,
  UserX,
  UserCheck,
  Clock,
  Calendar,
  CheckCircle2,
  Sliders,
  Filter,
} from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const { auth, isRealtimeConnected } = useContent();
  const isSuperAdmin = auth.role === 'super_admin';

  // Sub-tab state
  const [activeTab, setActiveTab] = useState<'all' | 'candidates' | 'settings'>('all');

  // Core customer state
  const [customers, setCustomers] = useState<RegisteredCustomer[]>([]);
  const [tierSettings, setTierSettings] = useState<MembershipTierSettings>(DEFAULT_MEMBERSHIP_TIER_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inactivity Settings & Candidates State
  const [inactivitySettings, setInactivitySettings] = useState<MemberInactivitySettings>({
    inactivityPeriodDays: 60,
    gracePeriodDays: 7,
    autoCleanupEnabled: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isExecutingCleanup, setIsExecutingCleanup] = useState<boolean>(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);

  // Inactivity candidates
  const [inactiveCandidates, setInactiveCandidates] = useState<MemberInactivityCandidate[]>([]);
  const [deletionCandidates, setDeletionCandidates] = useState<MemberInactivityCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(false);

  // Customer Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<RegisteredCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // Confirm delete modal state & success toast
  const [confirmingCustomer, setConfirmingCustomer] = useState<RegisteredCustomer | null>(null);
  const [confirmingManualCleanup, setConfirmingManualCleanup] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load member inactivity settings and candidate previews
  const loadInactivityData = async () => {
    setIsLoadingCandidates(true);
    try {
      const [settingsRes, candidatesRes] = await Promise.all([
        fetchMemberInactivitySettings(auth.role),
        fetchMemberInactivityCandidates(auth.role),
      ]);

      if (settingsRes?.settings) {
        setInactivitySettings(settingsRes.settings);
      }
      if (candidatesRes?.inactiveCandidates) {
        setInactiveCandidates(candidatesRes.inactiveCandidates);
      }
      if (candidatesRes?.deletionCandidates) {
        setDeletionCandidates(candidatesRes.deletionCandidates);
      }
    } catch (err) {
      console.warn('[loadInactivityData] Exception:', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  // Save updated inactivity configuration
  const handleSaveInactivitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await saveMemberInactivitySettings(
        {
          inactivityPeriodDays: Number(inactivitySettings.inactivityPeriodDays) || 60,
          gracePeriodDays: Number(inactivitySettings.gracePeriodDays) || 7,
          autoCleanupEnabled: Boolean(inactivitySettings.autoCleanupEnabled),
        },
        auth.role
      );

      if (res.success && res.settings) {
        setInactivitySettings(res.settings);
        setSuccessToast('Pengaturan Auto Inactivity berhasil disimpan');
        setTimeout(() => setSuccessToast(null), 3500);
        await loadInactivityData();
      } else {
        alert(res.error || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Run cleanup worker manually
  const handleExecuteManualCleanup = async () => {
    setIsExecutingCleanup(true);
    setConfirmingManualCleanup(false);
    try {
      const res = await triggerMemberInactivityCleanup(auth.role);
      if (res.success && res.summary) {
        const sum = res.summary;
        const msg = `Cleanup selesai: ${sum.markedInactiveCount} member diset INACTIVE, ${sum.deletedMembersCount} member terhapus.`;
        setCleanupSuccessMessage(msg);
        setSuccessToast('Proses Cleanup Member selesai dijalankan');
        setTimeout(() => setSuccessToast(null), 4000);

        await Promise.all([loadCustomers(), loadInactivityData()]);
      } else {
        alert(res.error || 'Gagal menjalankan cleanup.');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan sistem saat cleanup.');
    } finally {
      setIsExecutingCleanup(false);
    }
  };

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
        if (selectedCustomer?.id === customerId) {
          setSelectedCustomer(null);
        }
        setConfirmingCustomer(null);

        await Promise.all([loadCustomers(), loadInactivityData()]);

        setSuccessToast('Member berhasil dihapus');
        setTimeout(() => setSuccessToast(null), 3500);
      } else {
        console.warn('[CustomerManager] Gagal menghapus:', result);
        alert(result.error || 'Gagal menghapus member: Record masih tersimpan di database Supabase.');
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
      console.warn('[CustomerManager] Gagal memuat data customer:', err);
      setErrorMessage(err?.message || 'Gagal menyinkronkan data customer dari database Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;

    loadCustomers();
    loadInactivityData();

    getMembershipTierSettings()
      .then((res) => {
        setTierSettings(res.settings);
      })
      .catch(() => {});

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

  const formatDate = (isoString: string) => {
    return formatOrderDateTime(isoString);
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

  // Calculated statistics
  const activeCount = useMemo(() => customers.filter((c) => c.status !== 'INACTIVE').length, [customers]);
  const inactiveCount = useMemo(() => customers.filter((c) => c.status === 'INACTIVE').length, [customers]);

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
          Halaman <strong>DATA CUSTOMER &amp; INACTIVITY CLEANUP</strong> hanya dapat diakses oleh Super Admin / Admin Pusat Leton HQ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

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
              DATA MEMBER &amp; INACTIVITY CLEANUP
            </h1>
            <p className="text-[#64748B] text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Kelola seluruh pelanggan terdaftar, pantau status keaktifan, dan konfigurasikan sistem pembersihan otomatis member non-aktif secara terukur.
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

            {/* Refresh Button */}
            <button
              onClick={() => {
                loadCustomers();
                loadInactivityData();
              }}
              disabled={isLoading || isLoadingCandidates}
              className="p-3 rounded-2xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              title="Refresh Data Customer &amp; Inactivity"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isLoadingCandidates ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* STATS SUMMARY BARS                                  */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-[#E0F2FE]">
          {/* Active Members */}
          <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-emerald-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-emerald-800 font-bold uppercase block">
                Member Aktif
              </span>
              <span className="font-display font-black text-xl text-emerald-950 leading-none">
                {activeCount}
              </span>
            </div>
          </div>

          {/* Inactive Members */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-amber-800 font-bold uppercase block">
                Member Inactive
              </span>
              <span className="font-display font-black text-xl text-amber-950 leading-none">
                {inactiveCount}
              </span>
            </div>
          </div>

          {/* Candidates Inactive (Mendekati 60 hari) */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-sky-800 font-bold uppercase block">
                Kandidat Inactive
              </span>
              <span className="font-display font-black text-xl text-sky-950 leading-none">
                {inactiveCandidates.length}
              </span>
            </div>
          </div>

          {/* Candidates Deletion (Pasca Grace Period 7 hari) */}
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-rose-800 font-bold uppercase block">
                Siap Dihapus
              </span>
              <span className="font-display font-black text-xl text-rose-950 leading-none">
                {deletionCandidates.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {cleanupSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cleanupSuccessMessage}</span>
          </div>
          <button
            onClick={() => setCleanupSuccessMessage(null)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SUB-TABS NAVIGATION                                  */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-[#E0F2FE] pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-[#0284C7] text-white shadow-sm'
              : 'bg-white text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF] border border-[#E0F2FE]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Semua Member ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 relative ${
            activeTab === 'candidates'
              ? 'bg-[#0284C7] text-white shadow-sm'
              : 'bg-white text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF] border border-[#E0F2FE]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Kandidat Inactive &amp; Hapus</span>
          {(inactiveCandidates.length > 0 || deletionCandidates.length > 0) && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-[#0284C7] text-white shadow-sm'
              : 'bg-white text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF] border border-[#E0F2FE]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan &amp; Auto Cleanup</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: ALL CUSTOMERS LIST VIEW                       */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* SEARCH BAR & FILTER CONTROLS */}
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
                Menampilkan <strong className="text-[#172033]">{filteredCustomers.length}</strong> dari {customers.length} member
              </span>
            </div>
          </div>

          {isLoading && customers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E0F2FE] shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0284C7] mx-auto mb-3" />
              <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">
                Memuat Data Member dari Database...
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E0F2FE] shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] text-[#0284C7] flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-base uppercase text-[#172033]">
                {searchQuery ? 'Member Tidak Ditemukan' : 'Belum Ada Member Terdaftar'}
              </h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                {searchQuery
                  ? `Tidak ada data member yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Member yang mendaftar melalui aplikasi akan otomatis muncul di sini secara realtime.'}
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
            <div className="bg-white rounded-3xl border border-[#E0F2FE] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
                      <th className="py-3.5 px-6 font-bold w-12 text-center">#</th>
                      <th className="py-3.5 px-6 font-bold">Nama Customer</th>
                      <th className="py-3.5 px-6 font-bold">Status Member</th>
                      <th className="py-3.5 px-6 font-bold">Nomor Handphone / WhatsApp</th>
                      <th className="py-3.5 px-6 font-bold text-center">Saldo Poin</th>
                      <th className="py-3.5 px-6 font-bold text-right">Tanggal Terdaftar</th>
                      <th className="py-3.5 px-6 font-bold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0F2FE] text-xs">
                    {filteredCustomers.map((customer, index) => {
                      const cleanPhone = customer.nomorHp ? customer.nomorHp.replace(/[^0-9]/g, '') : '';
                      const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
                      const initial = customer.namaLengkap ? customer.namaLengkap.charAt(0).toUpperCase() : 'C';
                      const isInactive = customer.status === 'INACTIVE';

                      return (
                        <tr
                          key={customer.id || index}
                          className={`hover:bg-[#F8FBFF] transition-colors group ${
                            isInactive ? 'bg-amber-50/40' : ''
                          }`}
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
                              title="Klik untuk melihat detail &amp; riwayat pesanan"
                            >
                              <div
                                className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm transition-colors ${
                                  isInactive ? 'bg-amber-500' : 'bg-[#0284C7] group-hover/btn:bg-[#0369A1]'
                                }`}
                              >
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

                          {/* Status Badge */}
                          <td className="py-4 px-6">
                            {isInactive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-mono font-bold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>INACTIVE</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>AKTIF</span>
                              </span>
                            )}
                          </td>

                          {/* Phone Number */}
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

                          {/* Saldo Poin */}
                          <td className="py-4 px-6 text-center text-xs">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0F9FF] text-[#0284C7] font-bold border border-[#E0F2FE]">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              <span>{customer.pointsBalance ?? 0} Poin</span>
                            </div>
                          </td>

                          {/* Registered Date */}
                          <td className="py-4 px-6 text-right font-mono text-[11px] text-[#64748B]">
                            {formatDate(customer.createdAt)}
                          </td>

                          {/* Action Delete */}
                          <td className="py-4 px-6 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(customer)}
                              disabled={deletingId === customer.id}
                              className="p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                              title="Hapus Member Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: CANDIDATES PREVIEW                            */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          {/* Candidates Inactive Section */}
          <div className="p-6 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0F2FE] pb-4">
              <div>
                <h3 className="font-display font-black text-lg text-[#172033] uppercase flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>Kandidat Member Inactive (&ge; 60 Hari Tanpa Transaksi Valid)</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Member aktif yang telah mendekati / memenuhi ambang batas {inactivitySettings.inactivityPeriodDays} hari tanpa transaksi berstatus PAID / COMPLETED.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                {inactiveCandidates.length} Member
              </span>
            </div>

            {inactiveCandidates.length === 0 ? (
              <div className="p-8 text-center bg-[#F8FBFF] rounded-2xl text-xs text-[#64748B]">
                Tidak ada member yang memenuhi kriteria kandidat inactive saat ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-[11px] font-mono text-[#64748B] uppercase">
                      <th className="py-3 px-4 font-bold">Nama Member</th>
                      <th className="py-3 px-4 font-bold">Nomor HP</th>
                      <th className="py-3 px-4 font-bold text-center">Transaksi Valid</th>
                      <th className="py-3 px-4 font-bold text-center">Transaksi Terakhir</th>
                      <th className="py-3 px-4 font-bold text-center">Hari Tanpa Order</th>
                      <th className="py-3 px-4 font-bold text-right">Status Prediksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0F2FE]">
                    {inactiveCandidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-[#F8FBFF]">
                        <td className="py-3.5 px-4 font-bold text-[#172033]">{cand.namaLengkap}</td>
                        <td className="py-3.5 px-4 font-mono">{cand.nomorHp}</td>
                        <td className="py-3.5 px-4 text-center font-bold">{cand.validOrdersCount} Order</td>
                        <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                          {cand.lastValidOrderAt ? formatDate(cand.lastValidOrderAt) : 'Belum Ada Transaksi'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-extrabold text-amber-600">
                          {cand.daysSinceLastValidOrder} Hari
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                            Akan Diset INACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Candidates Deletion Section */}
          <div className="p-6 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0F2FE] pb-4">
              <div>
                <h3 className="font-display font-black text-lg text-[#172033] uppercase flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  <span>Kandidat Penghapusan Akun (Pasca Grace Period {inactivitySettings.gracePeriodDays} Hari)</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Member inactive yang telah melewati masa tenggang {inactivitySettings.gracePeriodDays} hari. Histori transaksi akan tetap aman di database.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-bold">
                {deletionCandidates.length} Member
              </span>
            </div>

            {deletionCandidates.length === 0 ? (
              <div className="p-8 text-center bg-[#F8FBFF] rounded-2xl text-xs text-[#64748B]">
                Tidak ada member inactive yang masuk dalam kandidat penghapusan akun saat ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-[11px] font-mono text-[#64748B] uppercase">
                      <th className="py-3 px-4 font-bold">Nama Member</th>
                      <th className="py-3 px-4 font-bold">Nomor HP</th>
                      <th className="py-3 px-4 font-bold text-center">Tanggal Inactive</th>
                      <th className="py-3 px-4 font-bold text-center">Hari Inactive</th>
                      <th className="py-3 px-4 font-bold text-right">Status Akun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0F2FE]">
                    {deletionCandidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-rose-50/50">
                        <td className="py-3.5 px-4 font-bold text-[#172033]">{cand.namaLengkap}</td>
                        <td className="py-3.5 px-4 font-mono">{cand.nomorHp}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                          {cand.inactiveAt ? formatDate(cand.inactiveAt) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-extrabold text-rose-600">
                          {cand.daysSinceInactive ?? cand.daysSinceLastValidOrder} Hari
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                            Siap Dibersihkan
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: CONFIGURATION & MANUAL CLEANUP                */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm space-y-6">
            <div className="border-b border-[#E0F2FE] pb-4">
              <h3 className="font-display font-black text-xl text-[#172033] uppercase flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0284C7]" />
                <span>Pengaturan Aturan Inactivity</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Konfigurasikan batas hari ketidakaktifan dan masa tenggang hapus akun secara dinamis tanpa mengubah source code.
              </p>
            </div>

            <form onSubmit={handleSaveInactivitySettings} className="space-y-5">
              {/* Inactivity Period Days */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#172033] mb-1.5">
                  Masa Inactivity (Hari Tanpa Transaksi Valid)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={inactivitySettings.inactivityPeriodDays}
                  onChange={(e) =>
                    setInactivitySettings({
                      ...inactivitySettings,
                      inactivityPeriodDays: Math.max(1, Number(e.target.value) || 60),
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] text-sm font-mono font-bold text-[#172033] focus:outline-none focus:border-[#0284C7] focus:bg-white"
                  required
                />
                <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                  Default: <strong>60 Hari</strong>. Customer yang tidak melakukan transaksi berstatus <code>PAID</code> / <code>COMPLETED</code> dalam periode ini akan diubah statusnya menjadi <code>INACTIVE</code>.
                </p>
              </div>

              {/* Grace Period Days */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#172033] mb-1.5">
                  Masa Tenggang Grace Period (Hari)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={inactivitySettings.gracePeriodDays}
                  onChange={(e) =>
                    setInactivitySettings({
                      ...inactivitySettings,
                      gracePeriodDays: Math.max(0, Number(e.target.value) || 7),
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] text-sm font-mono font-bold text-[#172033] focus:outline-none focus:border-[#0284C7] focus:bg-white"
                  required
                />
                <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                  Default: <strong>7 Hari</strong>. Setelah member berstatus <code>INACTIVE</code> melewati masa tenggang ini, akun dapat dibersihkan otomatis.
                </p>
              </div>

              {/* Auto Cleanup Toggle */}
              <div className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-xs text-[#172033] uppercase">
                    Otomatisasi Scheduler Background Worker
                  </h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Aktifkan agar server menjalankan pengecekan &amp; cleanup otomatis secara berkala.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={inactivitySettings.autoCleanupEnabled}
                    onChange={(e) =>
                      setInactivitySettings({
                        ...inactivitySettings,
                        autoCleanupEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0284C7]"></div>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-3.5 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-display font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN'}
                </button>
              </div>
            </form>
          </div>

          {/* Manual Trigger & Execution Summary Card */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm space-y-4">
              <h3 className="font-display font-black text-lg text-[#172033] uppercase flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-600" />
                <span>Eksekusi Manual Worker</span>
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Jalankan pengecekan dan pembersihan member non-aktif secara langsung saat ini juga.
              </p>

              <button
                type="button"
                onClick={() => setConfirmingManualCleanup(true)}
                disabled={isExecutingCleanup}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${isExecutingCleanup ? 'animate-spin' : ''}`} />
                <span>{isExecutingCleanup ? 'MEMPROSES CLEANUP...' : 'JALANKAN CLEANUP SEKARANG'}</span>
              </button>
            </div>

            {/* Execution History */}
            <div className="p-6 rounded-3xl bg-white border border-[#E0F2FE] shadow-sm space-y-3">
              <h4 className="font-display font-black text-sm text-[#172033] uppercase">
                Hasil Execution Terakhir
              </h4>
              <div className="text-xs text-[#64748B] space-y-2 font-mono">
                <div className="flex justify-between border-b border-[#E0F2FE] pb-1.5">
                  <span>Last Run:</span>
                  <span className="font-bold text-[#172033]">
                    {inactivitySettings.lastRunAt ? formatDate(inactivitySettings.lastRunAt) : 'Belum Pernah'}
                  </span>
                </div>
                {inactivitySettings.lastRunSummary && (
                  <>
                    <div className="flex justify-between border-b border-[#E0F2FE] pb-1.5">
                      <span>Marked Inactive:</span>
                      <span className="font-bold text-amber-600">
                        {inactivitySettings.lastRunSummary.markedInactiveCount || 0} Member
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#E0F2FE] pb-1.5">
                      <span>Deleted Members:</span>
                      <span className="font-bold text-rose-600">
                        {inactivitySettings.lastRunSummary.deletedMembersCount || 0} Member
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CONFIRMATION MODAL: MANUAL CLEANUP RUN               */}
      {/* ---------------------------------------------------- */}
      {confirmingManualCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E0F2FE] space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-[#172033] uppercase">
                Jalankan Cleanup Member Manual?
              </h3>
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                Sistem akan memproses seluruh customer terdaftar:
              </p>
              <ul className="text-xs text-[#172033] list-disc list-inside mt-2 space-y-1 font-medium">
                <li>
                  Member tanpa transaksi valid &ge; <strong>{inactivitySettings.inactivityPeriodDays} hari</strong> akan diset <code>INACTIVE</code>.
                </li>
                <li>
                  Member inactive &ge; <strong>{inactivitySettings.gracePeriodDays} hari</strong> akan dibersihkan akunnya.
                </li>
                <li>
                  Histori transaksi/order akan <strong>tetap utuh tersimpan</strong>.
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingManualCleanup(false)}
                className="flex-1 py-3 rounded-2xl bg-[#F0F7FF] text-[#64748B] text-xs font-bold uppercase tracking-wider hover:bg-[#E0F2FE] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteManualCleanup}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-colors cursor-pointer"
              >
                Ya, Jalankan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CONFIRMATION MODAL: SINGLE MEMBER DELETE             */}
      {/* ---------------------------------------------------- */}
      {confirmingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E0F2FE] space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-[#172033] uppercase">
                Hapus Member Ini?
              </h3>
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                Anda yakin ingin menghapus member <strong>{confirmingCustomer.namaLengkap}</strong> ({confirmingCustomer.nomorHp})?
              </p>
              <p className="text-[11px] text-[#64748B] mt-2 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Catatan: Akun member akan dihapus dari sistem, tetapi histori transaksi/order akan tetap tersimpan utuh di database.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingCustomer(null)}
                className="flex-1 py-3 rounded-2xl bg-[#F0F7FF] text-[#64748B] text-xs font-bold uppercase tracking-wider hover:bg-[#E0F2FE] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={Boolean(deletingId)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingId ? 'MENGHAPUS...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
