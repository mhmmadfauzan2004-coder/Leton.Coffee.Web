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

    // Subscribe to realtime changes without kitchen chimes
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
      // Period filter
      if (!filterByDate(order, period)) return false;

      // Outlet filter
      if (selectedOutlet !== 'ALL' && !matchesOutlet(order.outletId, selectedOutlet)) {
        return false;
      }

      // Payment status filter
      if (selectedPaymentStatus !== 'ALL') {
        const norm = (order.paymentStatus || '').replace(/\s+/g, '_').toUpperCase();
        const targetNorm = selectedPaymentStatus.replace(/\s+/g, '_').toUpperCase();
        if (norm !== targetNorm) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = order.orderNumber.toLowerCase().includes(q);
        const matchCustomer = order.customerName.toLowerCase().includes(q);
        const matchPhone = (order.customerPhone || '').toLowerCase().includes(q);
        if (!matchNumber && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });
  }, [orders, period, selectedOutlet, selectedPaymentStatus, searchQuery]);

  // Financial calculations
  const stats = useMemo(() => {
    // Total gross sales of completed or paid orders
    const validOrders = orders.filter((o) => filterByDate(o, period));

    const totalSalesAll = validOrders
      .filter((o) => o.paymentStatus === 'PAID' || o.orderStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const totalPotentialSales = validOrders
      .filter((o) => o.paymentStatus !== 'PAYMENT REJECTED' && o.paymentStatus !== 'REJECTED' && o.orderStatus !== 'CANCELLED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // Sudirman sales
    const sudirmanOrders = validOrders.filter((o) => matchesOutlet(o.outletId, 'sudirman'));
    const sudirmanSales = sudirmanOrders
      .filter((o) => o.paymentStatus === 'PAID' || o.orderStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // Kelakap 7 sales
    const kelakapOrders = validOrders.filter((o) => matchesOutlet(o.outletId, 'kelakap_7'));
    const kelakapSales = kelakapOrders
      .filter((o) => o.paymentStatus === 'PAID' || o.orderStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // LetGo MPP sales
    const letgoOrders = validOrders.filter((o) => matchesOutlet(o.outletId, 'letgo-mpp'));
    const letgoSales = letgoOrders
      .filter((o) => o.paymentStatus === 'PAID' || o.orderStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // Payment status counts
    const paidCount = validOrders.filter((o) => o.paymentStatus === 'PAID').length;
    const waitingVerifCount = validOrders.filter((o) =>
      o.paymentStatus === 'WAITING VERIFICATION' || o.paymentStatus === 'WAITING_VERIFICATION'
    ).length;
    const payAtStoreCount = validOrders.filter((o) => o.paymentStatus === 'PAY AT STORE').length;
    const rejectedCount = validOrders.filter((o) =>
      o.paymentStatus === 'PAYMENT REJECTED' || o.paymentStatus === 'REJECTED'
    ).length;

    return {
      totalSalesAll,
      totalPotentialSales,
      totalOrdersAll: validOrders.length,
      sudirmanSales,
      sudirmanOrdersCount: sudirmanOrders.length,
      kelakapSales,
      kelakapOrdersCount: kelakapOrders.length,
      letgoSales,
      letgoOrdersCount: letgoOrders.length,
      paidCount,
      waitingVerifCount,
      payAtStoreCount,
      rejectedCount,
    };
  }, [orders, period]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada data pesanan untuk diekspor pada filter ini.');
      return;
    }

    const headers = [
      'No Order',
      'Tanggal & Waktu',
      'Outlet',
      'Nama Pelanggan',
      'No WhatsApp',
      'Tipe Pesanan',
      'No Meja',
      'Metode Pembayaran',
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
    <div id="sales-report-manager" className="space-y-6 text-white pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#2C2925] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8E7051]/20 text-[#CCA985] border border-[#8E7051]/30 tracking-wider">
              SUPER ADMIN • REKAP FINANSIAL
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Supabase Sync
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1.5 font-display">
            Laporan Penjualan & Analytics Outlet
          </h1>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            Rekapitulasi omset, total transaksi, dan status pembayaran dari database production.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="refresh-sales-btn"
            onClick={loadOrders}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#24211D] border border-[#3E3A33] text-xs font-medium text-stone-300 hover:text-white hover:bg-[#2F2B25] transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#CCA985]' : ''} />
            Muat Ulang
          </button>
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8E7051] hover:bg-[#735A40] text-xs font-medium text-white transition shadow-sm"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            id="print-report-btn"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#24211D] border border-[#3E3A33] text-xs font-medium text-stone-300 hover:text-white hover:bg-[#2F2B25] transition"
          >
            <Printer size={14} />
            Cetak
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1.5 bg-[#1C1A17] p-1.5 rounded-xl border border-[#2C2925] overflow-x-auto">
        <span className="text-xs text-[#8A8580] px-3 font-medium flex items-center gap-1.5">
          <Calendar size={13} />
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              period === tab.id
                ? 'bg-[#8E7051] text-white shadow'
                : 'text-stone-400 hover:text-white hover:bg-[#26231F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales All Outlets */}
        <div className="bg-[#1C1A17] border border-[#332E27] p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A8A29E] font-medium tracking-wide">TOTAL SALES (LUNAS)</span>
            <div className="w-8 h-8 rounded-lg bg-[#8E7051]/20 flex items-center justify-center text-[#CCA985]">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-white tracking-tight">
              Rp {stats.totalSalesAll.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#A8A29E] mt-1.5 border-t border-[#292520] pt-1.5">
              <span>Semua Outlet</span>
              <span className="text-emerald-400 font-medium">{stats.totalOrdersAll} total order</span>
            </div>
          </div>
        </div>

        {/* Sudirman Sales */}
        <div className="bg-[#1C1A17] border border-[#332E27] p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A8A29E] font-medium tracking-wide">LETON SUDIRMAN</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-white tracking-tight">
              Rp {stats.sudirmanSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#A8A29E] mt-1.5 border-t border-[#292520] pt-1.5">
              <span>Chapter 5 • Urban Hub</span>
              <span className="text-[#CCA985] font-medium">{stats.sudirmanOrdersCount} order</span>
            </div>
          </div>
        </div>

        {/* Kelakap 7 Sales */}
        <div className="bg-[#1C1A17] border border-[#332E27] p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A8A29E] font-medium tracking-wide">LETON KELAKAP 7</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-white tracking-tight">
              Rp {stats.kelakapSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#A8A29E] mt-1.5 border-t border-[#292520] pt-1.5">
              <span>Chapter 6 • Open Air</span>
              <span className="text-sky-300 font-medium">{stats.kelakapOrdersCount} order</span>
            </div>
          </div>
        </div>

        {/* LetGo / Mobile Booth Sales */}
        <div className="bg-[#1C1A17] border border-[#332E27] p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A8A29E] font-medium tracking-wide">LETGO DEPAN MPP</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
              <Store size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-white tracking-tight">
              Rp {stats.letgoSales.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#A8A29E] mt-1.5 border-t border-[#292520] pt-1.5">
              <span>Mobile Coffee Booth</span>
              <span className="text-orange-300 font-medium">{stats.letgoOrdersCount} order</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Status Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#171513] p-3.5 rounded-xl border border-[#2B2722]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-xs text-stone-400">Lunas / Terverifikasi</div>
            <div className="text-base font-bold text-emerald-400">{stats.paidCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-xs text-stone-400">Menunggu QRIS</div>
            <div className="text-base font-bold text-amber-400">{stats.waitingVerifCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400 shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="text-xs text-stone-400">Bayar di Kasir</div>
            <div className="text-base font-bold text-sky-400">{stats.payAtStoreCount} Transaksi</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <div className="text-xs text-stone-400">Ditolak / Batal</div>
            <div className="text-base font-bold text-rose-400">{stats.rejectedCount} Transaksi</div>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#1C1A17] p-3 rounded-xl border border-[#2C2925]">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Cari order #, nama pelanggan, whatsapp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141311] border border-[#2F2B26] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#8E7051]"
            />
          </div>

          {/* Outlet Filter Dropdown */}
          <select
            id="filter-outlet-select"
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="bg-[#141311] border border-[#2F2B26] rounded-lg px-3 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-[#8E7051]"
          >
            <option value="ALL">Semua Outlet</option>
            <option value="sudirman">Sudirman (Chapter 5)</option>
            <option value="kelakap_7">Kelakap 7 (Chapter 6)</option>
            <option value="letgo-mpp">LetGo MPP</option>
          </select>

          {/* Payment Status Dropdown */}
          <select
            id="filter-payment-status-select"
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="bg-[#141311] border border-[#2F2B26] rounded-lg px-3 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-[#8E7051]"
          >
            <option value="ALL">Semua Status Bayar</option>
            <option value="PAID">Lunas (PAID)</option>
            <option value="WAITING_VERIFICATION">Menunggu Verifikasi QRIS</option>
            <option value="PAY_AT_STORE">Bayar di Kasir</option>
            <option value="PAYMENT_REJECTED">Ditolak (REJECTED)</option>
          </select>
        </div>

        <div className="text-xs text-stone-400 flex items-center gap-1">
          Menampilkan <span className="font-semibold text-white">{filteredOrders.length}</span> dari {orders.length} pesanan
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#1C1A17] rounded-xl border border-[#2C2925] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#292622] bg-[#141311] text-[#A8A29E] font-medium">
                <th className="py-3 px-3.5">ORDER #</th>
                <th className="py-3 px-3.5">WAKTU</th>
                <th className="py-3 px-3.5">OUTLET</th>
                <th className="py-3 px-3.5">PELANGGAN</th>
                <th className="py-3 px-3.5">TIPE</th>
                <th className="py-3 px-3.5">ITEMS</th>
                <th className="py-3 px-3.5">PEMBAYARAN</th>
                <th className="py-3 px-3.5">STATUS ORDER</th>
                <th className="py-3 px-3.5 text-right">TOTAL</th>
                <th className="py-3 px-3.5 text-center">BUKTI QRIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26231F]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-stone-500">
                    Tidak ada transaksi ditemukan pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const receiptPath = order.paymentReceiptUrl || order.paymentProofPath || order.paymentReceiptPath;
                  const isPaid = order.paymentStatus === 'PAID';
                  const isWaitingVerif =
                    order.paymentStatus === 'WAITING VERIFICATION' ||
                    order.paymentStatus === 'WAITING_VERIFICATION';
                  const isRejected =
                    order.paymentStatus === 'PAYMENT REJECTED' ||
                    order.paymentStatus === 'REJECTED';

                  return (
                    <tr key={order.id} className="hover:bg-[#221F1B] transition">
                      <td className="py-3 px-3.5 font-mono font-bold text-[#CCA985]">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-3.5 text-stone-400 whitespace-nowrap">
                        <div>{new Date(order.createdAt).toLocaleDateString('id-ID')}</div>
                        <div className="text-[11px] text-stone-500">
                          {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            matchesOutlet(order.outletId, 'sudirman')
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                              : matchesOutlet(order.outletId, 'kelakap_7')
                              ? 'bg-sky-950/60 text-sky-300 border border-sky-800/40'
                              : 'bg-orange-950/60 text-orange-300 border border-orange-800/40'
                          }`}
                        >
                          {matchesOutlet(order.outletId, 'sudirman')
                            ? 'Sudirman'
                            : matchesOutlet(order.outletId, 'kelakap_7')
                            ? 'Kelakap 7'
                            : 'LetGo MPP'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-white">{order.customerName}</div>
                        {order.customerPhone && (
                          <div className="text-[11px] text-stone-500 font-mono">{order.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="text-[11px] text-stone-300 font-medium">
                          {order.orderType}
                        </span>
                        {order.tableNumber && (
                          <span className="text-[10px] text-stone-500 block">Meja {order.tableNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="truncate text-stone-300">
                          {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {order.items.reduce((s, it) => s + it.quantity, 0)} item total
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-stone-200">{order.paymentMethod}</div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                            isPaid
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : isWaitingVerif
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                              : isRejected
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/40'
                              : 'bg-sky-950 text-sky-300 border border-sky-800/40'
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            order.orderStatus === 'COMPLETED'
                              ? 'bg-emerald-900/40 text-emerald-300'
                              : order.orderStatus === 'CANCELLED'
                              ? 'bg-rose-900/40 text-rose-300'
                              : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-white whitespace-nowrap">
                        Rp {order.totalAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {receiptPath ? (
                          <button
                            id={`view-receipt-${order.id}`}
                            onClick={() => setPreviewReceiptUrl(receiptPath)}
                            className="p-1.5 rounded bg-[#2A2621] hover:bg-[#3B352E] text-[#CCA985] hover:text-white transition"
                            title="Lihat Bukti QRIS"
                          >
                            <Eye size={14} />
                          </button>
                        ) : (
                          <span className="text-stone-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox for Payment Receipt Preview */}
      {previewReceiptUrl && (
        <div
          id="receipt-lightbox-modal"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div
            className="bg-[#1C1A17] border border-[#3E3831] rounded-2xl p-4 max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2925]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard size={16} className="text-[#CCA985]" />
                Bukti Pembayaran QRIS Pelanggan
              </h3>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="text-stone-400 hover:text-white text-xs px-2 py-1 rounded bg-[#2A2723]"
              >
                ✕ Tutup
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center">
              <img
                src={previewReceiptUrl}
                alt="Bukti Transfer QRIS"
                className="max-h-[60vh] w-auto object-contain rounded-lg border border-[#332E27]"
              />
            </div>
            <div className="pt-3 border-t border-[#2C2925] flex justify-end gap-2">
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#8E7051] text-xs font-semibold text-white hover:bg-[#735A40] transition"
              >
                Buka Resolusi Penuh
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
