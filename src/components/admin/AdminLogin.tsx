import React, { useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { Lock, User, KeyRound, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onBackToPublic: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onBackToPublic }) => {
  const { login, data } = useContent();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!username.trim() || !password) {
      setErrorMessage('Password atau Username salah, silakan coba lagi.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Password atau Username salah, silakan coba lagi.');
      }
    } catch {
      setErrorMessage('Password atau Username salah, silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#05080e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back Button */}
      <button
        onClick={onBackToPublic}
        className="absolute top-6 left-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer z-10"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Website Publik</span>
      </button>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden border-2 border-[#2563EB] shadow-xl shadow-[#2563EB]/25 bg-slate-950 flex items-center justify-center">
            <img
              src={data.siteSettings.logoUrl || "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80"}
              alt={data.siteSettings.brandName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-tight uppercase">
            {data.siteSettings.brandName} CMS
          </h1>
          <p className="text-xs text-[#60A5FA] mt-1 font-mono font-medium">
            Portal Pengelolaan Konten & Real-Time Sync
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-3 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Masukkan username"
                required
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Masukkan password"
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            id="admin-login-submit-btn"
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Masuk Dashboard</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
