import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import {
  Award,
  ShieldCheck,
  Save,
  RotateCcw,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Calculator,
  Lock,
} from 'lucide-react';
import {
  MembershipTierSettings,
  DEFAULT_MEMBERSHIP_TIER_SETTINGS,
  getMembershipTierSettings,
  saveMembershipTierSettings,
  calculateMembershipTier,
  isOrderValidForTier,
} from '../../utils/supabaseMembershipTier';
import { fetchRegisteredCustomers, RegisteredCustomer } from '../../utils/supabaseCustomers';
import { fetchAllOrders } from '../../utils/supabaseOrders';

export const MembershipTierManager: React.FC = () => {
  const { auth, isRealtimeConnected } = useContent();
  const isSuperAdmin = auth.role === 'super_admin';

  const [settings, setSettings] = useState<MembershipTierSettings>(DEFAULT_MEMBERSHIP_TIER_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [silverMin, setSilverMin] = useState<number>(0);
  const [goldMin, setGoldMin] = useState<number>(10);
  const [platinumMin, setPlatinumMin] = useState<number>(25);

  // Simulation calculator state
  const [testTransactions, setTestTransactions] = useState<number>(12);

  // Stats distribution state
  const [customers, setCustomers] = useState<RegisteredCustomer[]>([]);
  const [tierCounts, setTierCounts] = useState<{ silver: number; gold: number; platinum: number }>({
    silver: 0,
    gold: 0,
    platinum: 0,
  });
  const [calculatingStats, setCalculatingStats] = useState<boolean>(false);

  // Load settings on mount
  const loadSettings = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await getMembershipTierSettings();
      setSettings(res.settings);
      setSilverMin(res.settings.silverMinTransactions);
      setGoldMin(res.settings.goldMinTransactions);
      setPlatinumMin(res.settings.platinumMinTransactions);
    } catch (err) {
      console.warn('Failed to load membership tier settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load customer stats
  const loadCustomerStats = async (currentSettings: MembershipTierSettings) => {
    setCalculatingStats(true);
    try {
      const custData = await fetchRegisteredCustomers(auth.role);
      setCustomers(custData);

      const allOrders = await fetchAllOrders();
      // Count valid orders per customer
      const orderCountByCust: Record<string, number> = {};

      allOrders.forEach((o) => {
        if (!isOrderValidForTier(o)) return;

        const cId = o.customerId;
        const cPhone = (o.customerPhone || '').replace(/[^0-9]/g, '');

        if (cId) {
          orderCountByCust[cId] = (orderCountByCust[cId] || 0) + 1;
        } else if (cPhone) {
          orderCountByCust[cPhone] = (orderCountByCust[cPhone] || 0) + 1;
        }
      });

      let silver = 0;
      let gold = 0;
      let platinum = 0;

      custData.forEach((c) => {
        const count = orderCountByCust[c.id] || (c.nomorHp ? orderCountByCust[c.nomorHp.replace(/[^0-9]/g, '')] : 0) || 0;
        const calculated = calculateMembershipTier(count, currentSettings);
        if (calculated.tier === 'PLATINUM') platinum++;
        else if (calculated.tier === 'GOLD') gold++;
        else silver++;
      });

      setTierCounts({ silver, gold, platinum });
    } catch (err) {
      console.warn('Failed to load customer stats:', err);
    } finally {
      setCalculatingStats(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadCustomerStats(settings);
    }
  }, [loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setStatusMsg({
        type: 'error',
        text: 'Akses Ditolak: Hanya Super Admin / Admin Pusat yang dapat menyimpan pengaturan tier.',
      });
      return;
    }

    // Validation
    if (silverMin < 0) {
      setStatusMsg({ type: 'error', text: 'Threshold Silver minimal 0 transaksi.' });
      return;
    }
    if (goldMin <= silverMin) {
      setStatusMsg({ type: 'error', text: `Threshold Gold (${goldMin}) harus lebih besar dari Silver (${silverMin}).` });
      return;
    }
    if (platinumMin <= goldMin) {
      setStatusMsg({
        type: 'error',
        text: `Threshold Platinum (${platinumMin}) harus lebih besar dari Gold (${goldMin}).`,
      });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    const payloadToSave: MembershipTierSettings = {
      id: 'default',
      silverMinTransactions: Number(silverMin),
      goldMinTransactions: Number(goldMin),
      platinumMinTransactions: Number(platinumMin),
    };

    try {
      const res = await saveMembershipTierSettings(payloadToSave, auth.role, auth.username || 'Super Admin');
      if (res.success) {
        setSettings(payloadToSave);
        setStatusMsg({
          type: 'success',
          text: 'Konfigurasi Membership Tier berhasil disimpan ke database Supabase!',
        });
        loadCustomerStats(payloadToSave);
        setTimeout(() => setStatusMsg(null), 4000);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Gagal menyimpan pengaturan tier.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Kembalikan threshold tier ke rekomendasi awal?\n\n- Silver: 0 transaksi\n- Gold: 10 transaksi\n- Platinum: 25 transaksi'
      )
    ) {
      setSilverMin(DEFAULT_MEMBERSHIP_TIER_SETTINGS.silverMinTransactions);
      setGoldMin(DEFAULT_MEMBERSHIP_TIER_SETTINGS.goldMinTransactions);
      setPlatinumMin(DEFAULT_MEMBERSHIP_TIER_SETTINGS.platinumMinTransactions);
      setStatusMsg({
        type: 'success',
        text: 'Form telah diisi dengan nilai default. Klik "Simpan Perubahan" untuk menerapkan ke database.',
      });
    }
  };

  // Preview simulated tier
  const simulatedTier = calculateMembershipTier(testTransactions, {
    id: 'preview',
    silverMinTransactions: silverMin,
    goldMinTransactions: goldMin,
    platinumMinTransactions: platinumMin,
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-[#E0F2FE] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Award className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              SUPER ADMIN PUSAT • LOYALTY & TIER
            </span>
          </div>
          <h2 className="text-2xl font-display font-black text-[#172033]">
            Membership Tier Settings
          </h2>
          <p className="text-xs text-[#64748B] mt-1 max-w-2xl">
            Atur batas minimum transaksi untuk setiap level member Leton Coffee (Silver, Gold, Platinum).
            Tier customer akan otomatis dihitung secara dinamis dari tabel <code className="bg-slate-100 text-[#0284C7] px-1 py-0.5 rounded font-mono text-[11px]">public.orders</code> berdasarkan threshold yang Anda tentukan di sini tanpa perlu mengubah source code.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[#E0F2FE] bg-white hover:bg-[#F0F7FF] text-[#0284C7] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Status Alert Toast */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span className="text-xs font-semibold">{statusMsg.text}</span>
        </div>
      )}

      {/* 3 Tier Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* SILVER CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 border border-slate-700 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-400/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥈</span>
                <div>
                  <h3 className="font-display font-black text-sm tracking-wider text-slate-200">
                    SILVER TIER
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Level Pemula (Entry)</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-slate-700/60 rounded-full text-[10px] font-mono text-slate-300 font-bold border border-slate-600">
                Level 1
              </span>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Minimal Transaksi:</span>
                <span className="text-2xl font-display font-black text-slate-200">
                  {silverMin} <span className="text-xs font-normal text-slate-400">order</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Diberikan otomatis untuk semua customer yang baru mendaftar atau belum mencapai threshold Gold.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-700/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Member Aktif:</span>
            <span className="font-bold text-slate-200 font-mono">
              {calculatingStats ? '...' : `${tierCounts.silver} Orang`}
            </span>
          </div>
        </div>

        {/* GOLD CARD */}
        <div className="bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 border border-amber-500/30 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥇</span>
                <div>
                  <h3 className="font-display font-black text-sm tracking-wider text-amber-400">
                    GOLD TIER
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Level Loyal (Frequent)</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-amber-500/20 rounded-full text-[10px] font-mono text-amber-300 font-bold border border-amber-500/30">
                Level 2
              </span>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Minimal Transaksi:</span>
                <span className="text-2xl font-display font-black text-amber-400">
                  {goldMin} <span className="text-xs font-normal text-slate-400">order</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Diperoleh setelah customer menyelesaikan minimal {goldMin} transaksi valid di outlet Leton Coffee.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-700/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Member Aktif:</span>
            <span className="font-bold text-amber-400 font-mono">
              {calculatingStats ? '...' : `${tierCounts.gold} Orang`}
            </span>
          </div>
        </div>

        {/* PLATINUM CARD */}
        <div className="bg-gradient-to-br from-[#0B1528] via-[#0F172A] to-[#1E1B4B] text-white rounded-2xl p-5 border border-cyan-500/40 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💎</span>
                <div>
                  <h3 className="font-display font-black text-sm tracking-wider text-cyan-300">
                    PLATINUM TIER
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Level Tertinggi (VIP)</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-cyan-500/20 rounded-full text-[10px] font-mono text-cyan-300 font-bold border border-cyan-500/40">
                VIP
              </span>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Minimal Transaksi:</span>
                <span className="text-2xl font-display font-black text-cyan-300">
                  {platinumMin} <span className="text-xs font-normal text-slate-400">order</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pencapaian kasta tertinggi pelanggan setia dengan menyelesaikan minimal {platinumMin} transaksi valid.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-700/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Member Aktif:</span>
            <span className="font-bold text-cyan-300 font-mono">
              {calculatingStats ? '...' : `${tierCounts.platinum} Orang`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Konfigurasi Threshold */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0F2FE] p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9] mb-6">
            <div>
              <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0284C7]" />
                <span>Form Konfigurasi Threshold Transaksi</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Ubah batas minimum transaksi untuk masing-masing tier di bawah ini:
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-[#64748B] hover:text-[#0284C7] font-semibold flex items-center gap-1 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Input SILVER */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-lg">🥈</span>
                  <span>1. Minimum Transaksi SILVER (Tier 1)</span>
                </label>
                <span className="text-[11px] font-mono text-slate-500">Default: 0</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={silverMin}
                  onChange={(e) => setSilverMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full sm:w-48 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20"
                />
                <span className="text-xs font-medium text-slate-600">Transaksi valid</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Semua member baru langsung mulai dari tier Silver pada transaksi ke-{silverMin}.
              </p>
            </div>

            {/* Input GOLD */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-2">
                  <span className="text-lg">🥇</span>
                  <span>2. Minimum Transaksi GOLD (Tier 2)</span>
                </label>
                <span className="text-[11px] font-mono text-amber-700">Harus &gt; Silver</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={silverMin + 1}
                  step={1}
                  required
                  value={goldMin}
                  onChange={(e) => setGoldMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full sm:w-48 px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="text-xs font-medium text-amber-900">Transaksi valid</span>
              </div>
              <p className="text-[11px] text-amber-800/80 mt-2">
                Member akan naik pangkat ke Gold setelah mencapai {goldMin} transaksi valid.
              </p>
            </div>

            {/* Input PLATINUM */}
            <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-cyan-950 flex items-center gap-2">
                  <span className="text-lg">💎</span>
                  <span>3. Minimum Transaksi PLATINUM (Tier 3)</span>
                </label>
                <span className="text-[11px] font-mono text-cyan-700">Harus &gt; Gold</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={goldMin + 1}
                  step={1}
                  required
                  value={platinumMin}
                  onChange={(e) => setPlatinumMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full sm:w-48 px-3.5 py-2.5 bg-white border border-cyan-300 rounded-xl text-sm font-bold text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                <span className="text-xs font-medium text-cyan-900">Transaksi valid</span>
              </div>
              <p className="text-[11px] text-cyan-800/80 mt-2">
                Member VIP tertinggi. Otomatis didapatkan saat pesanan valid mencapai {platinumMin} transaksi.
              </p>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#64748B]">
                {settings.updatedAt ? (
                  <span>
                    Terakhir diperbarui: {new Date(settings.updatedAt).toLocaleString('id-ID')}
                    {settings.updatedBy ? ` oleh ${settings.updatedBy}` : ''}
                  </span>
                ) : (
                  <span>Menggunakan konfigurasi default</span>
                )}
              </div>

              <button
                type="submit"
                disabled={saving || !isSuperAdmin}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0284C7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Supabase...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SIMPAN PERUBAHAN THRESHOLD</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Test Kalkulator Tier Simulator */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E0F2FE] p-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9] mb-4">
              <Calculator className="w-4 h-4 text-[#0284C7]" />
              <h4 className="text-sm font-bold text-[#172033]">
                Simulasi Kalkulator Tier
              </h4>
            </div>

            <p className="text-xs text-[#64748B] mb-3">
              Coba masukkan angka transaksi untuk menguji bagaimana sistem menghitung tier secara langsung:
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Contoh Jumlah Transaksi:
              </label>
              <input
                type="number"
                min={0}
                value={testTransactions}
                onChange={(e) => setTestTransactions(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm font-bold text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20"
              />
            </div>

            {/* Live Result Preview Box */}
            <div className="p-4 rounded-xl bg-[#0F172A] text-white border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                  Tier Customer
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${simulatedTier.theme.badgeBg} ${simulatedTier.theme.badgeText}`}>
                  {simulatedTier.tierBadge}
                </span>
              </div>

              <div>
                <span className="text-2xl font-display font-black text-white">
                  {simulatedTier.transactionCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">Transaksi Tercatat</span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Progress</span>
                  <span>{simulatedTier.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${simulatedTier.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-slate-300 font-medium pt-1">
                {simulatedTier.statusMessage}
              </div>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#F0F7FF] rounded-2xl border border-[#BAE6FD] p-4 text-xs text-[#0369A1] space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#0284C7]">
              <HelpCircle className="w-4 h-4" />
              <span>Sumber Data Terverifikasi</span>
            </div>
            <p className="leading-relaxed text-[11px] text-[#0369A1]">
              Sistem menghitung transaksi secara real-time langsung dari tabel database <strong className="text-[#0284C7]">public.orders</strong> yang valid (bukan localStorage). Pesanan yang berstatus <em>CANCELLED</em> atau <em>PAYMENT REJECTED</em> otomatis diabaikan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
