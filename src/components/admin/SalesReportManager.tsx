import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Store,
  CreditCard,
  Search,
} from 'lucide-react';
import { CustomerOrder } from '../../types';
import { fetchAllOrders, subscribeToOrdersRealtime } from '../../utils/supabaseOrders';
import { matchesOutlet } from '../../data/adminAccounts';

type PeriodFilter = 'today' | '7days' | '30days' | 'this_month' | 'all';

export const SalesReportManager: React.FC = () => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Load orders from Supabase Production
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllOrders('ALL');
      setOrders(data);
    } catch (err) {
      console.warn('Failed to load sales orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    const unsubscribe = subscribeToOrdersRealtime((updatedList) => {
      setOrders(updatedList);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filter orders by period
  const filterByDate = (order: CustomerOrder, filterPeriod: PeriodFilter): boolean => {
    if (filterPeriod === 'all') return true;
    const orderDate = new Date(order.createdAt);
    const now = new Date();

    if (filterPeriod === 'today') {
      return (
        orderDate.getDate() === now.getDate() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    if (filterPeriod === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= sevenDaysAgo;
    }

    if (filterPeriod === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= thirtyDaysAgo;
    }

    if (filterPeriod === 'this_month') {
      return (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!filterByDate(order, period)) return false;

      if (selectedOutlet !== 'ALL') {
        const matches = matchesOutlet(order.outletId, selectedOutlet);
        if (!matches) return false;
      }

      if (selectedPaymentStatus !== 'ALL') {
        if (order.paymentStatus !== selectedPaymentStatus) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          order.orderNumber.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          (order.customerPhone && order.customerPhone.toLowerCase().includes(q)) ||
          order.outletName.toLowerCase().includes(q) ||
          (order.tableNumber && order.tableNumber.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [orders, period, selectedOutlet, selectedPaymentStatus, searchQuery]);

  // Calculations
  const stats = useMemo(() => {
    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'PAID');
    const waitingVerifOrders = filteredOrders.filter((o) => o.paymentStatus === 'WAITING VERIFICATION');
    const payAtStoreOrders = filteredOrders.filter((o) => o.paymentStatus === 'PAY AT STORE');
    const rejectedOrders = filteredOrders.filter((o) => o.paymentStatus === 'REJECTED');

    const totalSalesAll = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrdersAll = filteredOrders.length;
    const paidOrdersCount = paidOrders.length;

    // Per-outlet breakdown (paid only)
    const sudirmanPaid = paidOrders.filter((o) => matchesOutlet(o.outletId, 'outlet-sudirman'));
    const sudirmanSales = sudirmanPaid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const kelakapPaid = paidOrders.filter((o) => matchesOutlet(o.outletId, 'outlet-kelakap'));
    const kelakapSales = kelakapPaid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const letgoPaid = paidOrders.filter((o) => matchesOutlet(o.outletId, 'outlet-letgo'));
    const letgoSales = letgoPaid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      totalSalesAll,
      totalOrdersAll,
      paidOrdersCount,
      waitingVerifCount: waitingVerifOrders.length,
      payAtStoreCount: payAtStoreOrders.length,
      rejectedCount: rejectedOrders.length,
      sudirmanSales,
      sudirmanOrdersCount: sudirmanPaid.length,
      kelakapSales,
      kelakapOrdersCount: kelakapPaid.length,
      letgoSales,
      letgoOrdersCount: letgoPaid.length,
    };
  }, [filteredOrders]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada data pesanan untuk diexport.');
      return;
    }

    const headers = [
      'No Order',
      'Waktu',
      'Outlet',
      'Customer',
      'No Telp',
      'Tipe Pesanan',
      'Meja',
      'Metode Bayar',
      'Status Pembayaran',
      'Status Pesanan',
      'Total (IDR)',
      'Item Pesanan',
    ];

    const rows = filteredOrders.map((o) => {
      const itemsText = o.items.map((it) => `${it.name} (${it.quantity}x)`).join('; ');
      return [
        `"${o.orderNumber}"`,
        `"${new Date(o.createdAt).toLocaleString('id-ID')}"`,
        `"${o.outletName}"`,
        `"${o.customerName}"`,
        `"${o.customerPhone || '-'}"`,
        `"${o.orderType}"`,
        `"${o.tableNumber || '-'}"`,
        `"${o.paymentMethod}"`,
        `"${o.paymentStatus}"`,
        `"${o.orderStatus}"`,
        o.totalAmount,
        `"${itemsText}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Leton_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="sales-report-manager" className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E0F2FE] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD] tracking-wider">
              SUPER ADMIN • REKAP FINANSIAL
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Supabase Sync
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172033] mt-1.5 font-display">
            Laporan Penjualan &amp; Analytics Outlet
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Rekapitulasi omset, total transaksi, dan status pembayaran dari database production.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="refresh-sales-btn"
            onClick={loadOrders}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E0F2FE] text-xs font-semibold text-[#172033] hover:bg-[#F0F7FF] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#0284C7]' : 'text-[#0284C7]'} />
            Muat Ulang
          </button>
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-xs font-bold text-white transition shadow-sm cursor-pointer"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            id="print-report-btn"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E0F2FE] text-xs font-semibold text-[#172033] hover:bg-[#F0F7FF] transition shadow-sm cursor-pointer"
          >
            <Printer size={14} className="text-[#0284C7]" />
            Cetak
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#E0F2FE] overflow-x-auto shadow-sm">
        <span className="text-xs text-[#64748B] px-3 font-semibold flex items-center gap-1.5">
          <Calendar size={13} className="text-[#0284C7]" />
          Periode:
        </span>
        {[
          { id: 'all', label: 'Semua Waktu' },
          { id: 'today', label: 'Hari Ini' },
          { id: '7days', label: '7 Hari Terakhir' },
          { id: '30days', label: '30 Hari Terakhir' },
          { id: 'this_month', label: 'Bulan Ini' },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`period-tab-${tab.id}`}
            onClick={() => setPeriod(tab.id as PeriodFilter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              period === tab.id
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F0F7FF]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales All Outlets */}
        <div className="bg-white border border-[#E0F2FE] p-4 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold tracking-wide">TOTAL SALES (LUNAS)</span>
            <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[#0284C7] tracking-tight font-mono">
              Rp {stats.totalSalesAll.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 border-t border-[#E0F2FE] pt-1.5">
              <span>Semua Outlet</span>
              <span className="text-emerald-600 font-bold">{stats.totalOrdersAll} total order</span>
            </div>
          </div>
        </div>

        {/* Sudirman Sales */}
        <div className="bg-white border border-[#E0F2FE] p-4 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold tracking-wide">LETON SUDIRMAN</span>
            <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[#172033] tracking-tight font-mono">
              Rp {stats.sudirmanSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 border-t border-[#E0F2FE] pt-1.5">
              <span>Chapter 5 • Urban Hub</span>
              <span className="text-[#0284C7] font-bold">{stats.sudirmanOrdersCount} order</span>
            </div>
          </div>
        </div>

        {/* Kelakap 7 Sales */}
        <div className="bg-white border border-[#E0F2FE] p-4 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold tracking-wide">LETON KELAKAP 7</span>
            <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[#172033] tracking-tight font-mono">
              Rp {stats.kelakapSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 border-t border-[#E0F2FE] pt-1.5">
              <span>Chapter 6 • Open Air</span>
              <span className="text-[#0284C7] font-bold">{stats.kelakapOrdersCount} order</span>
            </div>
          </div>
        </div>

        {/* LetGo / Mobile Booth Sales */}
        <div className="bg-white border border-[#E0F2FE] p-4 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold tracking-wide">LET'GO DEPAN MPP</span>
            <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[#172033] tracking-tight font-mono">
              Rp {stats.letgoSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 border-t border-[#E0F2FE] pt-1.5">
              <span>Mobile Coffee Booth</span>
              <span className="text-[#0284C7] font-bold">{stats.letgoOrdersCount} order</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Status Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-[#E0F2FE] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Lunas / Terverifikasi</div>
            <div className="text-base font-bold text-emerald-700">{stats.paidOrdersCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Menunggu QRIS</div>
            <div className="text-base font-bold text-amber-700">{stats.waitingVerifCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0F7FF] flex items-center justify-center text-[#0284C7] shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Bayar di Kasir</div>
            <div className="text-base font-bold text-[#0284C7]">{stats.payAtStoreCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Ditolak / Batal</div>
            <div className="text-base font-bold text-rose-700">{stats.rejectedCount} Transaksi</div>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E0F2FE] shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Cari order #, nama pelanggan, whatsapp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8FBFF] border border-[#E0F2FE] rounded-xl pl-9 pr-3 py-2 text-xs text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {/* Outlet Filter Dropdown */}
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="bg-[#F8FBFF] border border-[#E0F2FE] text-xs text-[#172033] rounded-xl px-3 py-2 focus:outline-none focus:border-[#38BDF8]"
          >
            <option value="ALL">Semua Outlet</option>
            <option value="outlet-sudirman">Sudirman Hub (Ch. 5)</option>
            <option value="outlet-kelakap">Kelakap 7 (Ch. 6)</option>
            <option value="outlet-letgo">Let'GO Mobile Booth</option>
          </select>

          {/* Payment Status Dropdown */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="bg-[#F8FBFF] border border-[#E0F2FE] text-xs text-[#172033] rounded-xl px-3 py-2 focus:outline-none focus:border-[#38BDF8]"
          >
            <option value="ALL">Semua Status Bayar</option>
            <option value="PAID">Lunas (PAID)</option>
            <option value="WAITING VERIFICATION">Menunggu Verifikasi</option>
            <option value="PAY AT STORE">Bayar di Outlet</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>

        <div className="text-xs text-[#64748B] font-mono">
          Menampilkan <strong className="text-[#172033]">{filteredOrders.length}</strong> pesanan
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-white border border-[#E0F2FE] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FBFF] text-[#64748B] uppercase font-mono text-[10px] border-b border-[#E0F2FE]">
              <tr>
                <th className="px-4 py-3">No. Order</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Layanan</th>
                <th className="px-4 py-3">Metode Bayar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Bukti QRIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0F2FE] text-[#172033]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748B]">
                    Tidak ada transaksi ditemukan pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F8FBFF] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0284C7]">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {new Date(o.createdAt).toLocaleString('id-ID', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{o.outletName}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.customerName}</div>
                      {o.customerPhone && (
                        <div className="text-[10px] text-[#64748B]">{o.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-[#F0F7FF] text-[#0284C7] font-semibold text-[10px]">
                        {o.orderType} {o.tableNumber ? `(Meja ${o.tableNumber})` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">{o.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : o.paymentStatus === 'WAITING VERIFICATION'
                            ? 'bg-amber-50 text-amber-700'
                            : o.paymentStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-[#F0F7FF] text-[#0284C7]'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#172033]">
                      Rp {o.totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.paymentReceiptUrl ? (
                        <button
                          onClick={() => setPreviewReceiptUrl(o.paymentReceiptUrl || null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E0F2FE] text-[#0284C7] hover:bg-[#BAE6FD] text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Lihat</span>
                        </button>
                      ) : (
                        <span className="text-[#94A3B8] text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal Preview */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E0F2FE] p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0F2FE]">
              <span className="font-bold text-sm text-[#172033]">Bukti Transfer QRIS</span>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="text-[#64748B] hover:text-[#172033] font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <div className="py-4 flex justify-center">
              <img
                src={previewReceiptUrl}
                alt="Receipt Preview"
                className="max-h-[60vh] object-contain rounded-xl border border-[#E0F2FE]"
              />
            </div>
            <div className="pt-3 border-t border-[#E0F2FE] text-right">
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-2 rounded-xl bg-[#0284C7] text-white text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
