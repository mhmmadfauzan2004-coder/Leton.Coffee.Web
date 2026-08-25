import React, { useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { Lock, User, KeyRound, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface AdminLoginProps {
  onBackToPublic: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onBackToPublic }) => {
  const { login, data } = useContent();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!username.trim() || !password) {
      setErrorMessage('Harap isi username dan password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Username atau password tidak valid');
      }
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
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center font-display font-black text-black text-2xl shadow-xl shadow-cyan-500/20">
            L
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-tight uppercase">
            {data.siteSettings.brandName} CMS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Portal Pengelolaan Konten & Real-Time Sync
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <p>{errorMessage}</p>
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
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors"
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            id="admin-login-submit-btn"
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#00E5FF]/20 transition-all cursor-pointer disabled:opacity-50"
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

        {/* Initial Credentials Hint */}
        <div className="mt-6 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kredensial Bawaan:</span>
          </div>
          <p>User: <span className="text-slate-200">admin</span></p>
          <p>Pass: <span className="text-slate-200">LetonAdmin2026!</span></p>
        </div>
      </div>
    </div>
  );
};
