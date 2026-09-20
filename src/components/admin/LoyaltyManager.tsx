import React, { useState, useEffect, useMemo } from 'react';
import {
  Gift,
  Coins,
  Settings,
  Users,
  History,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Award,
  Search,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Copy,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  getLoyaltySettings,
  saveLoyaltySettings,
  getLoyaltyRewards,
  saveLoyaltyReward,
  deleteLoyaltyReward,
  getCustomersWithLoyalty,
  adjustCustomerPointsManual,
  getLoyaltyTransactions,
  LoyaltySettings,
  LoyaltyReward,
  PointTransaction,
} from '../../utils/supabaseLoyalty';
import { formatRupiah } from '../../utils/formatters';

export const LoyaltyManager: React.FC = () => {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'rewards' | 'customers' | 'history'>('settings');

  // Core Data State
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [showSqlDialog, setShowSqlDialog] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reward Modal Form State
  const [showRewardModal, setShowRewardModal] = useState<boolean>(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardForm, setRewardForm] = useState<Omit<LoyaltyReward, 'id' | 'createdAt'>>({
    name: '',
    description: '',
    pointsRequired: 10,
    rewardType: 'DISCOUNT_NOMINAL',
    rewardValue: 5000,
    isActive: true,
  });

  // Manual Adjustment Modal Form State
  const [showAdjModal, setShowAdjModal] = useState<boolean>(false);
  const [selectedCustomerForAdj, setSelectedCustomerForAdj] = useState<any | null>(null);
  const [adjForm, setAdjForm] = useState({
    points: 10,
    type: 'MANUAL_ADD' as 'MANUAL_ADD' | 'MANUAL_SUB',
    reason: '',
  });

  // Load All Data
  const loadAllLoyaltyData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setErrorMsg(null);
      // Fetch settings
      const settingsRes = await getLoyaltySettings();
      setSettings(settingsRes.settings);
      setIsFallbackMode(settingsRes.isFallback);

      // Fetch rewards
      const rewardsRes = await getLoyaltyRewards();
      setRewards(rewardsRes.rewards);

      // Fetch customers
      const customersRes = await getCustomersWithLoyalty();
      setCustomers(customersRes);

      // Fetch transactions
      const txsRes = await getLoyaltyTransactions();
      setTransactions(txsRes);
    } catch (err: any) {
      console.error('Error loading loyalty data:', err);
      setErrorMsg('Gagal memuat beberapa data loyalty dari server.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAllLoyaltyData();
  }, []);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await saveLoyaltySettings(settings);
      if (res.success) {
        setSuccessMsg('Pengaturan sistem Loyalty Point berhasil disimpan!');
        loadAllLoyaltyData(true);
      } else {
        setErrorMsg(res.error || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Reward (Create / Update)
  const handleSaveRewardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: LoyaltyReward = {
      id: editingReward?.id || 'rwd-' + Math.floor(Math.random() * 900000 + 100000),
      name: rewardForm.name,
      description: rewardForm.description,
      pointsRequired: Number(rewardForm.pointsRequired),
      rewardType: rewardForm.rewardType,
      rewardValue: Number(rewardForm.rewardValue),
      isActive: rewardForm.isActive,
      redeemLimit: null,
      createdAt: editingReward?.createdAt || new Date().toISOString(),
    };

    try {
      const res = await saveLoyaltyReward(payload);
      if (res.success) {
        setSuccessMsg(editingReward ? 'Reward berhasil diperbarui!' : 'Reward baru berhasil ditambahkan!');
        setShowRewardModal(false);
        setEditingReward(null);
        setRewardForm({
          name: '',
          description: '',
          pointsRequired: 10,
          rewardType: 'DISCOUNT_NOMINAL',
          rewardValue: 5000,
          isActive: true,
        });
        loadAllLoyaltyData(true);
      } else {
        setErrorMsg(res.error || 'Gagal menyimpan reward.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Reward
  const handleDeleteRewardClick = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus reward ini dari katalog?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await deleteLoyaltyReward(id);
      if (res.success) {
        setSuccessMsg('Reward berhasil dihapus!');
        loadAllLoyaltyData(true);
      } else {
        setErrorMsg(res.error || 'Gagal menghapus reward.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Open Edit Reward
  const openEditReward = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description,
      pointsRequired: reward.pointsRequired,
      rewardType: reward.rewardType,
      rewardValue: reward.rewardValue,
      isActive: reward.isActive,
    });
    setShowRewardModal(true);
  };

  // Handle Manual Adjustment Submit
  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForAdj) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await adjustCustomerPointsManual(
        selectedCustomerForAdj.id,
        Number(adjForm.points),
        adjForm.type,
        adjForm.reason,
        'Admin Leton' // Default placeholder for admin logged in user
      );

      if (res.success) {
        setSuccessMsg(`Poin customer ${selectedCustomerForAdj.namaLengkap} berhasil disesuaikan!`);
        setShowAdjModal(false);
        setSelectedCustomerForAdj(null);
        setAdjForm({ points: 10, type: 'MANUAL_ADD', reason: '' });
        loadAllLoyaltyData(true);
      } else {
        setErrorMsg(res.error || 'Gagal menyesuaikan poin.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered lists based on search
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.namaLengkap?.toLowerCase().includes(q) ||
        c.nomorHp?.includes(q) ||
        c.id?.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        t.customerId?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.reason?.toLowerCase().includes(q) ||
        t.transactionType?.toLowerCase().includes(q) ||
        (t.referenceOrderId && t.referenceOrderId.toLowerCase().includes(q))
      );
    });
  }, [transactions, searchQuery]);

  // Copy SQL setup helper
  const handleCopySql = () => {
    const sqlElement = document.getElementById('loyalty-sql-code');
    if (sqlElement) {
      navigator.clipboard.writeText(sqlElement.innerText);
      alert('Script SQL berhasil disalin! Buka Supabase SQL Editor dan jalankan script ini.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wide mb-2">
            <Gift className="w-3.5 h-3.5" />
            <span>Loyalty & Member Rewards</span>
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-[#172033] uppercase tracking-tight">
            PENGATURAN LOYALTY POINT
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Kelola formula earning point, katalog penukaran hadiah (redeem reward), saldo member, dan riwayat transaksi poin pelanggan Leton Coffee.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFallbackMode && (
            <button
              onClick={() => setShowSqlDialog(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all animate-pulse"
            >
              <Database className="w-4 h-4" />
              <span>SINKRONISASI DATABASE AWAN</span>
            </button>
          )}

          <button
            onClick={() => loadAllLoyaltyData()}
            disabled={loading}
            className="p-2 border border-[#E0F2FE] hover:bg-[#F0F7FF] rounded-xl text-[#0284C7] bg-white transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fallback Warning Alert Banner */}
      {isFallbackMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 text-amber-700">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-800">Sistem Berjalan di Penyimpanan Lokal (Offline Fallback)</h4>
              <p className="text-xs text-amber-600 mt-1">
                Tabel database loyalty belum terdeteksi di Supabase Anda. Anda tetap bisa mencoba & mensimulasikan fitur ini 100% lancar, namun untuk produksi penuh, klik tombol di sebelah kanan untuk menyalin kode integrasi SQL database awan.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlDialog(true)}
            className="px-3.5 py-1.5 bg-amber-700 text-white hover:bg-amber-800 rounded-lg text-xs font-bold shrink-0 shadow-sm"
          >
            Lihat Script SQL
          </button>
        </div>
      )}

      {/* Status Alert Banners */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs sm:text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Tab Controls */}
      <div className="flex border-b border-[#E0F2FE] gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveSubTab('settings'); setSearchQuery(''); }}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeSubTab === 'settings'
              ? 'border-[#0284C7] text-[#0284C7]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            <span>Aturan Earning & Expire</span>
          </div>
        </button>

        <button
          onClick={() => { setActiveSubTab('rewards'); setSearchQuery(''); }}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeSubTab === 'rewards'
              ? 'border-[#0284C7] text-[#0284C7]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>Katalog Reward</span>
          </div>
        </button>

        <button
          onClick={() => { setActiveSubTab('customers'); setSearchQuery(''); }}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeSubTab === 'customers'
              ? 'border-[#0284C7] text-[#0284C7]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Saldo Poin Member</span>
          </div>
        </button>

        <button
          onClick={() => { setActiveSubTab('history'); setSearchQuery(''); }}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeSubTab === 'history'
              ? 'border-[#0284C7] text-[#0284C7]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            <span>Jurnal Transaksi Poin</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E0F2FE] p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#0284C7] mb-3" />
          <p className="text-sm font-semibold">Sedang menyinkronkan data loyalty...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: SETTINGS */}
          {activeSubTab === 'settings' && settings && (
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {/* Earning Formula Config Card */}
                <div className="bg-white rounded-2xl border border-[#E0F2FE] p-5 sm:p-6 shadow-[0_1px_8px_rgba(0,0,0,0.01)] space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#172033] text-sm sm:text-base">POINT EARNING FORMULA</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Tentukan bagaimana pelanggan memperoleh poin dari transaksi belanja mereka.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Active Toggle Switch */}
                    <div className="sm:col-span-2 flex items-center justify-between p-3 bg-slate-50 border border-[#E0F2FE] rounded-xl">
                      <div>
                        <span className="block text-xs font-bold text-[#172033] uppercase">Sistem Loyalty Aktif</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Aktifkan atau nonaktifkan pembagian poin untuk transaksi lunas.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.isActive}
                          onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Transaction Amount Value per 1 point */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Nilai Transaksi untuk 1 Point
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={settings.earningAmountPerPoint}
                          onChange={(e) => setSettings({ ...settings, earningAmountPerPoint: Math.max(1, Number(e.target.value)) })}
                          className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-bold focus:outline-none focus:border-[#0284C7] transition-all"
                          placeholder="e.g. 10000"
                          required
                        />
                      </div>
                      <span className="block text-[10px] text-slate-400 mt-1">
                        Contoh: Rp10.000 = 1 Poin. Transaksi Rp35.000 akan mendapat 3 Poin (pembulatan ke bawah).
                      </span>
                    </div>

                    {/* Calculation Basis */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Dasar Perhitungan Nilai
                      </label>
                      <select
                        value={settings.calculationBasis}
                        onChange={(e) => setSettings({ ...settings, calculationBasis: e.target.value as 'SUBTOTAL' | 'TOTAL' })}
                        className="w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-bold focus:outline-none focus:border-[#0284C7] transition-all"
                      >
                        <option value="SUBTOTAL">SUBTOTAL (Sebelum Diskon)</option>
                        <option value="TOTAL">TOTAL BAYAR (Setelah Diskon)</option>
                      </select>
                      <span className="block text-[10px] text-slate-400 mt-1">
                        Pilih apakah poin dihitung sebelum atau sesudah pemotongan diskon / voucher.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expiration Rules Config Card */}
                <div className="bg-white rounded-2xl border border-[#E0F2FE] p-5 sm:p-6 shadow-[0_1px_8px_rgba(0,0,0,0.01)] space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0284C7]/5 text-[#0284C7] flex items-center justify-center font-bold">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#172033] text-sm sm:text-base">EXPIRATION RULES</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Tentukan batas masa berlaku poin yang telah dikumpulkan pelanggan.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Expiration Mode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Masa Berlaku Poin
                      </label>
                      <select
                        value={settings.expirationMode}
                        onChange={(e) => setSettings({ ...settings, expirationMode: e.target.value as 'NEVER' | 'DAYS' })}
                        className="w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-bold focus:outline-none focus:border-[#0284C7] transition-all"
                      >
                        <option value="NEVER">Poin Tidak Pernah Expired (Selamanya)</option>
                        <option value="DAYS">Poin Hangus Setelah X Hari</option>
                      </select>
                    </div>

                    {/* Expiration Days if active */}
                    {settings.expirationMode === 'DAYS' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                          Jumlah Hari Berlaku
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={settings.expirationDays}
                            onChange={(e) => setSettings({ ...settings, expirationDays: Math.max(1, Number(e.target.value)) })}
                            className="w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-bold focus:outline-none focus:border-[#0284C7] transition-all"
                            placeholder="e.g. 365"
                            required
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Hari</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Settings Trigger Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#0284C7] hover:bg-[#0274B7] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>SIMPAN PENGATURAN ATURAN</span>
                  </button>
                </div>
              </div>

              {/* Side Simulation panel */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-[#E0F2FE] rounded-2xl p-5 space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">Simulasi Aturan Aktif</h4>
                  
                  <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl space-y-3">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">Belanja Rp50.000</span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Poin Diperoleh:</span>
                      <span className="font-mono font-bold text-emerald-600">+{Math.floor(50000 / settings.earningAmountPerPoint)} Poin</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl space-y-3">
                    <span className="block text-[11px] font-bold text-slate-500 uppercase">Belanja Rp22.500</span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Poin Diperoleh:</span>
                      <span className="font-mono font-bold text-emerald-600">+{Math.floor(22500 / settings.earningAmountPerPoint)} Poin</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Sistem akan menghitung perolehan poin secara otomatis saat barista menandai pesanan lunas (**PAID**) atau selesai (**COMPLETED**). Poin langsung ditransfer ke akun customer.
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REWARDS CATALOG */}
          {activeSubTab === 'rewards' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-[#E0F2FE] rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.01)]">
                <div>
                  <span className="block text-xs font-bold text-[#172033] uppercase">Katalog Penukaran Poin</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Berikut adalah daftar hadiah/voucher yang dapat diklaim member Leton dengan menukarkan poin mereka.</span>
                </div>
                <button
                  onClick={() => {
                    setEditingReward(null);
                    setRewardForm({
                      name: '',
                      description: '',
                      pointsRequired: 10,
                      rewardType: 'DISCOUNT_NOMINAL',
                      rewardValue: 5000,
                      isActive: true,
                    });
                    setShowRewardModal(true);
                  }}
                  className="px-4 py-2 bg-[#0284C7] hover:bg-[#0274B7] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>TAMBAH REWARD BARU</span>
                </button>
              </div>

              {rewards.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-[#E0F2FE] text-slate-400">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#172033]">Katalog Reward Masih Kosong</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Mulai dengan menambahkan reward penukaran poin seperti voucher potongan nominal diskon atau minuman gratis.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className={`bg-white rounded-2xl border ${
                        reward.isActive ? 'border-[#E0F2FE]' : 'border-slate-200 bg-slate-50/50'
                      } p-5 shadow-[0_1px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between relative overflow-hidden`}
                    >
                      {/* Points badge overlay */}
                      <div className="absolute right-0 top-0 bg-amber-500 text-white font-mono font-bold text-xs px-3.5 py-1.5 rounded-bl-2xl shadow-sm">
                        {reward.pointsRequired} Poin
                      </div>

                      <div className="space-y-2.5 pr-20">
                        <div className="inline-flex px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider bg-slate-100 text-slate-600">
                          {reward.rewardType === 'DISCOUNT_NOMINAL'
                            ? 'VOUCHER POTONGAN HARGA'
                            : reward.rewardType === 'DISCOUNT_PERCENT'
                            ? 'DISKON PERSENTASE'
                            : 'FREE ITEM / MINUMAN'}
                        </div>
                        <h4 className="font-bold text-[#172033] text-sm sm:text-base leading-snug line-clamp-1">{reward.name}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">{reward.description || 'Tidak ada deskripsi.'}</p>
                      </div>

                      <div className="border-t border-[#F1F5F9] pt-4 mt-4 flex items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="block text-[10px] text-slate-400 font-medium">Nilai Hadiah:</span>
                          <span className="font-bold text-slate-700">
                            {reward.rewardType === 'DISCOUNT_PERCENT'
                              ? `${reward.rewardValue}%`
                              : formatRupiah(reward.rewardValue)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditReward(reward)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Edit Reward"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRewardClick(reward.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Reward"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMER BALANCES */}
          {activeSubTab === 'customers' && (
            <div className="space-y-4">
              {/* Search filter for customer */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Cari member berdasarkan Nama, No. WhatsApp, atau ID Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#0284C7] transition-all"
                />
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-[#E0F2FE] text-slate-400">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#172033]">Customer Tidak Ditemukan</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan kata kunci lain atau belum ada member yang terdaftar di dalam sistem.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E0F2FE] overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.01)]">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-slate-500 font-mono font-bold uppercase tracking-wider">
                          <th className="p-3.5 pl-5">Nama Member</th>
                          <th className="p-3.5">No. WhatsApp</th>
                          <th className="p-3.5 text-center">Saldo Poin</th>
                          <th className="p-3.5 text-center">Poin Diperoleh</th>
                          <th className="p-3.5 text-center">Poin Ditukar</th>
                          <th className="p-3.5 pr-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] text-slate-700">
                        {filteredCustomers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3.5 pl-5">
                              <span className="block font-bold text-[#172033]">{cust.namaLengkap}</span>
                              <span className="block text-[10px] text-slate-400 font-mono uppercase mt-0.5">{cust.id}</span>
                            </td>
                            <td className="p-3.5 font-mono text-slate-600">{cust.nomorHp || '-'}</td>
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center justify-center font-mono font-black text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                                {cust.pointsBalance}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono text-emerald-600 font-semibold">
                              +{cust.totalPointsEarned}
                            </td>
                            <td className="p-3.5 text-center font-mono text-rose-600 font-semibold">
                              -{cust.totalPointsRedeemed}
                            </td>
                            <td className="p-3.5 pr-5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedCustomerForAdj(cust);
                                  setAdjForm({ points: 10, type: 'MANUAL_ADD', reason: '' });
                                  setShowAdjModal(true);
                                }}
                                className="px-3 py-1.5 border border-amber-200 hover:bg-amber-50 text-amber-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer uppercase tracking-wider"
                              >
                                Sesuaikan Poin
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: JURNAL HISTORY TRANSACTIONS */}
          {activeSubTab === 'history' && (
            <div className="space-y-4">
              {/* Search Filter for Ledger */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Cari transaksi berdasarkan ID, Customer ID, order ID, atau tipe (e.g. EARN)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#0284C7] transition-all"
                />
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-[#E0F2FE] text-slate-400">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#172033]">Belum Ada Transaksi</p>
                  <p className="text-xs text-slate-400 mt-1">Seluruh mutasi kredit & debit poin member Leton akan tercatat lengkap di halaman ini.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E0F2FE] overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.01)]">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-[#F8FBFF] border-b border-[#E0F2FE] text-slate-500 font-mono font-bold uppercase tracking-wider">
                          <th className="p-3.5 pl-5">ID / WAKTU</th>
                          <th className="p-3.5">Customer ID</th>
                          <th className="p-3.5">Jenis Mutasi</th>
                          <th className="p-3.5 text-center">Jumlah Poin</th>
                          <th className="p-3.5 text-center">Saldo Sebelum</th>
                          <th className="p-3.5 text-center">Saldo Sesudah</th>
                          <th className="p-3.5 pr-5">Keterangan / Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] text-slate-700">
                        {filteredTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3.5 pl-5">
                              <span className="block font-mono font-bold text-slate-800">{tx.id}</span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {new Date(tx.createdAt).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-[#0284C7] font-semibold">{tx.customerId}</td>
                            <td className="p-3.5">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                                  tx.transactionType === 'EARN'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : tx.transactionType === 'REDEEM'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                    : tx.transactionType.includes('MANUAL_ADD')
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}
                              >
                                {tx.transactionType}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono font-black text-xs">
                              {tx.points > 0 ? (
                                <span className="text-emerald-600">+{tx.points}</span>
                              ) : (
                                <span className="text-rose-600">{tx.points}</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-400">{tx.balanceBefore}</td>
                            <td className="p-3.5 text-center font-mono text-slate-800 font-bold">{tx.balanceAfter}</td>
                            <td className="p-3.5 pr-5">
                              <span className="block font-semibold text-slate-800">{tx.reason}</span>
                              {tx.adminUsername && (
                                <span className="block text-[10px] text-slate-400 mt-0.5">Oleh: {tx.adminUsername}</span>
                              )}
                              {tx.referenceOrderId && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md mt-1">
                                  Ref Order: #{tx.referenceOrderId}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT REWARD */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="p-6 bg-gradient-to-r from-[#0284C7] to-[#0274B7] text-white flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-lg uppercase">
                  {editingReward ? 'EDIT REWARD KATALOG' : 'TAMBAH REWARD BARU'}
                </h3>
                <p className="text-[10px] text-white/80 mt-0.5">Konfigurasikan detail voucher penukaran poin member.</p>
              </div>
              <button
                onClick={() => setShowRewardModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRewardSubmit} className="p-6 space-y-4">
              {/* Reward Name */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Nama Reward</label>
                <input
                  type="text"
                  value={rewardForm.name}
                  onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-semibold focus:outline-none focus:border-[#0284C7]"
                  placeholder="e.g. Potongan Rp10.000"
                  required
                />
              </div>

              {/* Reward Description */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Deskripsi</label>
                <textarea
                  value={rewardForm.description}
                  onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#0284C7] h-16 resize-none"
                  placeholder="e.g. Dapatkan potongan harga untuk transaksi Anda selanjutnya."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Points Required */}
                <div>
                  <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Poin Diperlukan</label>
                  <input
                    type="number"
                    value={rewardForm.pointsRequired}
                    onChange={(e) => setRewardForm({ ...rewardForm, pointsRequired: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-mono font-bold focus:outline-none focus:border-[#0284C7]"
                    required
                  />
                </div>

                {/* Reward Type */}
                <div>
                  <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Jenis Reward</label>
                  <select
                    value={rewardForm.rewardType}
                    onChange={(e) => setRewardForm({ ...rewardForm, rewardType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-bold focus:outline-none focus:border-[#0284C7]"
                  >
                    <option value="DISCOUNT_NOMINAL">POTONGAN NOMINAL (Rp)</option>
                    <option value="DISCOUNT_PERCENT">DISKON PERSENTASE (%)</option>
                    <option value="FREE_ITEM">FREE ITEM (MINUMAN)</option>
                  </select>
                </div>
              </div>

              {/* Reward Value */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">
                  Nilai Reward {rewardForm.rewardType === 'DISCOUNT_PERCENT' ? '(%)' : '(Rupiah)'}
                </label>
                <div className="relative">
                  {rewardForm.rewardType !== 'DISCOUNT_PERCENT' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  )}
                  <input
                    type="number"
                    value={rewardForm.rewardValue}
                    onChange={(e) => setRewardForm({ ...rewardForm, rewardValue: Math.max(0, Number(e.target.value)) })}
                    className={`w-full ${
                      rewardForm.rewardType !== 'DISCOUNT_PERCENT' ? 'pl-9' : 'px-3.5'
                    } py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-mono font-bold focus:outline-none focus:border-[#0284C7]`}
                    required
                  />
                </div>
              </div>

              {/* Status Switch Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="block text-xs font-bold text-[#172033]">Status Reward Aktif</span>
                  <span className="block text-[9px] text-slate-400">Reward tidak aktif tidak dapat dipilih customer.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rewardForm.isActive}
                    onChange={(e) => setRewardForm({ ...rewardForm, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Submit triggers */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRewardModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[#0284C7] hover:bg-[#0274B7] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingReward ? 'Simpan Edit' : 'Simpan Reward'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL ADJUSTMENT POIN */}
      {showAdjModal && selectedCustomerForAdj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-lg uppercase">SESUAIKAN SALDO POIN</h3>
                <p className="text-[10px] text-white/90 mt-0.5">Edit manual saldo poin customer secara aman dan tercatat.</p>
              </div>
              <button
                onClick={() => {
                  setShowAdjModal(false);
                  setSelectedCustomerForAdj(null);
                }}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjSubmit} className="p-6 space-y-4">
              {/* Customer Profile Mini card */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="block font-bold text-[#172033]">{selectedCustomerForAdj.namaLengkap}</span>
                  <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{selectedCustomerForAdj.nomorHp}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Saldo Saat Ini:</span>
                  <span className="font-mono font-black text-amber-600 text-sm">{selectedCustomerForAdj.pointsBalance} Poin</span>
                </div>
              </div>

              {/* Adjustment Type Credit/Debit */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1.5">Aksi Penyesuaian</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjForm({ ...adjForm, type: 'MANUAL_ADD' })}
                    className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      adjForm.type === 'MANUAL_ADD'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                    <span>TAMBAH POIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjForm({ ...adjForm, type: 'MANUAL_SUB' })}
                    className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      adjForm.type === 'MANUAL_SUB'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 shrink-0" />
                    <span>KURANGI POIN</span>
                  </button>
                </div>
              </div>

              {/* Points Amount */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Jumlah Poin</label>
                <input
                  type="number"
                  value={adjForm.points}
                  onChange={(e) => setAdjForm({ ...adjForm, points: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] font-mono font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Reason / Note */}
              <div>
                <label className="block text-xs font-bold text-[#172033] uppercase tracking-wide mb-1">Alasan / Catatan</label>
                <textarea
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9FAFB] border border-[#D0D5DD] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-amber-500 h-16 resize-none"
                  placeholder="e.g. Kompensasi kesalahan kasir / Hadiah ulang tahun"
                  required
                />
              </div>

              {/* Footer triggers */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjModal(false);
                    setSelectedCustomerForAdj(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Terapkan Penyesuaian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SQL INITIALIZATION DIALOG */}
      {showSqlDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1E293B] text-slate-100 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-700 animate-scaleUp flex flex-col max-h-[85vh]">
            <div className="p-6 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-display font-black text-sm sm:text-base uppercase text-white">SCRIPT INISIALISASI DATABASE LOYALTY</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Salin script SQL di bawah ini dan jalankan di SQL Editor dashboard Supabase Anda.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlDialog(false)}
                className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-xs leading-relaxed text-slate-300">
                <span className="block font-bold text-white mb-1">Panduan Pengaktifan Database:</span>
                1. Masuk ke dashboard proyek Supabase Anda.<br />
                2. Klik tab <strong className="text-white">"SQL Editor"</strong> di menu samping kiri.<br />
                3. Klik tombol <strong className="text-white">"+ New Query"</strong>.<br />
                4. Klik tombol "Salin Kode" di bawah ini, lalu <strong className="text-white">Paste</strong> kode tersebut ke area editor Supabase.<br />
                5. Klik tombol <strong className="text-white">"Run"</strong> (atau tekan Ctrl+Enter). Setelah sukses, segarkan halaman admin Leton ini!
              </div>

              {/* Scrollable code viewer */}
              <div className="relative">
                <button
                  onClick={handleCopySql}
                  className="absolute right-4 top-4 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Kode SQL</span>
                </button>
                <pre
                  id="loyalty-sql-code"
                  className="p-5 bg-slate-950 rounded-2xl text-[10px] sm:text-xs font-mono overflow-x-auto text-emerald-400 border border-slate-800 leading-relaxed max-h-[250px] overflow-y-auto"
                >
{`-- ==============================================================================
-- LETON COFFEE DUMAI - LOYALTY SYSTEM SCHEMA
-- ==============================================================================

-- 10. Table: Loyalty Settings
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  earning_amount_per_point NUMERIC NOT NULL DEFAULT 10000,
  calculation_basis TEXT NOT NULL DEFAULT 'SUBTOTAL', -- 'SUBTOTAL' | 'TOTAL' (after discount)
  expiration_mode TEXT NOT NULL DEFAULT 'NEVER', -- 'NEVER' | 'DAYS'
  expiration_days INTEGER NOT NULL DEFAULT 365,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.loyalty_settings (id, is_active, earning_amount_per_point, calculation_basis, expiration_mode, expiration_days)
VALUES ('default', true, 10000, 'SUBTOTAL', 'NEVER', 365)
ON CONFLICT (id) DO NOTHING;

-- 11. Table: Loyalty Rewards
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- 'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL' | 'FREE_ITEM'
  reward_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  redeem_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rewards
INSERT INTO public.loyalty_rewards (id, name, description, points_required, reward_type, reward_value, is_active)
VALUES 
  ('rwd-1', 'Potongan Rp5.000', 'Diskon langsung Rp5.000 untuk transaksi berikutnya.', 15, 'DISCOUNT_NOMINAL', 5000, true),
  ('rwd-2', 'Potongan Rp10.000', 'Diskon langsung Rp10.000 untuk transaksi berikutnya.', 28, 'DISCOUNT_NOMINAL', 10000, true),
  ('rwd-3', 'Free Redvelvet Leton', 'Klaim 1x Cup Redvelvet Leton gratis.', 40, 'FREE_ITEM', 22000, true)
ON CONFLICT (id) DO NOTHING;

-- 12. Ensure columns in public.customers for loyalty balances
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_points_redeemed INTEGER NOT NULL DEFAULT 0;

-- 13. Table: Loyalty Point Transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'EARN' | 'REDEEM' | 'MANUAL_ADD' | 'MANUAL_SUB' | 'EXPIRED'
  points INTEGER NOT NULL, -- positive for credit, negative for debit
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  reference_reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reason TEXT,
  admin_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Table: Reward Redemptions (Vouchers)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_id TEXT REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC NOT NULL,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'USED' | 'EXPIRED'
  reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL, -- order where it was used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

-- 15. Create secure function for manual adjustments and automatic point earnings
-- Ensures atomic updates to customer points balance and records transaction securely.
CREATE OR REPLACE FUNCTION public.adjust_customer_points(
  p_customer_id TEXT,
  p_points INTEGER, -- can be positive (earn/add) or negative (redeem/sub)
  p_type TEXT,
  p_reason TEXT,
  p_ref_order_id TEXT DEFAULT NULL,
  p_ref_reward_id TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_bal INTEGER := 0;
  v_new_bal INTEGER := 0;
  v_tx_id TEXT;
  v_earned_inc INTEGER := 0;
  v_redeemed_inc INTEGER := 0;
  v_customer_exists BOOLEAN;
BEGIN
  -- 1. Check if customer exists
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE id = p_customer_id) INTO v_customer_exists;
  IF NOT v_customer_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer tidak ditemukan');
  END IF;

  -- 2. Lock customer row and get current balance
  SELECT points_balance INTO v_current_bal
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_bal := v_current_bal + p_points;

  -- Prevent negative balance
  IF v_new_bal < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo point tidak mencukupi');
  END IF;

  -- Set increments
  IF p_points > 0 THEN
    v_earned_inc := p_points;
  ELSE
    v_redeemed_inc := ABS(p_points);
  END IF;

  -- 3. Update customer table
  UPDATE public.customers
  SET 
    points_balance = v_new_bal,
    total_points_earned = total_points_earned + v_earned_inc,
    total_points_redeemed = total_points_redeemed + v_redeemed_inc,
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Generate transaction ID
  v_tx_id := 'TX-' || floor(random() * 900000 + 100000)::text;

  -- 4. Record transaction history
  INSERT INTO public.loyalty_transactions (
    id, customer_id, transaction_type, points, balance_before, balance_after,
    reference_order_id, reference_reward_id, reason, admin_username, created_at
  ) VALUES (
    v_tx_id, p_customer_id, p_type, p_points, v_current_bal, v_new_bal,
    p_ref_order_id, p_ref_reward_id, p_reason, p_admin, NOW()
  );

  RETURN jsonb_build_object(
    'success', true, 
    'transaction_id', v_tx_id, 
    'points_balance', v_new_bal,
    'points_adjusted', p_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 16. Create secure function for reward redemption (atomic check-then-redeem)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_customer_id TEXT,
  p_reward_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_points_required INTEGER;
  v_reward_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
  v_is_active BOOLEAN;
  v_current_bal INTEGER;
  v_new_bal INTEGER;
  v_redemption_id TEXT;
  v_tx_res JSONB;
BEGIN
  -- 1. Get reward detail
  SELECT name, points_required, reward_type, reward_value, is_active
  INTO v_reward_name, v_points_required, v_reward_type, v_reward_value, v_is_active
  FROM public.loyalty_rewards
  WHERE id = p_reward_id;

  IF v_reward_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward tidak ditemukan');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward sedang tidak aktif');
  END IF;

  -- 2. Call adjust_customer_points to securely deduct points
  v_tx_res := public.adjust_customer_points(
    p_customer_id,
    -v_points_required,
    'REDEEM',
    'Redeem Reward: ' || v_reward_name,
    NULL,
    p_reward_id,
    NULL
  );

  IF NOT (v_tx_res->>'success')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_tx_res->>'error', 'Redeem gagal'));
  END IF;

  -- 3. Create redemption voucher record
  v_redemption_id := 'VCH-' || floor(random() * 900000 + 100000)::text;
  
  INSERT INTO public.reward_redemptions (
    id, customer_id, reward_id, reward_name, reward_type, reward_value, 
    points_spent, status, created_at, expires_at
  ) VALUES (
    v_redemption_id, p_customer_id, p_reward_id, v_reward_name, v_reward_type, v_reward_value,
    v_points_required, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days'
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'reward_name', v_reward_name,
    'points_spent', v_points_required,
    'points_balance', (v_tx_res->>'points_balance')::integer
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 17. Create secure function to trigger automatic point earning for a PAID/COMPLETED order.
CREATE OR REPLACE FUNCTION public.process_order_points_earning(
  p_order_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order_exists BOOLEAN;
  v_customer_id TEXT;
  v_total_amount NUMERIC;
  v_payment_status TEXT;
  v_order_status TEXT;
  v_is_active BOOLEAN;
  v_earning_amount NUMERIC;
  v_calc_basis TEXT;
  v_points_to_earn INTEGER;
  v_points_calculated NUMERIC;
  v_already_earned BOOLEAN;
  v_res JSONB;
BEGIN
  -- 1. Check if points earning already processed for this order
  SELECT EXISTS(
    SELECT 1 FROM public.loyalty_transactions 
    WHERE reference_order_id = p_order_id AND transaction_type = 'EARN'
  ) INTO v_already_earned;

  IF v_already_earned THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin untuk pesanan ini sudah pernah diproses');
  END IF;

  -- 2. Fetch order details
  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order tidak ditemukan');
  END IF;

  SELECT customer_id, total_amount, payment_status, order_status
  INTO v_customer_id, v_total_amount, v_payment_status, v_order_status
  FROM public.orders
  WHERE id = p_order_id;

  -- Must have a valid customer_id linked
  IF v_customer_id IS NULL OR v_customer_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pesanan tidak ditautkan ke member customer_id');
  END IF;

  -- Order must be PAID or COMPLETED
  IF v_payment_status <> 'PAID' AND v_order_status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poin hanya diberikan untuk pesanan dengan status PAID atau COMPLETED');
  END IF;

  -- 3. Fetch loyalty settings
  SELECT is_active, earning_amount_per_point, calculation_basis
  INTO v_is_active, v_earning_amount, v_calc_basis
  FROM public.loyalty_settings
  WHERE id = 'default';

  IF v_is_active IS NULL OR NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sistem Loyalty Point sedang dinonaktifkan oleh Admin');
  END IF;

  -- 4. Calculate points
  v_points_calculated := floor(v_total_amount / v_earning_amount);
  v_points_to_earn := v_points_calculated::integer;

  IF v_points_to_earn <= 0 THEN
    RETURN jsonb_build_object('success', true, 'points_earned', 0, 'message', 'Nominal transaksi tidak mencapai batas minimum perolehan poin');
  END IF;

  -- 5. Credit points via adjust_customer_points
  v_res := public.adjust_customer_points(
    v_customer_id,
    v_points_to_earn,
    'EARN',
    'Earn point dari Pesanan #' || p_order_id,
    p_order_id,
    NULL,
    NULL
  );

  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 18. Enable RLS and create public policies
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Allow reading loyalty settings and rewards for anyone
CREATE POLICY "Allow read loyalty_settings" ON public.loyalty_settings FOR SELECT USING (true);
CREATE POLICY "Allow read loyalty_rewards" ON public.loyalty_rewards FOR SELECT USING (true);
CREATE POLICY "Allow read loyalty_transactions" ON public.loyalty_transactions FOR SELECT USING (true);
CREATE POLICY "Allow read reward_redemptions" ON public.reward_redemptions FOR SELECT USING (true);

-- Allow admins full access to settings, rewards, and transactions
CREATE POLICY "Admins manage loyalty_settings" ON public.loyalty_settings 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage loyalty_rewards" ON public.loyalty_rewards 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage loyalty_transactions" ON public.loyalty_transactions 
  FOR ALL USING (get_current_admin_role() = 'super_admin');

CREATE POLICY "Admins manage reward_redemptions" ON public.reward_redemptions 
  FOR ALL USING (get_current_admin_role() = 'super_admin');`}
                </pre>
              </div>
            </div>

            <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end shrink-0">
              <button
                onClick={() => setShowSqlDialog(false)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
