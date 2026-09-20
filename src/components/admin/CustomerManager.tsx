import React, { useState, useEffect, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  fetchRegisteredCustomers,
  subscribeToCustomersRealtime,
  RegisteredCustomer,
} from '../../utils/supabaseCustomers';
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
} from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const { auth, isRealtimeConnected } = useContent();
  const isSuperAdmin = auth.role === 'super_admin';

  const [customers, setCustomers] = useState<RegisteredCustomer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Load customer data directly from Supabase
  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRegisteredCustomers(auth.role);
      setCustomers(data);
    } catch (err) {
      console.warn('[CustomerManager] Gagal memuat data customer:', err);
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
                    <th className="py-3.5 px-6 font-bold">Tanggal Terdaftar</th>
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
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#0284C7] text-white flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[#172033] block truncate text-sm">
                                {customer.namaLengkap}
                              </span>
                              {customer.tanggalLahir && (
                                <span className="text-[10px] text-[#64748B] flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3 text-[#94A3B8]" />
                                  Lahir: {customer.tanggalLahir}
                                </span>
                              )}
                            </div>
                          </div>
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

                        {/* Registered Date */}
                        <td className="py-4 px-6 text-[#64748B] font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                            <span>{formatDate(customer.createdAt)}</span>
                          </div>
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
                          #{index + 1}
                        </span>
                      </div>
                    </div>

                    {customer.tanggalLahir && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F0F7FF] text-[#0284C7] font-semibold shrink-0">
                        Lahir: {customer.tanggalLahir}
                      </span>
                    )}
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
                    {customer.nomorHp && customer.nomorHp !== '-' && (
                      <div className="flex items-center gap-1">
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
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#E0F2FE] flex items-center gap-1.5 text-[11px] font-mono text-[#64748B]">
                    <Calendar className="w-3 h-3 text-[#94A3B8]" />
                    <span>Terdaftar: {formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
