import React, { useState } from 'react';
import { loginCustomer, registerCustomer } from '../../../utils/supabase';
import { CustomerProfile } from '../../../types';
import { Phone, User, Calendar, Lock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface CustomerAuthFormProps {
  onAuthSuccess: (profile: CustomerProfile) => void;
  onCancel?: () => void;
}

export default function CustomerAuthForm({ onAuthSuccess, onCancel }: CustomerAuthFormProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form States
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset error/success alerts when switching modes
  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setErrorMsg('');
    setSuccessMsg('');
    setNamaLengkap('');
    setNomorHp('');
    setTanggalLahir('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!namaLengkap.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!password) {
      setErrorMsg('Password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginCustomer(namaLengkap, password);
      if (res.success && res.profile) {
        setSuccessMsg('Masuk berhasil! Mengalihkan...');
        setTimeout(() => {
          onAuthSuccess(res.profile!);
        }, 800);
      } else {
        setErrorMsg(res.error || 'Gagal masuk. Silakan periksa kembali Nama Lengkap dan Password Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Validasi Nama Lengkap
    if (!namaLengkap.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }

    // 2. Validasi Nomor HP
    const cleanedPhone = nomorHp.replace(/[^0-9]/g, '');
    if (!cleanedPhone) {
      setErrorMsg('Nomor HP wajib diisi.');
      return;
    }
    if (cleanedPhone.length < 9 || cleanedPhone.length > 15) {
      setErrorMsg('Nomor HP tidak valid (harus 9-15 digit angka).');
      return;
    }

    // 3. Validasi Tanggal Lahir
    if (!tanggalLahir) {
      setErrorMsg('Tanggal Lahir wajib diisi.');
      return;
    }
    const birthDateObj = new Date(tanggalLahir);
    const today = new Date();
    if (birthDateObj >= today) {
      setErrorMsg('Tanggal Lahir tidak valid (tidak bisa di masa depan).');
      return;
    }

    // 4. Validasi Password
    if (!password) {
      setErrorMsg('Password wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password harus minimal 6 karakter.');
      return;
    }

    // 5. Validasi Konfirmasi Password
    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerCustomer(namaLengkap, nomorHp, tanggalLahir, password);
      if (res.success && res.profile) {
        setSuccessMsg('Pendaftaran berhasil! Akun Anda telah siap.');
        setTimeout(() => {
          onAuthSuccess(res.profile!);
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Pendaftaran gagal. Silakan coba lagi.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-2xl border border-[#E4E7EC] shadow-sm">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-[#172033]">
          {isRegisterMode ? 'Daftar Member Leton' : 'Masuk Akun Leton'}
        </h3>
        <p className="text-sm text-[#475467] mt-1.5 leading-relaxed">
          {isRegisterMode
            ? 'Nikmati kemudahan pesan online dan pantau langsung riwayat pesanan Anda.'
            : 'Silakan masuk untuk melanjutkan pemesanan dengan akun Anda.'}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <span className="font-medium leading-normal">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <span className="font-medium leading-normal">{successMsg}</span>
        </div>
      )}

      <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
        {/* Nama Lengkap */}
        <div>
          <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
            Nama Lengkap
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
              <User className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] transition-all"
            />
          </div>
        </div>

        {/* Nomor HP & Tanggal Lahir (Hanya saat Register) */}
        {isRegisterMode && (
          <>
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
                Nomor Handphone (Hanya Angka)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 08123456789"
                  value={nomorHp}
                  onChange={(e) => setNomorHp(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
                Tanggal Lahir
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  required
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] transition-all"
                />
              </div>
            </div>
          </>
        )}

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
            Password {isRegisterMode && <span className="text-gray-400 font-normal">(Min. 6 Karakter)</span>}
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type="password"
              required
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] transition-all"
            />
          </div>
        </div>

        {/* Konfirmasi Password (Hanya saat Register) */}
        {isRegisterMode && (
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Konfirmasi Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] transition-all"
              />
            </div>
          </div>
        )}

        {/* Tombol Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#C39A6B] hover:bg-[#B38A5B] disabled:bg-[#E4E7EC] disabled:text-[#98A2B3] text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-sm focus:outline-none cursor-pointer mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>{isRegisterMode ? 'Daftar Sekarang' : 'Masuk ke Akun'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full text-center text-xs text-[#667085] hover:text-[#344054] transition-colors py-1 cursor-pointer font-medium"
          >
            Kembali ke Pemilihan Menu
          </button>
        )}
      </form>

      {/* Switch Mode Button */}
      <div className="border-t border-[#F2F4F7] mt-5 pt-4 text-center">
        <p className="text-xs text-[#667085]">
          {isRegisterMode ? 'Sudah memiliki akun?' : 'Belum memiliki akun member?'}
          <button
            type="button"
            onClick={toggleMode}
            className="ml-1.5 font-bold text-[#C39A6B] hover:text-[#B38A5B] hover:underline cursor-pointer"
          >
            {isRegisterMode ? 'Masuk di sini' : 'Daftar di sini'}
          </button>
        </p>
      </div>
    </div>
  );
}
