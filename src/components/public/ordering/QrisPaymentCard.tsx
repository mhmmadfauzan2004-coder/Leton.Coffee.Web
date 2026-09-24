import React, { useState, useRef } from 'react';
import { OrderOutlet } from '../../../types';
import { useContent } from '../../../context/ContentContext';
import { resolveMediaUrl } from '../../../utils/api';
import { formatRupiah } from '../../../utils/formatters';
import {
  QrCode,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Eye,
  RefreshCw,
  Maximize2,
  Download,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QrisPaymentCardProps {
  totalAmount: number;
  outlet: OrderOutlet;
  uploadedReceiptUrl: string | null;
  uploadedReceiptPath?: string | null;
  isUploading: boolean;
  uploadError: string | null;
  onReceiptUploaded: (url: string, path?: string) => void;
  onClearReceipt: () => void;
  onUploadFile: (file: File) => Promise<void>;
}

export const QrisPaymentCard: React.FC<QrisPaymentCardProps> = ({
  totalAmount,
  outlet,
  uploadedReceiptUrl,
  isUploading,
  uploadError,
  onClearReceipt,
  onUploadFile,
}) => {
  const { data } = useContent();
  const activeQrisUrl = outlet.qrisImage || data.siteSettings?.qrisImage || '';

  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [localFileError, setLocalFileError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isQrisVisible, setIsQrisVisible] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  const validateAndProcessFile = async (file: File) => {
    setLocalFileError(null);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isValidType = allowedFormats.includes(file.type) || allowedExtensions.includes(ext);

    if (!isValidType) {
      setLocalFileError('Format file tidak didukung. Format yang diperbolehkan hanya: JPG, JPEG, PNG, WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setLocalFileError('Ukuran file terlalu besar. Maksimal 10MB.');
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');

    await onUploadFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // High quality SVG QR code representing Leton Coffee QRIS
  const qrisSvgVisual = (
    <div className="relative w-full max-w-[260px] mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200">
      {/* Official QRIS Header */}
      <div className="border-b border-slate-200 pb-2 mb-3 text-center">
        <div className="flex items-center justify-between px-1">
          <span className="font-black font-sans text-xs tracking-tighter text-rose-600">QRIS</span>
          <span className="text-[9px] font-mono text-slate-500 font-semibold tracking-tight">GPN</span>
        </div>
        <p className="text-[8px] font-sans text-slate-500 uppercase tracking-widest leading-none mt-0.5">
          Quick Response Code Indonesian Standard
        </p>
      </div>

      {/* Merchant Title */}
      <div className="text-center mb-2">
        <span className="font-display font-black text-xs text-slate-900 uppercase block tracking-wider">
          LETON COFFEE
        </span>
        <span className="text-[9px] font-mono text-slate-500 block">
          NMID: ID1020261988294 • A01
        </span>
      </div>

      {/* QR Code Graphic */}
      <div className="relative aspect-square w-full bg-white p-2 rounded-xl flex items-center justify-center border border-slate-100">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full text-slate-950"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer corner square top-left */}
          <rect x="10" y="10" width="55" height="55" fill="currentColor" />
          <rect x="18" y="18" width="39" height="39" fill="white" />
          <rect x="25" y="25" width="25" height="25" fill="currentColor" />

          {/* Outer corner square top-right */}
          <rect x="135" y="10" width="55" height="55" fill="currentColor" />
          <rect x="143" y="18" width="39" height="39" fill="white" />
          <rect x="150" y="25" width="25" height="25" fill="currentColor" />

          {/* Outer corner square bottom-left */}
          <rect x="10" y="135" width="55" height="55" fill="currentColor" />
          <rect x="18" y="143" width="39" height="39" fill="white" />
          <rect x="25" y="150" width="25" height="25" fill="currentColor" />

          {/* Data matrix dots & patterns */}
          <rect x="75" y="15" width="10" height="10" />
          <rect x="95" y="15" width="10" height="10" />
          <rect x="115" y="15" width="10" height="10" />
          <rect x="75" y="35" width="20" height="10" />
          <rect x="105" y="35" width="10" height="20" />
          <rect x="75" y="55" width="10" height="10" />
          <rect x="115" y="55" width="10" height="10" />

          <rect x="15" y="75" width="10" height="20" />
          <rect x="35" y="75" width="20" height="10" />
          <rect x="75" y="75" width="15" height="15" />
          <rect x="100" y="75" width="20" height="10" />
          <rect x="135" y="75" width="10" height="20" />
          <rect x="155" y="75" width="15" height="10" />
          <rect x="175" y="75" width="15" height="20" />

          <rect x="15" y="105" width="20" height="10" />
          <rect x="45" y="95" width="10" height="20" />
          <rect x="135" y="105" width="20" height="10" />
          <rect x="165" y="105" width="15" height="15" />

          <rect x="75" y="135" width="15" height="15" />
          <rect x="100" y="135" width="10" height="20" />
          <rect x="120" y="135" width="20" height="10" />
          <rect x="150" y="135" width="15" height="10" />
          <rect x="175" y="135" width="15" height="15" />

          <rect x="75" y="160" width="20" height="10" />
          <rect x="105" y="165" width="15" height="15" />
          <rect x="130" y="155" width="15" height="25" />
          <rect x="155" y="165" width="15" height="10" />
          <rect x="175" y="160" width="15" height="20" />

          {/* Center Brand Badge with Leton aesthetic */}
          <rect x="72" y="72" width="56" height="56" rx="8" fill="white" stroke="#00E5FF" strokeWidth="2" />
          <circle cx="100" cy="100" r="22" fill="#0A0F1D" />
          <text
            x="100"
            y="105"
            fill="#00E5FF"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            LTN
          </text>
        </svg>
      </div>

      {/* QRIS Supported Methods strip */}
      <div className="mt-3 pt-2 border-t border-slate-100 text-center">
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
          SATU QRIS UNTUK SEMUA PEMBAYARAN
        </span>
        <span className="text-[8px] font-sans text-slate-600 block">
          BCA • Mandiri • BRI • BNI • GoPay • OVO • DANA • ShopeePay • LinkAja
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Guidance */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00E5FF]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
                METODE PEMBAYARAN
              </span>
              <span className="font-display font-black text-sm text-white uppercase tracking-wide">
                QRIS (Scan & Transfer)
              </span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00E5FF] text-[10px] font-mono uppercase tracking-wider">
            Instan & Praktis
          </span>
        </div>

        <p className="text-xs text-slate-300 font-medium">
          “Silakan lakukan pembayaran menggunakan QRIS”
        </p>
      </div>

      {/* QRIS Code Box */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-950 border border-slate-800 relative overflow-hidden flex flex-col items-center text-center">
        {/* Ambient subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none" />

        {/* The QRIS Visual Toggle */}
        <div className="w-full relative z-10">
          {!isQrisVisible ? (
            <div className="py-4 px-2 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-[#00E5FF]">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">
                  Pembayaran QRIS
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Silakan lakukan pembayaran menggunakan QRIS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQrisVisible(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#00cce6] text-slate-950 font-black text-xs shadow-lg shadow-[#00E5FF]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <QrCode className="w-4 h-4" />
                <span>TAMPILKAN QRIS</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              {/* Notice & Hide Button */}
              <div className="w-full mb-3 pb-2.5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#00E5FF] text-center sm:text-left">
                  Silahkan screenshot dan melakukan pembayaran dengan QRIS ini
                </p>
                <button
                  type="button"
                  onClick={() => setIsQrisVisible(false)}
                  className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  SEMBUNYIKAN QRIS
                </button>
              </div>

              {activeQrisUrl ? (
                <div className="max-w-[260px] mx-auto bg-white p-3 rounded-2xl shadow-xl border border-slate-200">
                  <img
                    src={resolveMediaUrl(activeQrisUrl)}
                    alt="QRIS Leton Coffee"
                    className="w-full h-auto rounded-xl object-contain max-h-80"
                  />
                </div>
              ) : (
                qrisSvgVisual
              )}

              {/* Quick Action under QR */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Perbesar QRIS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Total Price Prominent Display */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 w-full max-w-sm">
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider block">
            Total Pembayaran:
          </span>
          <span className="font-mono font-black text-2xl sm:text-3xl text-[#00E5FF] tracking-tight block mt-1">
            {formatRupiah(totalAmount)}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">
            Pastikan nominal transfer tepat sebesar <strong>{formatRupiah(totalAmount)}</strong>
          </p>
        </div>
      </div>

      {/* Step-by-Step Payment Instructions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-display font-bold text-white text-xs uppercase tracking-wide">
          <Smartphone className="w-4 h-4 text-[#00E5FF]" />
          <span>Langkah Pembayaran:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 leading-relaxed">
          <li>Buka aplikasi m-Banking atau e-Wallet favorit Anda (BCA, Mandiri, GoPay, OVO, DANA, dll).</li>
          <li>Arahkan kamera / scan gambar QRIS Leton Coffee di atas.</li>
          <li>Pastikan nama merchant adalah <strong>LETON COFFEE</strong> dan nominal sesuai (<strong>{formatRupiah(totalAmount)}</strong>).</li>
          <li>Selesaikan transaksi dan <strong>screenshot / simpan bukti transfernya</strong>.</li>
        </ol>
      </div>

      {/* Upload Field Section */}
      <div className="space-y-3">
        <div>
          <label className="font-display font-bold text-sm text-white uppercase tracking-wide block">
            Upload Bukti Pembayaran <span className="text-rose-400">*</span>
          </label>
          <p className="text-xs text-slate-400 mt-0.5">
            “Setelah melakukan pembayaran, upload bukti pembayaran.” Format yang diperbolehkan: <strong>JPG, JPEG, PNG, WEBP</strong>.
          </p>
        </div>

        {/* Hidden native input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="qris-receipt-file-input"
        />

        {/* Upload Dropzone / Success Preview Card */}
        {uploadedReceiptUrl ? (
          /* Success State Card */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 sm:p-5 rounded-2xl bg-emerald-950/30 border-2 border-emerald-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div
                onClick={() => setIsPreviewModalOpen(true)}
                className="w-16 h-16 rounded-xl bg-slate-900 border border-emerald-500/40 overflow-hidden relative shrink-0 cursor-pointer group"
                title="Klik untuk melihat bukti pembayaran"
              >
                <img
                  src={uploadedReceiptUrl}
                  alt="Bukti Transfer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-display font-bold text-sm text-emerald-300 truncate">
                    Bukti Pembayaran Terunggah
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono truncate mt-0.5">
                  {selectedFileName || 'bukti_transfer.jpg'}
                </p>
                {selectedFileSize && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Ukuran: {selectedFileSize} • Supabase Storage
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Lihat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Ganti File</span>
              </button>

              <button
                type="button"
                onClick={onClearReceipt}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                title="Hapus Bukti"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* Dropzone Upload Button */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center relative overflow-hidden group ${
              isDragOver
                ? 'border-[#00E5FF] bg-cyan-500/10'
                : 'border-slate-700 hover:border-[#00E5FF]/70 bg-slate-900/60 hover:bg-slate-900/90'
            }`}
          >
            {isUploading ? (
              <div className="py-3 flex flex-col items-center">
                <span className="w-8 h-8 border-2 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full animate-spin mb-3" />
                <p className="font-display font-bold text-sm text-white uppercase tracking-wide">
                  Mengunggah Bukti ke Supabase Storage...
                </p>
                <span className="text-xs text-slate-400 mt-1">Harap tunggu sejenak</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 group-hover:border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-display font-bold text-sm text-white tracking-wide">
                  Pilih atau Tarik File Bukti Transfer ke Sini
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Format yang didukung: <strong className="text-slate-200">JPG, JPEG, PNG, WEBP</strong> (Maks. 10MB)
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 group-hover:bg-[#2563EB] text-white text-xs font-display font-bold uppercase tracking-wider transition-colors shadow-sm">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Pilih File Bukti Pembayaran</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error Messages */}
        {(localFileError || uploadError) && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{localFileError || uploadError}</span>
          </div>
        )}

        {/* Mandatory Upload Notice */}
        {!uploadedReceiptUrl && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Perhatian:</strong> Bukti transfer WAJIB diupload sebelum Anda dapat menekan tombol <strong>PLACE ORDER</strong>.
            </span>
          </div>
        )}

        {uploadedReceiptUrl && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <span>
              Bukti transfer berhasil terpasang. Status order akan otomatis diset ke <strong>WAITING VERIFICATION</strong> setelah Anda menekan tombol Place Order.
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen QR Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center relative">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">
              QRIS LETON COFFEE
            </h3>
            <p className="text-xs text-slate-400">
              Pindai kode QRIS di bawah menggunakan aplikasi e-wallet atau m-banking
            </p>

            <div className="py-2 flex justify-center">
              {activeQrisUrl ? (
                <img
                  src={resolveMediaUrl(activeQrisUrl)}
                  alt="QRIS Leton"
                  className="w-full max-w-[280px] rounded-2xl object-contain max-h-[60vh]"
                />
              ) : (
                qrisSvgVisual
              )}
            </div>

            <div className="font-mono font-black text-xl text-[#00E5FF]">
              Total: {formatRupiah(totalAmount)}
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-xs uppercase tracking-wider"
            >
              TUTUP POPUP QRIS
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Preview Modal */}
      {isPreviewModalOpen && uploadedReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white uppercase">
                  Bukti Pembayaran Terunggah
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedFileName || 'Bukti Transfer'}
                </span>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl bg-black/60 p-2 flex items-center justify-center">
              <img
                src={uploadedReceiptUrl}
                alt="Bukti Transfer Penuh"
                className="max-h-[60vh] w-auto object-contain rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              KEMBALI KE CHECKOUT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
