import React, { useRef } from 'react';
import { CustomerOrder } from '../../types';
import { formatRupiah, formatOrderDateTime, formatOrderDate, formatOrderTime } from '../../utils/formatters';
import { X, Printer, Phone, MapPin, ClipboardList, Clock, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KitchenSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CustomerOrder | null;
}

export const KitchenSlipModal: React.FC<KitchenSlipModalProps> = ({ isOpen, onClose, order }) => {
  const slipRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    // We can print using window.print() or a print-specific iframe to prevent printing the whole page.
    // Creating a hidden iframe is the cleanest way to print ONLY the receipt without layout shifts or hiding admin page elements.
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) return;

    // Build printer-friendly styled HTML matching thermal roll printers (58mm or 80mm)
    const itemsHtml = (order.items || [])
      .map((it) => {
        const sizeText = it.size && it.size.name ? `[Size: ${it.size.name}]` : '';
        const toppingText = it.topping && it.topping.name !== 'No Topping' ? `+ Topping: ${it.topping.name}` : '';
        const syrupText = it.syrup && it.syrup.name !== 'No Syrup' ? `+ Syrup: ${it.syrup.name}` : '';
        const customText = it.customOptions && it.customOptions.length > 0
          ? it.customOptions.map((co) => `+ ${co.groupName}: ${co.optionName}`).join('\n')
          : '';
        const noteText = it.note ? `* Catatan: "${it.note}"` : '';

        const addonsList = [sizeText, toppingText, syrupText, customText, noteText]
          .filter(Boolean)
          .join('\n');

        return `
          <div style="border-bottom: 1px dashed #ccc; padding: 6px 0; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; font-weight: bold;">
              <span>${it.quantity}x ${it.name}</span>
              <span>${formatRupiah((it.unitPrice || it.price) * it.quantity)}</span>
            </div>
            ${addonsList ? `<pre style="font-family: monospace; font-size: 11px; color: #444; margin: 4px 0 0 12px; white-space: pre-wrap; line-height: 1.2;">${addonsList}</pre>` : ''}
          </div>
        `;
      })
      .join('');

    const slipContent = `
      <html>
        <head>
          <title>Order Slip - ${order.orderNumber}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              background: #fff;
              padding: 10px;
              width: 280px; /* Standard 58mm/80mm receipt format width */
              margin: 0 auto;
              line-height: 1.3;
              font-size: 12px;
            }
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 18px;
              margin: 0;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .header p {
              margin: 2px 0;
              font-size: 11px;
            }
            .bold {
              font-weight: bold;
            }
            .flex-between {
              display: flex;
              justify-content: space-between;
            }
            .badge {
              border: 1px solid #000;
              padding: 2px 6px;
              display: inline-block;
              font-weight: bold;
              margin-top: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LETON COFFEE</h1>
            <p>${order.outletName || 'Cabang Leton'}</p>
            <div class="dashed-line"></div>
            <p class="bold" style="font-size: 14px;">SLIP DAPUR / BARISTA</p>
            <span class="badge">${order.orderNumber}</span>
          </div>

          <div style="font-size: 11px;">
            <div class="flex-between">
              <span>TANGGAL:</span>
              <span class="bold">${formatOrderDate(order.createdAt)}</span>
            </div>
            <div class="flex-between">
              <span>JAM ORDER:</span>
              <span class="bold">${formatOrderTime(order.createdAt)}</span>
            </div>
            <div class="flex-between" style="background-color: #fef3c7; padding: 2px 4px; margin: 2px 0;">
              <span class="bold" style="color: #92400e;">JAM AMBIL:</span>
              <span class="bold" style="color: #92400e; font-size: 13px;">${order.pickupTime || order.pickup_time || '-'}</span>
            </div>
            <div class="flex-between">
              <span>TIPE:</span>
              <span class="bold">${order.orderType} ${order.tableNumber ? `(MEJA ${order.tableNumber})` : ''}</span>
            </div>
            <div class="flex-between">
              <span>CUSTOMER:</span>
              <span class="bold">${order.customerName}</span>
            </div>
            ${order.customerPhone ? `
            <div class="flex-between">
              <span>WHATSAPP:</span>
              <span>${order.customerPhone}</span>
            </div>
            ` : ''}
          </div>

          <div class="dashed-line"></div>

          <div class="items-list">
            ${itemsHtml}
          </div>

          <div style="margin-top: 8px; font-size: 12px;">
            <div class="flex-between">
              <span>TOTAL HARGA</span>
              <span class="bold">${formatRupiah(order.totalAmount)}</span>
            </div>
            <div class="flex-between">
              <span>METODE BAYAR</span>
              <span>${order.paymentMethod} (${order.paymentStatus === 'PAID' ? 'LUNAS' : 'BELUM VERIFIKASI'})</span>
            </div>
          </div>

          ${order.customerNote ? `
            <div class="dashed-line"></div>
            <div style="font-size: 11px; background-color: #eee; padding: 4px;">
              <span class="bold">CATATAN CUSTOMER:</span>
              <p style="margin: 2px 0 0 0; font-style: italic;">"${order.customerNote}"</p>
            </div>
          ` : ''}

          <div class="dashed-line"></div>
          <div class="footer">
            <p>* TERIMA KASIH & SELAMAT MENIKMATI *</p>
          </div>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() {
                window.parent.document.body.removeChild(window.frameElement);
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    frameDoc.open();
    frameDoc.write(slipContent);
    frameDoc.close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="kitchen-slip-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if ((e.target as HTMLElement).id === 'kitchen-slip-modal-overlay') {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#00E5FF]" />
                <div>
                  <h3 className="font-display font-black text-white text-sm uppercase tracking-wider">
                    Kitchen / Bar Slip Preview
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {order.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Receipt Body */}
            <div className="p-6 overflow-y-auto bg-slate-900 flex-1 flex flex-col items-center">
              <div
                ref={slipRef}
                className="w-full bg-white text-slate-900 p-6 shadow-md relative rounded-lg border-2 border-slate-200"
                style={{
                  backgroundImage: 'radial-gradient(circle, transparent 20%, #020617 20%, #020617 80%, transparent 80%, transparent), radial-gradient(circle, transparent 20%, #020617 20%, #020617 80%, transparent 80%, transparent)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 4px 4px'
                }}
              >
                {/* Simulated receipt serration / dashed edge top */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-b from-slate-200 to-transparent flex overflow-hidden">
                  <div className="w-full border-t-2 border-dashed border-slate-400"></div>
                </div>

                {/* Thermal Ticket Content */}
                <div className="pt-2 pb-2 text-slate-900">
                  {/* Brand logo & slip identity */}
                  <div className="text-center space-y-1 mb-5">
                    <h4 className="font-black font-display tracking-widest text-lg text-slate-950">
                      LETON COFFEE
                    </h4>
                    <p className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{order.outletName}</span>
                    </p>
                    <div className="border-t border-dashed border-slate-300 my-2"></div>
                    <span className="inline-block bg-slate-950 text-white font-mono font-black text-sm px-3.5 py-1 rounded tracking-wider">
                      {order.orderNumber}
                    </span>
                    <p className="font-mono text-[11px] text-slate-500 font-bold mt-1 uppercase">
                      SLIP DAPUR & BARISTA
                    </p>
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-1.5 font-mono text-xs border-b border-dashed border-slate-300 pb-3 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">TANGGAL:</span>
                      <span className="font-bold text-slate-900">
                        {formatOrderDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">JAM ORDER:</span>
                      <span className="font-bold text-slate-900">
                        {formatOrderTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between bg-amber-50 p-1.5 rounded border border-amber-200">
                      <span className="font-bold text-amber-900 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-700" />
                        JAM AMBIL:
                      </span>
                      <span className="font-black text-amber-950 font-mono text-xs">
                        {order.pickupTime || order.pickup_time || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">TIPE:</span>
                      <span className="font-bold text-red-600 bg-red-50 px-1 rounded">
                        {order.orderType} {order.tableNumber ? `(MEJA ${order.tableNumber})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CUSTOMER:</span>
                      <span className="font-bold text-slate-950">{order.customerName}</span>
                    </div>
                    {order.customerPhone && (
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-slate-500">WA/TELP:</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {order.customerPhone}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Items list with robust customizations and notes */}
                  <div className="space-y-3.5 pb-3 border-b border-dashed border-slate-300 mb-3">
                    {(order.items || []).map((it, idx) => {
                      const hasSize = it.size && it.size.name;
                      const hasTopping = it.topping && it.topping.name !== 'No Topping';
                      const hasSyrup = it.syrup && it.syrup.name !== 'No Syrup';
                      const hasCustomOptions = it.customOptions && it.customOptions.length > 0;

                      return (
                        <div key={idx} className="space-y-1 border-b border-dotted border-slate-100 last:border-0 pb-2 last:pb-0">
                          {/* Qty & Item Name Row */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2">
                              <span className="font-mono font-black text-slate-950 bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                                {it.quantity}x
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                {it.name}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-950 text-xs shrink-0 mt-0.5">
                              {formatRupiah((it.unitPrice || it.price) * it.quantity)}
                            </span>
                          </div>

                          {/* Extra modifications and addons list with highly readable look */}
                          <div className="pl-8 space-y-0.5">
                            {hasSize && (
                              <p className="text-[11px] font-mono font-bold text-indigo-700">
                                Size: {it.size!.name}
                              </p>
                            )}
                            {hasTopping && (
                              <p className="text-[11px] font-mono text-cyan-700">
                                + Topping: {it.topping!.name}
                              </p>
                            )}
                            {hasSyrup && (
                              <p className="text-[11px] font-mono text-pink-700">
                                + Syrup: {it.syrup!.name}
                              </p>
                            )}
                            {hasCustomOptions &&
                              it.customOptions!.map((co, cidx) => (
                                <p key={cidx} className="text-[11px] font-mono text-emerald-700">
                                  + {co.groupName}: {co.optionName}
                                </p>
                              ))
                            }
                            {it.note && (
                              <p className="text-[11px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 italic">
                                Catatan: "{it.note}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Footer of Thermal Paper */}
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-slate-900">
                      <span>METODE BAYAR:</span>
                      <span className="font-bold">{order.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>STATUS BAYAR:</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {order.paymentStatus === 'PAID' ? 'PAID (LUNAS)' : 'BELUM VERIFIKASI'}
                      </span>
                    </div>
                    <div className="border-t border-dotted border-slate-300 pt-2 flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-950">TOTAL AMOUNT:</span>
                      <span className="font-black text-slate-950 text-base">
                        {formatRupiah(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Big prominent customer instruction box */}
                  {order.customerNote && (
                    <div className="mt-4 p-2.5 bg-yellow-50 border border-yellow-200 rounded-md text-[11px] font-mono">
                      <strong className="text-yellow-800 block mb-0.5 uppercase">
                        ⚠️ Catatan Kasir / Dapur:
                      </strong>
                      <span className="text-slate-800 font-bold italic">
                        "{order.customerNote}"
                      </span>
                    </div>
                  )}

                  <div className="text-center font-mono text-[10px] text-slate-400 mt-5 border-t border-dashed border-slate-200 pt-3">
                    * LETON COFFEE KITCHEN TICKET *
                  </div>
                </div>

                {/* Simulated receipt serration / dashed edge bottom */}
                <div className="absolute bottom-0 inset-x-0 h-1.5 bg-gradient-to-t from-slate-200 to-transparent flex overflow-hidden">
                  <div className="w-full border-b-2 border-dashed border-slate-400"></div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Controls */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:flex-1 px-5 py-3 rounded-xl bg-[#00E5FF] hover:bg-cyan-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Slip Dapur</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
