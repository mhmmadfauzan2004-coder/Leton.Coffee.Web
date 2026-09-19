import React, { useState } from 'react';
import { loginCustomer, registerCustomer } from '../../../utils/supabase';
import { CustomerProfile } from '../../../types';
import { Phone, User, Calendar, Lock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface CustomerAuthFormProps {
  onAuthSuccess: (profile: CustomerProfile) => void;
}

export default function CustomerAuthForm({ onAuthSuccess }: CustomerAuthFormProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Register Form States
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Login Form States (Nama Lengkap & Password)
  const [loginNama, setLoginNama] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Clear any existing alert messages when user types in any input
  const clearAlerts = () => {
    if (errorMsg) setErrorMsg('');
    if (successMsg) setSuccessMsg('');
  };

  // Reset error/success alerts when switching modes
  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setErrorMsg('');
    setSuccessMsg('');
    setNamaLengkap('');
    setNomorHp('');
    setTanggalLahir('');
    setRegPassword('');
    setConfirmPassword('');
    setLoginNama('');
    setLoginPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const cleanInput = loginNama.trim();
    if (!cleanInput) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginCustomer(cleanInput, loginPassword);
      if (res.success && res.profile) {
        setSuccessMsg('Masuk berhasil! Mengalihkan ke pemilihan outlet...');
        setTimeout(() => {
          onAuthSuccess(res.profile!);
        }, 350);
      } else {
        setErrorMsg(res.error || 'Nama Lengkap atau Password salah.');
      }
    } catch (err: any) {
      setErrorMsg('Nama Lengkap atau Password salah.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    // 1. Validasi Nama Lengkap
    const cleanNama = namaLengkap.trim();
    if (!cleanNama) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (cleanNama.length < 2) {
      setErrorMsg('Nama Lengkap minimal 2 karakter.');
      return;
    }

    // 2. Validasi Nomor HP (Hanya Angka)
    const cleanHp = nomorHp.replace(/[^0-9]/g, '');
    if (!cleanHp) {
      setErrorMsg('Nomor Handphone wajib diisi.');
      return;
    }
    if (cleanHp.length < 9) {
      setErrorMsg('Nomor Handphone tidak valid (minimal 9 digit angka).');
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
    if (!regPassword) {
      setErrorMsg('Password wajib diisi.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password harus minimal 6 karakter.');
      return;
    }

    // 5. Validasi Konfirmasi Password
    if (regPassword !== confirmPassword) {
      setErrorMsg('Password dan konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerCustomer(cleanNama, cleanHp, tanggalLahir, regPassword);
      if (res.success && res.profile) {
        setSuccessMsg('Pendaftaran berhasil! Mengalihkan ke pemilihan outlet...');
        setTimeout(() => {
          onAuthSuccess(res.profile!);
        }, 350);
      } else {
        setErrorMsg(res.error || 'Pendaftaran gagal. Silakan periksa kembali data Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="customer-auth-container" className="w-full max-w-md mx-auto bg-white p-6 rounded-2xl border border-[#E4E7EC] shadow-sm">
      {/* Header Form */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-[#172033]">
          {isRegisterMode ? 'Daftar Member Leton' : 'Masuk Akun Member'}
        </h3>
        <p className="text-sm text-[#475467] mt-1.5 leading-relaxed">
          {isRegisterMode
            ? 'Daftar sekarang untuk kemudahan pemesanan dan nikmati keuntungan member Leton Coffee.'
            : 'Masukkan nama lengkap dan password untuk melanjutkan pemesanan.'}
        </p>
      </div>

      {/* Alert Error */}
      {errorMsg && (
        <div id="customer-auth-error" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <span className="font-medium leading-normal">{errorMsg}</span>
        </div>
      )}

      {/* Alert Success */}
      {successMsg && (
        <div id="customer-auth-success" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <span className="font-medium leading-normal">{successMsg}</span>
        </div>
      )}

      {/* Form Pendaftaran */}
      {isRegisterMode ? (
        <form onSubmit={handleRegister} className="space-y-4">
          {/* 1. Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Nama Lengkap
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <User className="w-4 h-4" />
              </span>
              <input
                id="input-reg-nama"
                type="text"
                required
                disabled={loading}
                placeholder="Contoh: Budi Santoso"
                value={namaLengkap}
                onChange={(e) => {
                  clearAlerts();
                  setNamaLengkap(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* 2. Nomor Handphone (Hanya Angka) */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Nomor Handphone (Hanya Angka)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Phone className="w-4 h-4" />
              </span>
              <input
                id="input-reg-phone"
                type="tel"
                inputMode="numeric"
                required
                disabled={loading}
                placeholder="Contoh: 085761519565"
                value={nomorHp}
                onChange={(e) => {
                  clearAlerts();
                  setNomorHp(e.target.value.replace(/[^0-9]/g, ''));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* 3. Tanggal Lahir */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Tanggal Lahir
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                id="input-reg-birthdate"
                type="date"
                required
                disabled={loading}
                value={tanggalLahir}
                onChange={(e) => {
                  clearAlerts();
                  setTanggalLahir(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* 4. Password (Min. 6 Karakter) */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Password <span className="text-gray-400 font-normal">(Min. 6 Karakter)</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="input-reg-password"
                type="password"
                required
                disabled={loading}
                placeholder="••••••"
                value={regPassword}
                onChange={(e) => {
                  clearAlerts();
                  setRegPassword(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* 5. Konfirmasi Password */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Konfirmasi Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="input-reg-confirm-password"
                type="password"
                required
                disabled={loading}
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => {
                  clearAlerts();
                  setConfirmPassword(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* Tombol Submit Register */}
          <button
            id="btn-submit-register"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#C39A6B] hover:bg-[#B38A5B] disabled:bg-[#E4E7EC] disabled:text-[#98A2B3] text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-sm focus:outline-none cursor-pointer mt-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mendaftarkan Member...</span>
              </>
            ) : (
              <>
                <span>Daftar Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Form Login (Masuk) */
        <form onSubmit={handleLogin} className="space-y-4">
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
                id="input-login-nama"
                type="text"
                required
                disabled={loading}
                placeholder="Contoh: Budi Santoso"
                value={loginNama}
                onChange={(e) => {
                  clearAlerts();
                  setLoginNama(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#98A2B3]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="input-login-password"
                type="password"
                required
                disabled={loading}
                placeholder="••••••"
                value={loginPassword}
                onChange={(e) => {
                  clearAlerts();
                  setLoginPassword(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#C39A6B]/20 focus:border-[#C39A6B] disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {/* Tombol Submit Login */}
          <button
            id="btn-submit-login"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#C39A6B] hover:bg-[#B38A5B] disabled:bg-[#E4E7EC] disabled:text-[#98A2B3] text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-sm focus:outline-none cursor-pointer mt-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Masuk...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Akun</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Switch Mode Button */}
      <div className="border-t border-[#F2F4F7] mt-5 pt-4 text-center">
        <p className="text-xs text-[#667085]">
          {isRegisterMode ? 'Sudah memiliki akun?' : 'Belum memiliki akun member?'}
          <button
            id="btn-toggle-auth-mode"
            type="button"
            disabled={loading}
            onClick={toggleMode}
            className="ml-1.5 font-bold text-[#C39A6B] hover:text-[#B38A5B] hover:underline cursor-pointer disabled:opacity-50"
          >
            {isRegisterMode ? 'Masuk di sini' : 'Daftar di sini'}
          </button>
        </p>
      </div>
    </div>
  );
}
