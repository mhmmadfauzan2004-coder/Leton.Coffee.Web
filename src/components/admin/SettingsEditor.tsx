import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  setCustomSupabaseCredentials,
  isSupabaseConfigured,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_TABLE_NAME,
  fetchContentFromSupabase,
  saveContentToSupabase,
} from '../../utils/supabase';
import {
  KeyRound,
  User,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Check,
  Loader2,
  Database,
  CloudUpload,
  Radio,
} from 'lucide-react';

export const SettingsEditor: React.FC = () => {
  const { auth, data, changeCredentials, resetToDefaults, showToast, isRealtimeConnected, saveData } = useContent();

  // Supabase Cloud Config State
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSupabaseUrlInput(getSupabaseUrl());
    const currentKey = getSupabaseAnonKey();
    if (currentKey && currentKey !== 'GANTI_DENGAN_ANON_KEY_YANG_SUDAH_DIKOPY') {
      setSupabaseKeyInput(currentKey);
    }
  }, []);

  const handleSaveSupabaseCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseStatusMsg(null);

    const cleanKey = supabaseKeyInput.trim();
    const cleanUrl = supabaseUrlInput.trim() || 'https://galwyavdonfzuibrmswt.supabase.co';

    if (!cleanKey || cleanKey.length < 20) {
      setSupabaseStatusMsg({
        type: 'error',
        text: 'Anon Key tidak valid. Silakan salin "anon public key" dari Supabase Dashboard > Project Settings > API.',
      });
      return;
    }

    setIsTestingSupabase(true);
    try {
      setCustomSupabaseCredentials(cleanKey, cleanUrl);
      
      // Also automatically push current data to initialize table
      const res = await saveContentToSupabase(data);
      if (res.success) {
        setSupabaseStatusMsg({
          type: 'success',
          text: 'Koneksi Supabase aktif & seluruh data CMS saat ini berhasil disinkronkan ke cloud!',
        });
        showToast('Koneksi Supabase berhasil disimpan & disinkronkan!', 'success');
      } else {
        setSupabaseStatusMsg({
          type: 'success',
          text: 'Kredensial disimpan! (Catatan: Pastikan tabel "leton_content" sudah dibuat di SQL Editor).',
        });
        showToast('Kredensial Supabase berhasil disimpan!', 'info');
      }
    } catch (err: any) {
      setSupabaseStatusMsg({
        type: 'error',
        text: 'Gagal menguji koneksi: ' + (err?.message || 'Pastikan Anon Key benar'),
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleManualSyncToCloud = async () => {
    setIsSyncingData(true);
    try {
      const res = await saveContentToSupabase(data);
      if (res.success) {
        setSupabaseStatusMsg({
          type: 'success',
          text: 'Semua foto, menu, dan teks berhasil di-upload & disinkronkan ke Supabase Cloud!',
        });
        showToast('Semua data berhasil disinkronkan ke Supabase!', 'success');
      } else {
        setSupabaseStatusMsg({
          type: 'error',
          text: 'Gagal sinkronisasi: ' + (res.error || 'Pastikan tabel leton_content memiliki izin RLS public'),
        });
        showToast('Gagal sinkronisasi ke Supabase', 'error');
      }
    } catch (err: any) {
      setSupabaseStatusMsg({
        type: 'error',
        text: 'Error saat sinkronisasi: ' + (err?.message || 'Periksa koneksi internet'),
      });
    } finally {
      setIsSyncingData(false);
    }
  };

  // Password change form
  const [newUsername, setNewUsername] = useState(auth.username || 'admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Reset confirmation
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPassword) {
      setPassError('Password saat ini harus diisi.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setPassError('Konfirmasi password baru tidak cocok.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setPassError('Password baru minimal 6 karakter.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changeCredentials(currentPassword, newUsername, newPassword || undefined);
      if (res.success) {
        setPassSuccess('Kredensial login berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(res.error || 'Gagal mengubah kredensial.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      await resetToDefaults();
      setIsResetConfirmOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="pb-6 border-b border-slate-800">
        <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
          PENGATURAN & KEAMANAN AKUN
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Kelola kredensial login admin CMS, keamanan autentikasi, dan opsi reset data.
        </p>
      </div>

      {/* Supabase Cloud Connection Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-[#2563EB]/40 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-white">KONEKSI SUPABASE CLOUD</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isRealtimeConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  {isRealtimeConnected ? 'TERHUBUNG' : 'PERIKSA KEY'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Database Tabel: <code className="text-cyan-300 font-mono">{SUPABASE_TABLE_NAME}</code> • Storage Bucket: <code className="text-cyan-300 font-mono">{SUPABASE_STORAGE_BUCKET}</code>
              </p>
            </div>
          </div>
        </div>

        {supabaseStatusMsg && (
          <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            supabaseStatusMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}>
            {supabaseStatusMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{supabaseStatusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSupabaseCredentials} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={supabaseUrlInput}
              onChange={(e) => setSupabaseUrlInput(e.target.value)}
              placeholder="https://galwyavdonfzuibrmswt.supabase.co"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Supabase Anon Public API Key (Dari Dashboard Supabase &gt; Project Settings &gt; API)
            </label>
            <input
              type="text"
              value={supabaseKeyInput}
              onChange={(e) => setSupabaseKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-[#2563EB]"
            />
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Anda bisa menyalin Anon Key ini langsung dari Supabase Dashboard &gt; <b>Project Settings</b> &gt; <b>API</b> &gt; <b>Project API keys (anon public)</b>.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleManualSyncToCloud}
              disabled={isSyncingData || !supabaseKeyInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isSyncingData ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <RotateCcw className="w-4 h-4 text-cyan-400" />
              )}
              <span>{isSyncingData ? 'Menyinkronkan...' : 'Sinkronkan Semua Data CMS ke Cloud'}</span>
            </button>

            <button
              type="submit"
              disabled={isTestingSupabase}
              className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#3b82f6] text-white font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isTestingSupabase ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4" />
              )}
              <span>{isTestingSupabase ? 'Menghubungkan...' : 'Simpan & Tes Koneksi Supabase'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Account Credentials Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-[#00E5FF]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-white">GANTI KREDENSIAL ADMIN</h3>
            <p className="text-xs text-slate-400">
              Perbarui username atau password login Anda ke CMS.
            </p>
          </div>
        </div>

        {passError && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{passError}</span>
          </div>
        )}

        {passSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{passSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Username Admin Baru / Aktif
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                Password Baru (Opsional)
              </label>
              <input
                type="password"
                placeholder="Kosongkan jika tidak ingin ganti"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                Ulangi Password Baru
              </label>
              <input
                type="password"
                placeholder="Konfirmasi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-mono font-semibold tracking-wider text-amber-400 uppercase mb-2">
              Password Saat Ini (Wajib untuk Konfirmasi Perubahan)
            </label>
            <input
              type="password"
              required
              placeholder="Masukkan password saat ini (Default: LetonAdmin2026!)"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPass}
              className="px-6 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isChangingPass ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{isChangingPass ? 'Memperbarui...' : 'Simpan Kredensial Baru'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Reset to Defaults Card */}
      <div className="p-6 rounded-3xl bg-slate-900/50 border border-rose-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-display font-bold text-sm uppercase">
            <RotateCcw className="w-4 h-4" />
            <span>Reset Konten ke Bawaan Awal</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Kembalikan semua teks, menu, dan cabang Leton Coffee ke konfigurasi awal project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-rose-950 border border-rose-500/30 text-rose-300 text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer shrink-0"
        >
          Reset Data Default
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-500/50 p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="font-display font-bold text-lg text-white">Reset Semua Data?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Semua teks dan menu akan dikembalikan ke data default Leton Coffee. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs tracking-wider uppercase shadow-lg shadow-rose-900/30 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? 'Mereset...' : 'Ya, Reset Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
