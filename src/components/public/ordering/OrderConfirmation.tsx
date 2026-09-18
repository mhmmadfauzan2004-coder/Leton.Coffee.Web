import React, { useState } from 'react';
import { CustomerOrder, OrderOutlet } from '../../../types';
import { formatRupiah, createWhatsAppLink } from '../../../utils/formatters';
import {
  CheckCircle2,
  Store,
  Clock,
  Utensils,
  Package,
  MessageCircle,
  Home,
  Copy,
  Check,
  Coffee,
  Sparkles,
  Flame,
  ShieldCheck,
  Bell,
  RefreshCw,
} from 'lucide-react';

interface OrderConfirmationProps {
  order: CustomerOrder;
  outlet: OrderOutlet;
  onOrderAgain: () => void;
  onBackToHome: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  outlet,
  onOrderAgain,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // WhatsApp formatted receipt text
  const waItemsText = order.items
    .map((it) => `• ${it.quantity}x ${it.name} (${formatRupiah(it.price * it.quantity)})${it.note ? ` [Note: ${it.note}]` : ''}`)
    .join('\n');

  const waMessage = `*PESANAN BARU LETON COFFEE* ☕
---------------------------------
*No. Order:* ${order.orderNumber}
*Outlet:* ${order.outletName}
*Customer:* ${order.customerName}
*Tipe:* ${order.orderType}${order.orderType === 'DINE IN' ? ` (Meja: ${order.tableNumber})` : ''}
*Metode Bayar:* ${order.paymentMethod}

*Rincian Menu:*
${waItemsText}

*TOTAL:* ${formatRupiah(order.totalAmount)}
*Status:* ${order.paymentStatus}
---------------------------------
Halo Barista Leton Coffee, mohon konfirmasi pesanan saya. Terima kasih!`;

  const waLink = createWhatsAppLink(outlet.whatsapp || '6281234567890', waMessage);

  // Status tracker helper
  const stages = [
    { key: 'WAITING PAYMENT', label: '1. Menunggu Bayar' },
    { key: 'WAITING VERIFICATION', label: '2. Verifikasi' },
    { key: 'PAID', label: '3. Lunas' },
    { key: 'ACCEPTED', label: '4. Diterima' },
    { key: 'PREPARING', label: '5. Sedang Diseduh' },
    { key: 'READY', label: '6. Siap Diantar' },
    { key: 'COMPLETED', label: '7. Selesai' },
  ];

  const getCurrentStepIndex = () => {
    if (order.paymentStatus === 'COMPLETED') return 6;
    if (order.paymentStatus === 'READY') return 5;
    if (order.paymentStatus === 'PREPARING' || order.orderStatus === 'PROCESSING') return 4;
    if (order.paymentStatus === 'PAID') return 2;
    if (order.paymentStatus === 'WAITING VERIFICATION') return 1;
    return 1;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-[#F8FBFF]">
      {/* 1. TOP LIVE ORDER BANNER */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E0F2FE] shadow-sm mb-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E0F2FE] text-[#0284C7] text-xs font-bold font-mono uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
                <span>Live Kitchen Status</span>
              </span>
              <span className="text-xs text-[#64748B] font-mono">
                {order.outletName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="font-mono font-black text-2xl sm:text-4xl text-[#172033] tracking-tight">
                {order.orderNumber}
              </h1>
              <button
                onClick={handleCopyOrderNumber}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0F2FE] text-[#0284C7] text-xs font-bold transition-all cursor-pointer border border-[#E0F2FE]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin No. Order'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#64748B]">
              Atas nama <strong className="text-[#172033]">{order.customerName}</strong> •{' '}
              {order.orderType === 'DINE IN' ? `Dine In di Meja ${order.tableNumber || '-'}` : 'Take Away (Bawa Pulang)'}
            </p>
          </div>

          {/* Time Estimate Badge */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE]">
            <div className="w-10 h-10 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] font-mono uppercase block font-bold">
                Estimasi Penyajian
              </span>
              <span className="font-display font-black text-base text-[#172033]">
                ~5 - 8 Menit
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold block">
                Sedang Diseduh Barista
              </span>
            </div>
          </div>
        </div>

        {/* 7-STAGE PROGRESS TRACKER */}
        <div className="mt-8 pt-6 border-t border-[#E0F2FE]">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {stages.map((stg, idx) => {
              const isPassed = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div
                  key={stg.key}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-[#E0F2FE] border-[#38BDF8] text-[#0284C7] font-bold shadow-sm'
                      : isPassed
                      ? 'bg-white border-[#E0F2FE] text-emerald-700 font-semibold'
                      : 'bg-[#F8FBFF] border-[#E0F2FE] text-[#94A3B8]'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {isPassed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <span className="text-[11px] uppercase tracking-tight">{stg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================= LEFT COLUMN: LIVE KITCHEN & ITEMS ================= */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Live Kitchen Spotlight Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#0284C7]" />
                <h2 className="font-display font-black text-base text-[#172033] uppercase">
                  Live Barista Station
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                Online &amp; Brewing
              </span>
            </div>

            {/* Barista & Roasting Note */}
            <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center font-bold text-lg shrink-0">
                <Sparkles className="w-6 h-6 text-[#0284C7]" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold">
                  Barista Bertugas
                </span>
                <h3 className="text-sm font-bold text-[#172033]">
                  Tim Barista {outlet.shortName || 'Leton'}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Biji kopi artisan freshly pulled &amp; steamed dengan suhu presisi 62°C.
                </p>
              </div>
            </div>

            {/* Quick Help Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Chat Kasir / Barista di WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => alert(`Pelayan telah diberitahu untuk menuju ke ${order.orderType === 'DINE IN' ? `Meja ${order.tableNumber}` : 'kasir'}.`)}
                className="py-3 px-4 rounded-xl bg-[#F0F7FF] hover:bg-[#E0F2FE] text-[#0284C7] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#E0F2FE]"
              >
                <Bell className="w-4 h-4" />
                <span>Panggil Pelayan ke Meja</span>
              </button>
            </div>
          </div>

          {/* Rincian Menu Pesanan */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-base text-[#172033] uppercase">
                Daftar Menu Pesanan
              </h2>
              <span className="text-xs text-[#64748B]">{order.items.length} Macam Menu</span>
            </div>

            <div className="flex flex-col gap-3">
              {order.items.map((item, idx) => {
                const hasSize = item.size && item.size.name;
                const hasTopping = item.topping && item.topping.name !== 'No Topping';
                const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';
                const unitPrice =
                  item.unitPrice ||
                  item.price +
                    (item.size?.price || 0) +
                    (item.topping?.price || 0) +
                    (item.syrup?.price || 0);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#E0F2FE] flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#E0F2FE] flex items-center justify-center font-bold text-[#0284C7] shrink-0 font-mono text-xs">
                        {item.quantity}x
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[#172033]">{item.name}</h3>
                        <div className="text-xs text-[#64748B] mt-0.5 flex flex-wrap gap-1">
                          {hasSize && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono text-[10px] font-bold">
                              Size: {item.size!.name}{item.size!.price > 0 ? ` (+${formatRupiah(item.size!.price)})` : ''}
                            </span>
                          )}
                          {hasTopping && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono text-[10px] font-bold">
                              Top: {item.topping!.name} (+{formatRupiah(item.topping!.price)})
                            </span>
                          )}
                          {hasSyrup && (
                            <span className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-mono text-[10px] font-bold">
                              Syr: {item.syrup!.name} (+{formatRupiah(item.syrup!.price)})
                            </span>
                          )}
                        </div>
                        {item.note && <span className="italic block text-[11px] text-slate-500 mt-1">Catatan: {item.note}</span>}
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <span className="font-bold text-sm text-[#172033] block">
                        {formatRupiah(unitPrice * item.quantity)}
                      </span>
                      <span className="text-[10px] text-[#64748B]">
                        @{formatRupiah(unitPrice)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: PAYMENT & ACTIONS ================= */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Ringkasan Pembayaran */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-sm space-y-4">
            <h2 className="font-display font-black text-base text-[#172033] uppercase">
              Rincian Pembayaran
            </h2>

            <div className="space-y-2 text-xs text-[#64748B]">
              <div className="flex items-center justify-between">
                <span>Metode Bayar</span>
                <span className="font-bold text-[#172033]">{order.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status Pembayaran</span>
                <span className="font-bold text-emerald-600">{order.paymentStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Waktu Transaksi</span>
                <span className="font-bold text-[#172033]">
                  {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} WIB
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E0F2FE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#64748B] block">Total Transaksi</span>
                <span className="font-mono font-black text-2xl text-[#0284C7]">
                  {formatRupiah(order.totalAmount)}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold font-mono">
                Terverifikasi
              </span>
            </div>

            {/* Receipt image preview if uploaded */}
            {order.paymentReceiptUrl && (
              <div className="pt-3 border-t border-[#E0F2FE]">
                <span className="text-xs text-[#64748B] block mb-2 font-bold">Bukti Transfer QRIS:</span>
                <div className="h-36 rounded-xl overflow-hidden border border-[#E0F2FE] bg-[#F8FBFF]">
                  <img
                    src={order.paymentReceiptUrl}
                    alt="Bukti Transfer"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="space-y-3">
            <button
              onClick={onOrderAgain}
              className="w-full py-3.5 px-6 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm tracking-wide uppercase shadow-[0_4px_14px_rgba(2,132,199,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>PESAN MENU TAMBAHAN LAGI</span>
            </button>

            <button
              onClick={onBackToHome}
              className="w-full py-3 px-6 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#172033] font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#0284C7]" />
              <span>Kembali ke Halaman Utama</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
