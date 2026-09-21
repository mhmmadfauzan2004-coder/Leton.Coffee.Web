import { getSupabase, isSupabaseConfigured } from './supabase';
import { CustomerOrder, CustomerProfile } from '../types';

function shouldFallback(): boolean {
  return !isSupabaseConfigured();
}

export interface LoyaltySettings {
  id: string;
  isActive: boolean;
  earningAmountPerPoint: number;
  calculationBasis: 'SUBTOTAL' | 'TOTAL';
  expirationMode: 'NEVER' | 'DAYS';
  expirationDays: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  rewardType: 'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL' | 'FREE_ITEM';
  rewardValue: number;
  isActive: boolean;
  redeemLimit?: number | null;
  createdAt?: string;
}

export interface PointTransaction {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  transactionType: 'EARN' | 'REDEEM' | 'MANUAL_ADD' | 'MANUAL_SUB' | 'EXPIRED';
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceOrderId?: string | null;
  referenceRewardId?: string | null;
  reason: string;
  adminUsername?: string | null;
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  customerId: string;
  rewardId: string;
  rewardName: string;
  rewardType: string;
  rewardValue: number;
  pointsSpent: number;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  referenceOrderId?: string | null;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string | null;
}

// Default in-memory/localStorage cache for fallback when Supabase tables are not migrated
const STORAGE_KEYS = {
  SETTINGS: 'leton_loyalty_settings',
  REWARDS: 'leton_loyalty_rewards',
  TRANSACTIONS: 'leton_loyalty_transactions',
  REDEMPTIONS: 'leton_loyalty_redemptions',
  CUSTOMERS: 'leton_loyalty_customers_points', // fallback points database
};

const DEFAULT_SETTINGS: LoyaltySettings = {
  id: 'default',
  isActive: true,
  earningAmountPerPoint: 10000,
  calculationBasis: 'SUBTOTAL',
  expirationMode: 'NEVER',
  expirationDays: 365,
};

const DEFAULT_REWARDS: LoyaltyReward[] = [
  {
    id: 'rwd-1',
    name: 'Potongan Rp5.000',
    description: 'Diskon langsung Rp5.000 untuk transaksi berikutnya.',
    pointsRequired: 15,
    rewardType: 'DISCOUNT_NOMINAL',
    rewardValue: 5000,
    isActive: true,
  },
  {
    id: 'rwd-2',
    name: 'Potongan Rp10.000',
    description: 'Diskon langsung Rp10.000 untuk transaksi berikutnya.',
    pointsRequired: 28,
    rewardType: 'DISCOUNT_NOMINAL',
    rewardValue: 10000,
    isActive: true,
  },
  {
    id: 'rwd-3',
    name: 'Free Redvelvet Leton',
    description: 'Klaim 1x Cup Redvelvet Leton gratis.',
    pointsRequired: 40,
    rewardType: 'FREE_ITEM',
    rewardValue: 22000,
    isActive: true,
  },
];

// Helper to check if a specific error is "table or view does not exist" (42P01)
function isTableMissingError(error: any): boolean {
  return error && (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation "') || error.message?.includes('404'));
}

/**
 * 1. Fetch loyalty settings
 */
export async function getLoyaltySettings(): Promise<{ settings: LoyaltySettings; isFallback: boolean }> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('loyalty_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        return { settings: getLocalSettings(), isFallback: true };
      }
      throw error;
    }

    if (data) {
      return {
        settings: {
          id: data.id,
          isActive: Boolean(data.is_active),
          earningAmountPerPoint: Number(data.earning_amount_per_point),
          calculationBasis: data.calculation_basis as 'SUBTOTAL' | 'TOTAL',
          expirationMode: data.expiration_mode as 'NEVER' | 'DAYS',
          expirationDays: Number(data.expiration_days || 365),
        },
        isFallback: false,
      };
    }

    // Seed default settings into Supabase if empty
    const defaultPayload = {
      id: 'default',
      is_active: DEFAULT_SETTINGS.isActive,
      earning_amount_per_point: DEFAULT_SETTINGS.earningAmountPerPoint,
      calculation_basis: DEFAULT_SETTINGS.calculationBasis,
      expiration_mode: DEFAULT_SETTINGS.expirationMode,
      expiration_days: DEFAULT_SETTINGS.expirationDays,
    };

    const { error: insertError } = await client
      .from('loyalty_settings')
      .insert(defaultPayload);

    if (insertError) {
      if (isTableMissingError(insertError) && shouldFallback()) {
        return { settings: getLocalSettings(), isFallback: true };
      }
      throw insertError;
    }

    return { settings: DEFAULT_SETTINGS, isFallback: false };
  } catch (err: any) {
    console.warn('[Loyalty] Failed to fetch settings from Supabase:', err);
    if (shouldFallback()) {
      return { settings: getLocalSettings(), isFallback: true };
    }
    throw new Error('Gagal memuat konfigurasi loyalty dari database: ' + err.message);
  }
}

function getLocalSettings(): LoyaltySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * 2. Save loyalty settings
 */
export async function saveLoyaltySettings(settings: LoyaltySettings): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    const payload = {
      id: 'default',
      is_active: settings.isActive,
      earning_amount_per_point: settings.earningAmountPerPoint,
      calculation_basis: settings.calculationBasis,
      expiration_mode: settings.expirationMode,
      expiration_days: settings.expirationDays,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('loyalty_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        saveLocalSettings(settings);
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Loyalty] Error saving settings:', err);
    if (shouldFallback()) {
      saveLocalSettings(settings);
      return { success: true };
    }
    return { success: false, error: 'Gagal menyimpan pengaturan loyalty ke database: ' + err.message };
  }
}

function saveLocalSettings(settings: LoyaltySettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
}

/**
 * 3. Fetch loyalty rewards list (CRUD)
 */
export async function getLoyaltyRewards(): Promise<{ rewards: LoyaltyReward[]; isFallback: boolean }> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('loyalty_rewards')
      .select('*')
      .order('points_required', { ascending: true });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        return { rewards: getLocalRewards(), isFallback: true };
      }
      throw error;
    }

    if (data && data.length > 0) {
      const mapped: LoyaltyReward[] = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        pointsRequired: Number(r.points_required),
        rewardType: r.reward_type,
        rewardValue: Number(r.reward_value),
        isActive: Boolean(r.is_active),
        redeemLimit: r.redeem_limit ? Number(r.redeem_limit) : null,
        createdAt: r.created_at,
      }));
      return { rewards: mapped, isFallback: false };
    }

    return { rewards: getLocalRewards(), isFallback: false };
  } catch (err: any) {
    console.warn('[Loyalty] Failed to fetch rewards:', err);
    if (shouldFallback()) {
      return { rewards: getLocalRewards(), isFallback: true };
    }
    throw new Error('Gagal memuat katalog reward dari database: ' + err.message);
  }
}

function getLocalRewards(): LoyaltyReward[] {
  if (typeof window === 'undefined') return DEFAULT_REWARDS;
  const raw = localStorage.getItem(STORAGE_KEYS.REWARDS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(DEFAULT_REWARDS));
    return DEFAULT_REWARDS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_REWARDS;
  }
}

/**
 * 4. Save (Create or Update) loyalty reward
 */
export async function saveLoyaltyReward(reward: LoyaltyReward): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    const payload = {
      id: reward.id,
      name: reward.name,
      description: reward.description,
      points_required: reward.pointsRequired,
      reward_type: reward.rewardType,
      reward_value: reward.rewardValue,
      is_active: reward.isActive,
      redeem_limit: reward.redeemLimit || null,
      created_at: reward.createdAt || new Date().toISOString(),
    };

    const { error } = await client
      .from('loyalty_rewards')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        saveLocalReward(reward);
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Loyalty] Save reward database error:', err);
    if (shouldFallback()) {
      saveLocalReward(reward);
      return { success: true };
    }
    return { success: false, error: 'Gagal menyimpan reward ke database: ' + err.message };
  }
}

function saveLocalReward(reward: LoyaltyReward) {
  const list = getLocalRewards();
  const index = list.findIndex((r) => r.id === reward.id);
  if (index >= 0) {
    list[index] = reward;
  } else {
    list.push(reward);
  }
  localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(list));
}

/**
 * 5. Delete loyalty reward
 */
export async function deleteLoyaltyReward(rewardId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    const { error } = await client
      .from('loyalty_rewards')
      .delete()
      .eq('id', rewardId);

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        deleteLocalReward(rewardId);
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Loyalty] Delete reward error:', err);
    if (shouldFallback()) {
      deleteLocalReward(rewardId);
      return { success: true };
    }
    return { success: false, error: 'Gagal menghapus reward dari database: ' + err.message };
  }
}

function deleteLocalReward(id: string) {
  const list = getLocalRewards();
  const filtered = list.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(filtered));
}

/**
 * 6. Get Customer loyalty balance and details
 */
export interface CustomerLoyaltyData {
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

export async function getCustomerLoyalty(customerId: string): Promise<CustomerLoyaltyData> {
  try {
    const client = getSupabase();

    // 0. Primary: call secure SECURITY DEFINER RPC function to bypass RLS restrictions
    try {
      console.log('Fetching loyalty for:', customerId);
      const { data: rpcData, error: rpcErr } = await client.rpc('get_customer_loyalty_summary_rpc', {
        p_customer_id: customerId
      });
      console.log('RPC loyalty result:', { rpcData, rpcErr });
      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const res = rpcData as any;
        if (res.success) {
          return {
            pointsBalance: Number(res.pointsBalance || 0),
            totalPointsEarned: Number(res.totalPointsEarned || 0),
            totalPointsRedeemed: Number(res.totalPointsRedeemed || 0),
          };
        }
      }
    } catch (e) {
      console.error('RPC error:', e);
    }

    // 1. Secondary: query customers table directly
    try {
      const { data: custData, error: custErr } = await client
        .from('customers')
        .select('points_balance, total_points_earned, total_points_redeemed')
        .eq('id', customerId)
        .maybeSingle();

      if (!custErr && custData) {
        return {
          pointsBalance: Number(custData.points_balance || 0),
          totalPointsEarned: Number(custData.total_points_earned || 0),
          totalPointsRedeemed: Number(custData.total_points_redeemed || 0),
        };
      }
    } catch {
      // Continue to next lookup
    }

    // 2. Secondary: query customer_points table if present in custom schema
    try {
      const { data, error } = await client
        .from('customer_points')
        .select('current_balance, total_points_earned, total_points_redeemed')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (!error && data) {
        return {
          pointsBalance: Number(data.current_balance || 0),
          totalPointsEarned: Number(data.total_points_earned || 0),
          totalPointsRedeemed: Number(data.total_points_redeemed || 0),
        };
      }
    } catch {
      // Continue to transactions lookup
    }

    // 3. Tertiary: calculate balance from loyalty_transactions
    try {
      const { data: txData, error: txErr } = await client
        .from('loyalty_transactions')
        .select('points, transaction_type, balance_after')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!txErr && txData && txData.length > 0) {
        const latestBalance = Number(txData[0].balance_after || 0);
        let earned = 0;
        let redeemed = 0;
        for (const t of txData) {
          const pts = Number(t.points || 0);
          if (pts > 0) earned += pts;
          else redeemed += Math.abs(pts);
        }
        return {
          pointsBalance: latestBalance,
          totalPointsEarned: earned,
          totalPointsRedeemed: redeemed,
        };
      }
    } catch {
      // Continue to local storage
    }

    return getLocalCustomerLoyalty(customerId);
  } catch (err: any) {
    return getLocalCustomerLoyalty(customerId);
  }
}

function getLocalCustomerLoyalty(customerId: string): CustomerLoyaltyData {
  if (typeof window === 'undefined') return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
  const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  if (!raw) return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
  try {
    const db = JSON.parse(raw);
    if (db[customerId]) {
      return {
        pointsBalance: Number(db[customerId].pointsBalance || 0),
        totalPointsEarned: Number(db[customerId].totalPointsEarned || 0),
        totalPointsRedeemed: Number(db[customerId].totalPointsRedeemed || 0),
      };
    }
  } catch {}
  return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
}

function updateLocalCustomerLoyalty(customerId: string, points: number, type: 'EARN' | 'REDEEM' | 'MANUAL_ADD' | 'MANUAL_SUB' | 'EXPIRED') {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '{}';
  try {
    const db = JSON.parse(raw);
    if (!db[customerId]) {
      db[customerId] = { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
    }
    const current = db[customerId];
    const before = current.pointsBalance;
    let after = before;

    let earnedInc = 0;
    let redeemedInc = 0;

    if (type === 'EARN' || type === 'MANUAL_ADD') {
      after = before + points;
      earnedInc = points;
    } else if (type === 'REDEEM' || type === 'MANUAL_SUB' || type === 'EXPIRED') {
      after = Math.max(0, before - Math.abs(points));
      redeemedInc = Math.abs(points);
    }

    db[customerId] = {
      pointsBalance: after,
      totalPointsEarned: current.totalPointsEarned + earnedInc,
      totalPointsRedeemed: current.totalPointsRedeemed + redeemedInc,
    };
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(db));
    return { before, after };
  } catch (err) {
    console.error('Error updating local loyalty:', err);
  }
  return { before: 0, after: 0 };
}

/**
 * 7. Fetch Loyalty Transactions list
 */
export async function getLoyaltyTransactions(customerId?: string): Promise<PointTransaction[]> {
  try {
    const client = getSupabase();
    let query = client.from('loyalty_transactions').select('*');
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        return getLocalTransactions(customerId);
      }
      throw error;
    }

    if (data) {
      return data.map((t: any) => ({
        id: t.id,
        customerId: t.customer_id,
        transactionType: t.transaction_type,
        points: Number(t.points),
        balanceBefore: Number(t.balance_before),
        balanceAfter: Number(t.balance_after),
        referenceOrderId: t.reference_order_id,
        referenceRewardId: t.reference_reward_id,
        reason: t.reason,
        adminUsername: t.admin_username,
        createdAt: t.created_at,
      }));
    }
    return [];
  } catch (err: any) {
    console.warn('[Loyalty] Error fetching transactions:', err);
    if (shouldFallback()) {
      return getLocalTransactions(customerId);
    }
    throw new Error('Gagal memuat riwayat transaksi dari database: ' + err.message);
  }
}

function getLocalTransactions(customerId?: string): PointTransaction[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (!raw) return [];
  try {
    const list: PointTransaction[] = JSON.parse(raw);
    if (customerId) {
      return list.filter((t) => t.customerId === customerId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function addLocalTransaction(tx: PointTransaction) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]';
  try {
    const list: PointTransaction[] = JSON.parse(raw);
    list.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
  } catch {}
}

/**
 * 8. Fetch Redemptions (Vouchers) list
 */
export async function getRewardRedemptions(customerId?: string): Promise<RewardRedemption[]> {
  try {
    const client = getSupabase();
    let query = client.from('reward_redemptions').select('*');
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        return getLocalRedemptions(customerId);
      }
      throw error;
    }

    if (data) {
      return data.map((v: any) => ({
        id: v.id,
        customerId: v.customer_id,
        rewardId: v.reward_id,
        rewardName: v.reward_name,
        rewardType: v.reward_type,
        rewardValue: Number(v.reward_value),
        pointsSpent: Number(v.points_spent),
        status: v.status as 'ACTIVE' | 'USED' | 'EXPIRED',
        referenceOrderId: v.reference_order_id,
        createdAt: v.created_at,
        expiresAt: v.expires_at,
        usedAt: v.used_at,
      }));
    }
    return [];
  } catch (err: any) {
    console.warn('[Loyalty] Error fetching redemptions:', err);
    if (shouldFallback()) {
      return getLocalRedemptions(customerId);
    }
    throw new Error('Gagal memuat daftar voucher dari database: ' + err.message);
  }
}

function getLocalRedemptions(customerId?: string): RewardRedemption[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.REDEMPTIONS);
  if (!raw) return [];
  try {
    const list: RewardRedemption[] = JSON.parse(raw);
    if (customerId) {
      return list.filter((v) => v.customerId === customerId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function addLocalRedemption(voucher: RewardRedemption) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEYS.REDEMPTIONS) || '[]';
  try {
    const list: RewardRedemption[] = JSON.parse(raw);
    list.unshift(voucher);
    localStorage.setItem(STORAGE_KEYS.REDEMPTIONS, JSON.stringify(list));
  } catch {}
}

/**
 * 9. Core Transaction: Deduct points atomicly and create reward voucher (Redeem)
 */
export async function redeemReward(customerId: string, reward: LoyaltyReward): Promise<{ success: boolean; redemptionId?: string; error?: string }> {
  try {
    const client = getSupabase();
    
    // Attempt standard database RPC
    const { data, error } = await client.rpc('redeem_loyalty_reward', {
      p_customer_id: customerId,
      p_reward_id: reward.id,
    });

    if (error) {
      if ((isTableMissingError(error) || error.message?.includes('function')) && shouldFallback()) {
        // Fallback to local transaction logic
        return processLocalRedeem(customerId, reward);
      }
      return { success: false, error: error.message };
    }

    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed.success) {
        return { success: true, redemptionId: parsed.redemption_id };
      }
      return { success: false, error: parsed.error || 'Gagal menukarkan reward.' };
    }

    return { success: false, error: 'Empty database response' };
  } catch (err: any) {
    console.warn('[Loyalty] Database redeem failed:', err);
    if (shouldFallback()) {
      return processLocalRedeem(customerId, reward);
    }
    return { success: false, error: 'Database error: ' + err.message };
  }
}

function processLocalRedeem(customerId: string, reward: LoyaltyReward): { success: boolean; redemptionId?: string; error?: string } {
  const currentLoyalty = getLocalCustomerLoyalty(customerId);
  if (currentLoyalty.pointsBalance < reward.pointsRequired) {
    return { success: false, error: 'Poin Anda tidak mencukupi untuk menukar reward ini.' };
  }

  // Deduct points
  const { before, after } = updateLocalCustomerLoyalty(customerId, reward.pointsRequired, 'REDEEM') || { before: 0, after: 0 };

  // Create Point Transaction History
  const txId = 'TX-' + Math.floor(Math.random() * 900000 + 100000);
  const tx: PointTransaction = {
    id: txId,
    customerId,
    transactionType: 'REDEEM',
    points: -reward.pointsRequired,
    balanceBefore: before,
    balanceAfter: after,
    referenceRewardId: reward.id,
    reason: `Redeem Reward: ${reward.name}`,
    createdAt: new Date().toISOString(),
  };
  addLocalTransaction(tx);

  // Create Reward Redemption Voucher
  const redemptionId = 'VCH-' + Math.floor(Math.random() * 900000 + 100000);
  const voucher: RewardRedemption = {
    id: redemptionId,
    customerId,
    rewardId: reward.id,
    rewardName: reward.name,
    rewardType: reward.rewardType,
    rewardValue: reward.rewardValue,
    pointsSpent: reward.pointsRequired,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
  addLocalRedemption(voucher);

  return { success: true, redemptionId };
}

/**
 * 10. Core Transaction: Add/Deduct point manual adjustment from Admin Pusat
 */
export async function adjustCustomerPointsManual(
  customerId: string,
  points: number,
  type: 'MANUAL_ADD' | 'MANUAL_SUB',
  reason: string,
  adminUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabase();
    
    // Call DB atomic RPC
    const { data, error } = await client.rpc('adjust_customer_points_manual_rpc', {
      p_customer_id: customerId,
      p_points: type === 'MANUAL_ADD' ? points : -Math.abs(points),
      p_type: type,
      p_reason: reason,
      p_admin: adminUsername,
    });

    if (error) {
      if ((isTableMissingError(error) || error.message?.includes('function')) && shouldFallback()) {
        return processLocalManualAdjustment(customerId, points, type, reason, adminUsername);
      }
      return { success: false, error: error.message };
    }

    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed.success) {
        return { success: true };
      }
      return { success: false, error: parsed.error || 'Gagal menyesuaikan poin.' };
    }

    return { success: false, error: 'Empty response' };
  } catch (err: any) {
    console.warn('[Loyalty] Manual adjustment error:', err);
    if (shouldFallback()) {
      return processLocalManualAdjustment(customerId, points, type, reason, adminUsername);
    }
    return { success: false, error: 'Database error: ' + err.message };
  }
}

function processLocalManualAdjustment(
  customerId: string,
  points: number,
  type: 'MANUAL_ADD' | 'MANUAL_SUB',
  reason: string,
  adminUsername: string
): { success: boolean; error?: string } {
  const currentLoyalty = getLocalCustomerLoyalty(customerId);
  const adjustVal = type === 'MANUAL_ADD' ? points : -Math.abs(points);
  
  if (type === 'MANUAL_SUB' && currentLoyalty.pointsBalance < Math.abs(adjustVal)) {
    return { success: false, error: 'Pengurangan melebihi jumlah saldo poin customer saat ini.' };
  }

  const { before, after } = updateLocalCustomerLoyalty(customerId, points, type) || { before: 0, after: 0 };

  const txId = 'TX-' + Math.floor(Math.random() * 900000 + 100000);
  const tx: PointTransaction = {
    id: txId,
    customerId,
    transactionType: type,
    points: adjustVal,
    balanceBefore: before,
    balanceAfter: after,
    reason: reason || (type === 'MANUAL_ADD' ? 'Penambahan Poin Manual' : 'Pengurangan Poin Manual'),
    adminUsername,
    createdAt: new Date().toISOString(),
  };
  addLocalTransaction(tx);

  return { success: true };
}

/**
 * 11. Core Operation: Automatically award point when order is completed or paid
 */
export async function processOrderPointsEarning(order: CustomerOrder): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  // Prevent orders without valid customer_id
  const custId = order.customerId || order.userId;
  if (!custId) {
    return { success: false, error: 'Order tidak terhubung ke customer.' };
  }

  try {
    const client = getSupabase();
    
    // Call database RPC to perform safe idempotent point awarding
    const { data, error } = await client.rpc('process_order_points_earning', {
      p_order_id: order.id,
    });

    if (error) {
      if ((isTableMissingError(error) || error.message?.includes('function')) && shouldFallback()) {
        return processLocalOrderEarning(order);
      }
      return { success: false, error: error.message };
    }

    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return { success: Boolean(parsed.success), pointsEarned: parsed.points_earned, error: parsed.error };
    }

    return { success: false, error: 'Empty db response' };
  } catch (err: any) {
    console.warn('[Loyalty] processOrderPointsEarning database exception:', err);
    if (shouldFallback()) {
      return processLocalOrderEarning(order);
    }
    return { success: false, error: 'Database exception: ' + err.message };
  }
}

function processLocalOrderEarning(order: CustomerOrder): { success: boolean; pointsEarned?: number; error?: string } {
  const custId = order.customerId || order.userId;
  if (!custId) return { success: false, error: 'No customer linked' };

  // Check if already awarded
  const localTxs = getLocalTransactions(custId);
  const alreadyEarned = localTxs.some((t) => t.referenceOrderId === order.id && t.transactionType === 'EARN');
  if (alreadyEarned) {
    return { success: false, error: 'Sistem mendeteksi poin untuk pesanan ini sudah pernah diberikan.' };
  }

  const settings = getLocalSettings();
  if (!settings.isActive) {
    return { success: false, error: 'Sistem point nonaktif' };
  }

  // Calculate points based on Settings rules
  // Standard minimum transaction amount is 10k per point
  const calculationAmount = settings.calculationBasis === 'SUBTOTAL' ? order.totalAmount : order.totalAmount; // in this project, totalAmount is the available metric.
  const pointsToEarn = Math.floor(calculationAmount / settings.earningAmountPerPoint);

  if (pointsToEarn <= 0) {
    return { success: true, pointsEarned: 0 };
  }

  const { before, after } = updateLocalCustomerLoyalty(custId, pointsToEarn, 'EARN') || { before: 0, after: 0 };

  const txId = 'TX-' + Math.floor(Math.random() * 900000 + 100000);
  const tx: PointTransaction = {
    id: txId,
    customerId: custId,
    transactionType: 'EARN',
    points: pointsToEarn,
    balanceBefore: before,
    balanceAfter: after,
    referenceOrderId: order.id,
    reason: `Automatic Earning: Pesanan #${order.orderNumber}`,
    createdAt: new Date().toISOString(),
  };
  addLocalTransaction(tx);

  return { success: true, pointsEarned: pointsToEarn };
}

/**
 * 12. Retrieve all customers with their loyalty stats (for manual adjustments screen)
 */
export async function getCustomersWithLoyalty(): Promise<any[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, points_balance, total_points_earned, total_points_redeemed')
      .order('nama_lengkap', { ascending: true });

    if (error) {
      if (isTableMissingError(error) && shouldFallback()) {
        return getLocalCustomersWithLoyalty();
      }
      throw error;
    }

    if (data) {
      return data.map((c: any) => ({
        id: c.id,
        namaLengkap: c.nama_lengkap,
        nomorHp: c.nomor_hp,
        pointsBalance: Number(c.points_balance || 0),
        totalPointsEarned: Number(c.total_points_earned || 0),
        totalPointsRedeemed: Number(c.total_points_redeemed || 0),
      }));
    }
    return [];
  } catch (err: any) {
    console.warn('[Loyalty] Error fetching customers list:', err);
    if (shouldFallback()) {
      return getLocalCustomersWithLoyalty();
    }
    throw new Error('Gagal memuat daftar pelanggan dari database: ' + err.message);
  }
}

function getLocalCustomersWithLoyalty(): any[] {
  // Try retrieving customers from localStorage key used for auth profiles
  if (typeof window === 'undefined') return [];
  
  // We can scan orders to build a unique customer list
  const list: any[] = [];
  const rawPoints = localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '{}';
  
  try {
    const pointsDb = JSON.parse(rawPoints);
    
    // Fallback: search profile cache or mock
    const cachedProfileRaw = localStorage.getItem('leton_customer_profile');
    if (cachedProfileRaw) {
      try {
        const p = JSON.parse(cachedProfileRaw);
        const pid = p.userId || p.id;
        const loyalty = pointsDb[pid] || { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
        list.push({
          id: pid,
          namaLengkap: p.namaLengkap,
          nomorHp: p.nomorHp,
          pointsBalance: loyalty.pointsBalance,
          totalPointsEarned: loyalty.totalPointsEarned,
          totalPointsRedeemed: loyalty.totalPointsRedeemed,
        });
      } catch {}
    }
    
    // Add additional mock profiles for testing/demo if empty so that Admin can test adjustments right away!
    const testProfiles = [
      { id: 'usr-fauzan', namaLengkap: 'Mhammad Fauzan', nomorHp: '081234567890' },
      { id: 'usr-pojan', namaLengkap: 'Pojan', nomorHp: '082198765432' },
      { id: 'usr-budi', namaLengkap: 'Budi Santoso', nomorHp: '085211223344' }
    ];

    testProfiles.forEach((tp) => {
      if (!list.some((l) => l.id === tp.id)) {
        const loyalty = pointsDb[tp.id] || { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
        list.push({
          id: tp.id,
          namaLengkap: tp.namaLengkap,
          nomorHp: tp.nomorHp,
          pointsBalance: loyalty.pointsBalance,
          totalPointsEarned: loyalty.totalPointsEarned,
          totalPointsRedeemed: loyalty.totalPointsRedeemed,
        });
      }
    });

  } catch {}
  return list;
}
