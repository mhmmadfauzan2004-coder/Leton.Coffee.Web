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
  Coffee,
  X,
  ChevronRight,
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
  const [showTierModal, setShowTierModal] = useState<boolean>(false);

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

      {/* 3 Tier Overview Cards — Modern Physical Card Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SILVER CARD (Steel / Slate Sheen) */}
        <div className="group relative rounded-2xl p-[1px] bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200 shadow-[0_14px_30px_-8px_rgba(71,85,105,0.2)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
          <div
            className="relative w-full h-full rounded-[15px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #7E9BB8 0%, #A3BCD3 48%, #6B8BAE 100%)' }}
          >
            {/* Specular Sheen Glow */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/30 blur-2xl rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-70 pointer-events-none" />

            <div>
              {/* Header: Monogram & Tier Badge */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-inner shrink-0">
                    <Coffee className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-wider text-white leading-none">LETON COFFEE</span>
                    <span className="text-[9px] tracking-[0.22em] text-white/85 uppercase mt-1 font-medium">Private Club</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTierModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/25 border border-white/40 backdrop-blur-md text-white font-bold text-[10px] tracking-wider uppercase hover:bg-white/30 transition-all cursor-pointer"
                  title="Lihat info tingkatan tier membership"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>SILVER TIER</span>
                </button>
              </div>

              {/* Threshold & Status */}
              <div className="relative z-10 my-3">
                <span className="text-[10px] uppercase text-white/90 tracking-wider font-semibold block">Batas Transaksi Tier</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    {silverMin}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/25 border border-white/30 text-white font-bold">
                    ORDER
                  </span>
                </div>
                <p className="text-[11px] text-white/85 mt-1 leading-snug">
                  Tier pembuka untuk member baru Leton Coffee.
                </p>
              </div>

              {/* Progress Bar & Next Tier Message */}
              <div className="relative z-10 my-3 p-3 rounded-xl bg-black/15 backdrop-blur-md border border-white/20 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-white">
                  <span className="font-semibold">Level 1 • Pemula</span>
                  <span className="font-bold text-white font-mono">
                    {goldMin > 0 ? Math.min(100, Math.round((silverMin / goldMin) * 100)) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden p-0.5 border border-white/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white to-amber-300 transition-all duration-500"
                    style={{ width: `${goldMin > 0 ? Math.min(100, Math.round((silverMin / goldMin) * 100)) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/90 pt-0.5">
                  <span className="truncate pr-1">Next: {Math.max(0, goldMin - silverMin)} transaksi lagi ke Gold</span>
                  <button
                    type="button"
                    onClick={() => setShowTierModal(true)}
                    className="underline hover:text-white font-bold shrink-0 cursor-pointer"
                  >
                    Info Tier
                  </button>
                </div>
              </div>
            </div>

            {/* Footer: Member Count & Level Meta */}
            <div className="relative z-10 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-white/90">
              <span className="text-white/80">Member Aktif:</span>
              <span className="font-bold text-white font-mono bg-white/20 px-2 py-0.5 rounded-md">
                {calculatingStats ? '...' : `${tierCounts.silver} Orang`}
              </span>
            </div>
          </div>
        </div>

        {/* GOLD CARD (Amber / Gold Sheen) */}
        <div className="group relative rounded-2xl p-[1px] bg-gradient-to-b from-[#D4AF37] via-[#91751D]/60 to-[#D4AF37]/30 shadow-[0_16px_36px_-8px_rgba(212,175,55,0.3)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
          <div
            className="relative w-full h-full rounded-[15px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0B132B 0%, #152449 60%, #070D1E 100%)' }}
          >
            {/* Amber Glow Specular */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-400/20 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:18px_18px] opacity-15 pointer-events-none" />

            <div>
              {/* Header: Monogram & Tier Badge */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 backdrop-blur-md flex items-center justify-center text-[#F5E6BE] shadow-inner shrink-0">
                    <Coffee className="w-5 h-5 text-[#F5E6BE]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-wider text-[#F5E6BE] leading-none">LETON COFFEE</span>
                    <span className="text-[9px] tracking-[0.22em] text-[#D4AF37] uppercase mt-1 font-semibold">Signature Reserve</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTierModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 border border-[#D4AF37]/50 backdrop-blur-md text-[#F5E6BE] font-bold text-[10px] tracking-wider uppercase hover:bg-amber-400/25 transition-all cursor-pointer"
                  title="Lihat info tingkatan tier membership"
                >
                  <Award className="w-3.5 h-3.5 text-[#F5E6BE]" />
                  <span>GOLD TIER</span>
                </button>
              </div>

              {/* Threshold & Status */}
              <div className="relative z-10 my-3">
                <span className="text-[10px] uppercase text-[#D4AF37] tracking-wider font-semibold block">Batas Transaksi Tier</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {goldMin}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-[#F5E6BE] font-bold">
                    ORDER
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Diberikan untuk pelanggan setia frequent buyer.
                </p>
              </div>

              {/* Progress Bar & Next Tier Message */}
              <div className="relative z-10 my-3 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-[#D4AF37]/25 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-200">
                  <span className="font-semibold text-amber-300">Level 2 • Loyal</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {platinumMin > goldMin ? Math.min(100, Math.round(((goldMin) / platinumMin) * 100)) : 50}%
                  </span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-[#D4AF37]/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-500"
                    style={{ width: `${platinumMin > goldMin ? Math.min(100, Math.round(((goldMin) / platinumMin) * 100)) : 50}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5">
                  <span className="truncate pr-1">Next: {Math.max(0, platinumMin - goldMin)} transaksi lagi ke Platinum</span>
                  <button
                    type="button"
                    onClick={() => setShowTierModal(true)}
                    className="text-[#D4AF37] underline hover:text-amber-300 font-bold shrink-0 cursor-pointer"
                  >
                    Info Tier
                  </button>
                </div>
              </div>
            </div>

            {/* Footer: Member Count & Level Meta */}
            <div className="relative z-10 pt-3 border-t border-[#D4AF37]/25 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Member Aktif:</span>
              <span className="font-bold text-amber-400 font-mono bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                {calculatingStats ? '...' : `${tierCounts.gold} Orang`}
              </span>
            </div>
          </div>
        </div>

        {/* PLATINUM CARD (Deep Obsidian + Cyan Glow) */}
        <div className="group relative rounded-2xl p-[1px] bg-gradient-to-b from-cyan-400 via-blue-500/60 to-cyan-400/30 shadow-[0_16px_36px_-8px_rgba(6,182,212,0.35)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
          <div
            className="relative w-full h-full rounded-[15px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #050B14 0%, #0A1628 50%, #030712 100%)' }}
          >
            {/* Deep Obsidian Cyan Glow Radiance */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-cyan-400/20 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-blue-500/15 blur-2xl rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] opacity-15 pointer-events-none" />

            <div>
              {/* Header: Monogram & Tier Badge */}
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 backdrop-blur-md flex items-center justify-center text-cyan-200 shadow-inner shrink-0">
                    <Coffee className="w-5 h-5 text-cyan-200" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-wider text-cyan-100 leading-none">LETON COFFEE</span>
                    <span className="text-[9px] tracking-[0.22em] text-cyan-300 uppercase mt-1 font-semibold">VIP Elite Atelier</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTierModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 backdrop-blur-md text-cyan-300 font-bold text-[10px] tracking-wider uppercase hover:bg-cyan-500/30 transition-all cursor-pointer"
                  title="Lihat info tingkatan tier membership"
                >
                  <Award className="w-3.5 h-3.5 text-cyan-300" />
                  <span>PLATINUM TIER</span>
                </button>
              </div>

              {/* Threshold & Status */}
              <div className="relative z-10 my-3">
                <span className="text-[10px] uppercase text-cyan-400 tracking-wider font-semibold block">Batas Transaksi Tier</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {platinumMin}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-bold">
                    ORDER
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Pencapaian kasta tertinggi pelanggan VIP Leton Coffee.
                </p>
              </div>

              {/* Progress Bar & Next Tier Message */}
              <div className="relative z-10 my-3 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-cyan-500/25 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-200">
                  <span className="font-semibold text-cyan-300">Level 3 • VIP</span>
                  <span className="font-bold text-cyan-300 font-mono">100%</span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-cyan-500/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-300 transition-all duration-500 w-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5">
                  <span className="truncate pr-1 text-cyan-200">Level Maksimal (Pencapaian Tertinggi)</span>
                  <button
                    type="button"
                    onClick={() => setShowTierModal(true)}
                    className="text-cyan-300 underline hover:text-cyan-200 font-bold shrink-0 cursor-pointer"
                  >
                    Info Tier
                  </button>
                </div>
              </div>
            </div>

            {/* Footer: Member Count & Level Meta */}
            <div className="relative z-10 pt-3 border-t border-cyan-500/25 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Member Aktif:</span>
              <span className="font-bold text-cyan-300 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-400/20">
                {calculatingStats ? '...' : `${tierCounts.platinum} Orang`}
              </span>
            </div>
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

      {/* Info Tier Modal Pop-up */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E0F2FE]">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base tracking-wide text-white">
                    Tingkatan Level Membership
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Konfigurasi Resmi Leton Coffee Loyalty Program
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3.5 max-h-[65vh] overflow-y-auto">
              {/* Silver Tier Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🥈</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">SILVER TIER</h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Minimal {silverMin} Transaksi Valid
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                    Level 1
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tier awal untuk semua pelanggan baru yang bergabung di Leton Coffee. Memulai kumpul poin dan menikmati promo member reguler.
                </p>
              </div>

              {/* Gold Tier Card */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🥇</span>
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">GOLD TIER</h4>
                      <span className="text-[11px] text-amber-700 font-mono">
                        Minimal {goldMin} Transaksi Valid
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    Level 2
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tier lanjutan untuk penikmat kopi setia Leton Coffee setelah menyelesaikan minimal {goldMin} pesanan sukses.
                </p>
              </div>

              {/* Platinum Tier Card */}
              <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">💎</span>
                    <div>
                      <h4 className="font-bold text-sm text-cyan-950">PLATINUM VIP</h4>
                      <span className="text-[11px] text-cyan-700 font-mono">
                        Minimal {platinumMin} Transaksi Valid
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-900 text-[10px] font-bold">
                    Level 3 • VIP
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Kasta tertinggi dengan status VIP istimewa setelah mencapai minimal {platinumMin} transaksi valid di outlet Leton Coffee.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="w-full py-2.5 bg-[#172033] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
