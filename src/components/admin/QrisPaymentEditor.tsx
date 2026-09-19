import React, { useState, useRef } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { uploadImageToSupabase } from '../../utils/supabase';
import {
  QrCode,
  Upload,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';

export const QrisPaymentEditor: React.FC = () => {
  const { data, saveData, showToast } = useContent();
  const currentQris = data.siteSettings?.qrisImage || '';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowedFormats.includes(file.type.toLowerCase())) {
      const err = 'Format file tidak didukung. Pilih file JPG, JPEG, PNG, atau WEBP.';
      setErrorMsg(err);
      showToast(err, 'error');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    // Read preview without modifying or cropping
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFilePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCancelSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Pilih file gambar QRIS terlebih dahulu.', 'error');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // 1. Upload uncompressed raw file directly to Supabase Storage ('leton-images' bucket)
      const res = await uploadImageToSupabase(selectedFile, 'qris', 'qris_official');

      if (!res.success || !res.url) {
        const err = res.error || 'Gagal mengupload file QRIS ke Supabase Storage. QRIS lama tetap digunakan.';
        setErrorMsg(err);
        showToast(err, 'error');
        setIsUploading(false);
        return;
      }

      const newQrisUrl = res.url;

      // 2. Save new QRIS URL to siteSettings in database
      const updatedSiteSettings = {
        ...data.siteSettings,
        qrisImage: newQrisUrl,
      };

      const saveOk = await saveData({
        ...data,
        siteSettings: updatedSiteSettings,
      });

      if (saveOk) {
        showToast('QRIS baru berhasil disimpan dan diaktifkan!', 'success');
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const err = 'Gagal menyimpan URL QRIS ke database. QRIS lama tetap digunakan.';
        setErrorMsg(err);
        showToast(err, 'error');
      }
    } catch (err: any) {
      console.error('Error uploading QRIS:', err);
      const errText = err?.message || 'Terjadi kesalahan saat mengupload QRIS.';
      setErrorMsg(errText);
      showToast(errText, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveQris = async () => {
    try {
      const updatedSiteSettings = {
        ...data.siteSettings,
        qrisImage: '',
      };

      const saveOk = await saveData({
        ...data,
        siteSettings: updatedSiteSettings,
      });

      if (saveOk) {
        showToast('Foto QRIS berhasil dihapus. Sistem kembali menggunakan QRIS default.', 'info');
        setIsDeleteConfirmOpen(false);
      }
    } catch (err: any) {
      showToast('Gagal menghapus QRIS: ' + err.message, 'error');
    }
  };

  const activeDisplayUrl = filePreview || (currentQris ? resolveMediaUrl(currentQris) : null);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00E5FF] text-[10px] font-mono font-bold uppercase tracking-wider">
              CONTENT MANAGEMENT
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-mono">FINANCIAL ASSET</span>
          </div>
          <h2 className="font-display font-black text-2xl text-white tracking-tight uppercase flex items-center gap-3">
            <QrCode className="w-7 h-7 text-[#00E5FF]" />
            <span>QRIS PAYMENT MANAGEMENT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola foto kode QRIS pembayaran toko. Gambar yang tersimpan akan otomatis tampil di halaman Checkout & Payment Modal customer.
          </p>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: QRIS Active Preview */}
        <div className="md:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-center relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-wider">
                PREVIEW QRIS AKTIF
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                {currentQris || filePreview ? 'QRIS TERSIMPAN' : 'DEFAULT SVG'}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl shadow-xl border border-slate-200 relative group flex items-center justify-center min-h-[260px]">
              {activeDisplayUrl ? (
                <img
                  src={activeDisplayUrl}
                  alt="Kode QRIS Active"
                  className="w-full h-auto max-h-72 rounded-xl object-contain"
                />
              ) : (
                <div className="space-y-3 py-6 text-slate-400">
                  <QrCode className="w-16 h-16 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">
                    Belum ada foto QRIS khusus yang diunggah.
                  </p>
                  <span className="text-[10px] font-mono text-cyan-600 block">
                    Customer melihat ilustrasi QRIS SVG bawaan sistem.
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-white">LETON COFFEE OFFICIAL QRIS</p>
              <p className="font-mono text-[10px] text-slate-500">
                Poin pembayaran resmi untuk semua outlet (Sudirman, Kelakap 7, Let'GO).
              </p>
            </div>

            {currentQris && !filePreview && (
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="w-full py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus QRIS Kustom</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Upload / Change QRIS Form */}
        <div className="md:col-span-7 space-y-6">
          <form onSubmit={handleUploadAndSave} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="font-display font-bold text-lg text-white uppercase flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#00E5FF]" />
                <span>UPLOAD / GANTI QRIS</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pilih file gambar QRIS resmi toko Anda. Pastikan kode QRIS terlihat jernih dan dapat dipindai dengan mudah.
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Gagal Mengunggah QRIS</span>
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Custom Dropzone / Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3 ${
                selectedFile
                  ? 'bg-[#00E5FF]/5 border-[#00E5FF]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[#00E5FF]">
                {selectedFile ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <Upload className="w-6 h-6" />}
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white truncate max-w-xs">{selectedFile.name}</p>
                  <p className="text-xs font-mono text-emerald-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Siap diunggah
                  </p>
                  <p className="text-[11px] text-slate-400">Klik lagi untuk mengganti file yang dipilih</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Klik untuk memilih foto QRIS</p>
                  <p className="text-xs text-slate-400">Format yang didukung: JPG, JPEG, PNG, WEBP</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-2">
                    Kualitas foto asli dipertahankan tanpa kompresi merusak.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleCancelSelectedFile}
                  disabled={isUploading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
              )}

              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-[#00E5FF]/20 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengunggah ke Storage...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SIMPAN QRIS BARU</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Verification & Safety Guarantee Banner */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#00E5FF] uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>JAMINAN SINKRONISASI &amp; KEAMANAN</span>
            </div>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>File tersimpan secara permanen di Supabase Storage bucket <code className="text-slate-200">leton-images</code>.</li>
              <li>QRIS lama tidak akan dihapus sebelum file baru berhasil terunggah secara utuh.</li>
              <li>Tampilan pelanggan pada saat Checkout dan Payment Modal akan otomatis menggunakan QRIS terbaru setelah disimpan.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-display font-bold text-lg text-white uppercase">HAPUS QRIS KUSTOM</h3>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin menghapus foto QRIS kustom saat ini? Sistem akan kembali menggunakan QRIS ilustrasi default.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemoveQris}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs tracking-wider uppercase cursor-pointer"
              >
                Ya, Hapus QRIS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
