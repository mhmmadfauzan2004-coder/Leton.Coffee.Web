import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  Gift,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  Award,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  ReferralRewardSettings,
  DEFAULT_REFERRAL_SETTINGS,
  getReferralRewardSettings,
  saveReferralRewardSettings,
} from '../../utils/supabaseReferralSettings';

export const ReferralManager: React.FC = () => {
  const { auth } = useContent();
  const isSuperAdmin = auth.role === 'super_admin';

  const [settings, setSettings] = useState<ReferralRewardSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [referrerReward, setReferrerReward] = useState<number>(DEFAULT_REFERRAL_SETTINGS.referrer_reward);
  const [referredReward, setReferredReward] = useState<number>(DEFAULT_REFERRAL_SETTINGS.referred_reward);

  // Load settings on mount
  const loadSettings = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await getReferralRewardSettings();
      setSettings(res.settings);
      setReferrerReward(res.settings.referrer_reward);
      setReferredReward(res.settings.referred_reward);
    } catch (err) {
      console.warn('Failed to load referral reward settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadSettings();
    }
  }, [isSuperAdmin]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setStatusMsg({
        type: 'error',
        text: 'Akses Ditolak: Hanya Super Admin yang dapat mengubah pengaturan Member Get Member.',
      });
      return;
    }

    const refNum = Number(referrerReward);
    const memNum = Number(referredReward);

    if (isNaN(refNum) || !Number.isInteger(refNum) || refNum < 0) {
      setStatusMsg({
        type: 'error',
        text: 'Reward Pengundang harus berupa bilangan bulat (minimal 0 poin).',
      });
      return;
    }

    if (isNaN(memNum) || !Number.isInteger(memNum) || memNum < 0) {
      setStatusMsg({
        type: 'error',
        text: 'Reward Member Baru harus berupa bilangan bulat (minimal 0 poin).',
      });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      const result = await saveReferralRewardSettings(
        {
          referrer_reward: refNum,
          referred_reward: memNum,
        },
        auth.role,
        auth.username
      );

      if (result.success && result.settings) {
        setSettings(result.settings);
        setReferrerReward(result.settings.referrer_reward);
        setReferredReward(result.settings.referred_reward);
        setStatusMsg({
          type: 'success',
          text: '✓ Pengaturan berhasil disimpan ke database.',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: result.error || 'Gagal menyimpan pengaturan referral.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Terjadi kesalahan sistem saat menyimpan data.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Reset to Default
  const handleResetToDefault = () => {
    setReferrerReward(DEFAULT_REFERRAL_SETTINGS.referrer_reward);
    setReferredReward(DEFAULT_REFERRAL_SETTINGS.referred_reward);
    setStatusMsg({
      type: 'success',
      text: 'Form direset ke nilai default (100 Poin & 50 Poin). Klik "SIMPAN PENGATURAN" untuk menerapkan.',
    });
  };

  // If not Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-red-200 text-center max-w-lg mx-auto shadow-sm">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-lg text-[#172033]">Akses Terbatas</h3>
        <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
          Halaman pengaturan <strong>MEMBER GET MEMBER (Referral Reward)</strong> hanya dapat diakses dan diubah oleh Super Admin / Admin Pusat.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E0F2FE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Gift className="w-5 h-5" />
            </span>
            <h1 className="font-black text-lg sm:text-xl text-[#172033] tracking-tight uppercase">
              MEMBER GET MEMBER
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              Super Admin Only
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            Kelola besaran bonus poin loyalty program referral Leton Coffee untuk Pengundang dan Member Baru.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0284C7] bg-sky-50 hover:bg-sky-100 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Status Feedback Toast */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-xs font-bold transition-all shadow-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{statusMsg.text}</div>
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E0F2FE] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E0F2FE]">
          <h2 className="text-sm font-extrabold text-[#172033] uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Pengaturan Bonus Poin Referral
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Poin bonus akan diberikan secara otomatis setelah pesanan pertama member baru berstatus <strong>PAID</strong> atau <strong>COMPLETED</strong>.
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Reward Pengundang */}
            <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] space-y-3 relative overflow-hidden group hover:border-[#0284C7]/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0284C7] flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#172033] uppercase tracking-wide">
                      REWARD PENGUNDANG
                    </h3>
                    <span className="text-[10px] text-[#64748B] font-medium">Referrer Bonus</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  Default: 100 Poin
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-extrabold text-[#172033] flex items-center justify-between">
                  <span>Jumlah Bonus Poin</span>
                  <span className="text-xs font-black text-[#0284C7]">{referrerReward} POIN</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    value={referrerReward}
                    onChange={(e) => setReferrerReward(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full pl-4 pr-16 py-3 bg-white border border-[#CBD5E1] rounded-xl text-sm font-extrabold text-[#172033] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 shadow-2xs"
                    placeholder="100"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-black text-[#64748B]">
                    POIN
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed pt-1">
                  Poin yang diterima member yang mengajak teman.
                </p>
              </div>
            </div>

            {/* Card 2: Reward Member Baru */}
            <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#E0F2FE] space-y-3 relative overflow-hidden group hover:border-[#0284C7]/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#172033] uppercase tracking-wide">
                      REWARD MEMBER BARU
                    </h3>
                    <span className="text-[10px] text-[#64748B] font-medium">New Member Welcome</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Default: 50 Poin
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-extrabold text-[#172033] flex items-center justify-between">
                  <span>Jumlah Bonus Poin</span>
                  <span className="text-xs font-black text-amber-700">{referredReward} POIN</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    value={referredReward}
                    onChange={(e) => setReferredReward(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full pl-4 pr-16 py-3 bg-white border border-[#CBD5E1] rounded-xl text-sm font-extrabold text-[#172033] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 shadow-2xs"
                    placeholder="50"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-black text-[#64748B]">
                    POIN
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed pt-1">
                  Poin yang diterima member baru setelah transaksi pertamanya berhasil.
                </p>
              </div>
            </div>
          </div>

          {/* Information & Security Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#172033]">
              <HelpCircle className="w-4 h-4 text-[#0284C7]" />
              <span>Sistem Keamanan &amp; Anti-Kecurangan Referral</span>
            </div>
            <ul className="list-disc list-inside text-[#64748B] space-y-1 text-[11px]">
              <li><strong>Idempotency Permanen</strong>: Reward hanya diberikan tepat 1x seumur hidup member baru saat transaksi pertama selesai.</li>
              <li><strong>Anti Self-Referral</strong>: Member tidak dapat memasukkan kode referral milik sendiri atau akun yang sama.</li>
              <li><strong>Penyimpanan Hemat</strong>: Konfigurasi tersimpan langsung di tabel registry <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px] text-slate-800">public.leton_content</code> tanpa polling berulang.</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 bg-[#F8FBFF] border-t border-[#E0F2FE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#172033] bg-white border border-[#CBD5E1] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Default (100 &amp; 50)</span>
          </button>

          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#0284C7] hover:bg-[#0369a1] disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Menyimpan...' : 'SIMPAN PENGATURAN'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
