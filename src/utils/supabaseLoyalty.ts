import { getSupabase } from './supabase';
import { CustomerOrder } from '../types';
import { getReferralRewardSettings } from './supabaseReferralSettings';

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
  voucherCode?: string;
  referenceOrderId?: string | null;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string | null;
}

export interface CustomerLoyaltyData {
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

interface LoyaltyRegistry {
  balances: Record<string, CustomerLoyaltyData>;
  transactions: PointTransaction[];
  redemptions: RewardRedemption[];
}

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

/**
 * Fetch central loyalty registry from Supabase (leton_content -> loyalty_registry)
 */
async function fetchCloudLoyaltyRegistry(): Promise<LoyaltyRegistry> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'loyalty_registry')
      .maybeSingle();

    if (!error && data && data.content) {
      return {
        balances: data.content.balances || {},
        transactions: Array.isArray(data.content.transactions) ? data.content.transactions : [],
        redemptions: Array.isArray(data.content.redemptions) ? data.content.redemptions : [],
      };
    }
  } catch (err) {
    console.warn('[Supabase Loyalty Registry Fetch Error]:', err);
  }

  return {
    balances: {},
    transactions: [],
    redemptions: [],
  };
}

/**
 * Fetch all orders from Supabase (leton_content -> orders_registry)
 */
async function fetchCloudOrders(): Promise<CustomerOrder[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'orders_registry')
      .maybeSingle();

    if (!error && data && data.content && Array.isArray(data.content.orders)) {
      return data.content.orders;
    }
  } catch (err) {
    console.warn('[Supabase Orders Registry Fetch Error]:', err);
  }
  return [];
}

/**
 * Helper to save central loyalty registry to Supabase (leton_content -> loyalty_registry)
 */
async function saveCloudLoyaltyRegistry(registry: LoyaltyRegistry): Promise<boolean> {
  try {
    const client = getSupabase();
    const { error } = await client.from('leton_content').upsert({
      id: 'loyalty_registry',
      content: {
        balances: registry.balances || {},
        transactions: (registry.transactions || []).slice(0, 1000),
        redemptions: (registry.redemptions || []).slice(0, 1000),
      },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Supabase Loyalty Registry Save Error]:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Loyalty Registry Exception]:', err);
    return false;
  }
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

    if (!error && data) {
      return {
        settings: {
          id: data.id,
          isActive: Boolean(data.is_active),
          earningAmountPerPoint: Number(data.earning_amount_per_point || 10000),
          calculationBasis: data.calculation_basis as 'SUBTOTAL' | 'TOTAL',
          expirationMode: data.expiration_mode as 'NEVER' | 'DAYS',
          expirationDays: Number(data.expiration_days || 365),
        },
        isFallback: false,
      };
    }
  } catch (err) {
    console.warn('[Loyalty Settings Fetch Note]:', err);
  }

  return { settings: DEFAULT_SETTINGS, isFallback: false };
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
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 3. Fetch loyalty rewards list
 */
export async function getLoyaltyRewards(): Promise<{ rewards: LoyaltyReward[]; isFallback: boolean }> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('loyalty_rewards')
      .select('*')
      .order('points_required', { ascending: true });

    if (!error && data && data.length > 0) {
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
  } catch (err) {
    console.warn('[Loyalty Rewards Fetch Note]:', err);
  }

  return { rewards: DEFAULT_REWARDS, isFallback: false };
}

/**
 * 4. Save loyalty reward
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
      redeem_limit: reward.redeemLimit ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('loyalty_rewards')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 6. Get Customer loyalty balance directly from Cloud Supabase Database
 * Matches by customerId (UUID) or customerPhone
 */
export async function getCustomerLoyalty(customerId: string, customerPhone?: string): Promise<CustomerLoyaltyData> {
  if (!customerId && !customerPhone) {
    return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
  }

  try {
    const client = getSupabase('super_admin');

    // 1. Primary Source: Direct query from public.customers
    let query = client.from('customers').select('id, points_balance, total_points_earned, total_points_redeemed');
    if (customerId && customerPhone) {
      query = query.or(`id.eq.${customerId},nomor_hp.eq.${customerPhone}`);
    } else if (customerId) {
      query = query.eq('id', customerId);
    } else if (customerPhone) {
      query = query.eq('nomor_hp', customerPhone);
    }

    const { data: custRows, error: custErr } = await query.limit(1);

    if (!custErr && custRows && custRows.length > 0) {
      const row = custRows[0];
      return {
        pointsBalance: Number(row.points_balance || 0),
        totalPointsEarned: Number(row.total_points_earned || 0),
        totalPointsRedeemed: Number(row.total_points_redeemed || 0),
      };
    }

    // 2. Secondary Source: Check registry.balances in loyalty_registry
    const registry = await fetchCloudLoyaltyRegistry();
    if (customerId && registry.balances && registry.balances[customerId] !== undefined) {
      const data = registry.balances[customerId];
      return {
        pointsBalance: Number(data.pointsBalance || 0),
        totalPointsEarned: Number(data.totalPointsEarned || 0),
        totalPointsRedeemed: Number(data.totalPointsRedeemed || 0),
      };
    }
  } catch (err) {
    console.warn('[Get Customer Loyalty Note]:', err);
  }

  return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
}

/**
 * 7. Fetch Loyalty Transactions list from Cloud Supabase Database
 */
export async function getLoyaltyTransactions(customerId?: string, customerPhone?: string): Promise<PointTransaction[]> {
  try {
    const registry = await fetchCloudLoyaltyRegistry();
    let txs = [...(registry.transactions || [])];

    if (customerId || customerPhone) {
      txs = txs.filter(
        (t) =>
          (customerId && t.customerId === customerId) ||
          (customerPhone && t.customerPhone === customerPhone)
      );
    }

    return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('[Get Loyalty Transactions Note]:', err);
    return [];
  }
}

/**
 * 8. Fetch Redemptions (Vouchers) list from Cloud Supabase Database
 */
export async function getRewardRedemptions(customerId?: string): Promise<RewardRedemption[]> {
  try {
    const registry = await fetchCloudLoyaltyRegistry();
    let redemptions = registry.redemptions || [];
    if (customerId) {
      redemptions = redemptions.filter((v) => v.customerId === customerId);
    }
    return redemptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('[Get Reward Redemptions Note]:', err);
    return [];
  }
}

/**
 * 9. Core Transaction: Deduct points atomically and create reward voucher (Redeem)
 */
export async function redeemReward(
  customerId: string,
  reward: LoyaltyReward
): Promise<{ success: boolean; redemptionId?: string; error?: string }> {
  if (!customerId) {
    return { success: false, error: 'Customer ID tidak valid.' };
  }

  try {
    const currentLoyalty = await getCustomerLoyalty(customerId);

    if (currentLoyalty.pointsBalance < reward.pointsRequired) {
      return { success: false, error: 'Saldo poin tidak mencukupi untuk menukar reward ini.' };
    }

    const registry = await fetchCloudLoyaltyRegistry();
    const before = currentLoyalty.pointsBalance;
    const after = before - reward.pointsRequired;

    // Update balance in registry
    registry.balances[customerId] = {
      pointsBalance: after,
      totalPointsEarned: currentLoyalty.totalPointsEarned,
      totalPointsRedeemed: currentLoyalty.totalPointsRedeemed + reward.pointsRequired,
    };

    // Create redemption voucher
    const redemptionId = 'VCH-' + Math.floor(Math.random() * 900000 + 100000);
    const voucherCode = 'LTY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const voucher: RewardRedemption = {
      id: redemptionId,
      customerId,
      rewardId: reward.id,
      rewardName: reward.name,
      rewardType: reward.rewardType,
      rewardValue: reward.rewardValue,
      pointsSpent: reward.pointsRequired,
      voucherCode,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    registry.redemptions = [voucher, ...(registry.redemptions || [])];

    // Record point transaction
    const txId = 'TX-' + Math.floor(Math.random() * 900000 + 100000);
    const tx: PointTransaction = {
      id: txId,
      customerId,
      transactionType: 'REDEEM',
      points: -reward.pointsRequired,
      balanceBefore: before,
      balanceAfter: after,
      referenceRewardId: reward.id,
      reason: `Tukar voucher reward: ${reward.name}`,
      createdAt: new Date().toISOString(),
    };
    registry.transactions = [tx, ...(registry.transactions || [])];

    // Save to Cloud Supabase Registry and public.customers
    await saveCloudLoyaltyRegistry(registry);

    try {
      const adminClient = getSupabase('super_admin');
      await adminClient.from('customers').update({
        points_balance: after,
        total_points_earned: currentLoyalty.totalPointsEarned,
        total_points_redeemed: currentLoyalty.totalPointsRedeemed + reward.pointsRequired,
      }).eq('id', customerId);
    } catch (dbErr) {
      console.warn('[Loyalty Redeem DB update notice]:', dbErr);
    }

    return { success: true, redemptionId };
  } catch (err: any) {
    return { success: false, error: 'Gagal menukar reward: ' + err.message };
  }
}

/**
 * 10. Core Transaction: Manual point adjustment by Admin
 */
export async function adjustCustomerPointsManual(
  customerId: string,
  points: number,
  type: 'MANUAL_ADD' | 'MANUAL_SUB',
  reason: string,
  adminUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!customerId) {
    return { success: false, error: 'Customer ID tidak valid.' };
  }

  try {
    const currentLoyalty = await getCustomerLoyalty(customerId);
    const adjustVal = type === 'MANUAL_ADD' ? Math.abs(points) : -Math.abs(points);
    const before = currentLoyalty.pointsBalance;
    const after = before + adjustVal;

    if (after < 0) {
      return { success: false, error: 'Pengurangan melebihi jumlah saldo poin customer saat ini.' };
    }

    const registry = await fetchCloudLoyaltyRegistry();
    registry.balances[customerId] = {
      pointsBalance: after,
      totalPointsEarned: currentLoyalty.totalPointsEarned + (adjustVal > 0 ? adjustVal : 0),
      totalPointsRedeemed: currentLoyalty.totalPointsRedeemed + (adjustVal < 0 ? Math.abs(adjustVal) : 0),
    };

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
    registry.transactions = [tx, ...(registry.transactions || [])];

    await saveCloudLoyaltyRegistry(registry);

    try {
      const adminClient = getSupabase('super_admin');
      await adminClient.from('customers').update({
        points_balance: after,
        total_points_earned: currentLoyalty.totalPointsEarned + (adjustVal > 0 ? adjustVal : 0),
        total_points_redeemed: currentLoyalty.totalPointsRedeemed + (adjustVal < 0 ? Math.abs(adjustVal) : 0),
      }).eq('id', customerId);
    } catch (dbErr) {
      console.warn('[Loyalty Adjust DB update notice]:', dbErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Gagal menyesuaikan poin: ' + err.message };
  }
}

/**
 * 11. Core Operation: Automatically award points when order is placed at checkout
 * IDEMPOTENT: Strictly ensures one order_id only awards points once!
 */
export async function processOrderPointsEarning(
  order: CustomerOrder
): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  const custId = order.customerId || order.userId;
  if (!custId) {
    return { success: false, error: 'Order tidak terhubung ke customer.' };
  }

  try {
    // 1. Fetch Cloud Registry from Supabase
    const registry = await fetchCloudLoyaltyRegistry();

    // 2. Strict Idempotency Check: Prevent duplicate earning for the same order_id
    const alreadyEarned = (registry.transactions || []).some(
      (t) => t.referenceOrderId === order.id && t.transactionType === 'EARN'
    );
    if (alreadyEarned) {
      console.log(`[Loyalty] Poin untuk order ${order.id} sudah pernah diberikan. Skipping duplicate.`);
      return { success: true, pointsEarned: 0, error: 'Poin untuk pesanan ini sudah pernah diproses.' };
    }

    // 3. Load calculation settings
    const { settings } = await getLoyaltySettings();
    if (!settings.isActive) {
      return { success: false, error: 'Sistem loyalty sedang dinonaktifkan.' };
    }

    // 4. Calculate Points: Default Rp 10.000 = 1 point
    const amountToCalculate = Number(order.totalAmount || 0);
    const earningRate = Number(settings.earningAmountPerPoint) || 10000;
    const pointsToEarn = Math.floor(amountToCalculate / earningRate);

    if (pointsToEarn <= 0) {
      return { success: true, pointsEarned: 0 };
    }

    // 5. Update customer balance in Cloud Registry
    const currentLoyalty = await getCustomerLoyalty(custId, order.customerPhone);
    const before = currentLoyalty.pointsBalance;
    const after = before + pointsToEarn;
    const newEarned = currentLoyalty.totalPointsEarned + pointsToEarn;

    registry.balances[custId] = {
      pointsBalance: after,
      totalPointsEarned: newEarned,
      totalPointsRedeemed: currentLoyalty.totalPointsRedeemed,
    };

    // 6. Record transaction with referenceOrderId for audit trail & deduplication
    const txId = 'TX-' + Math.floor(Math.random() * 900000 + 100000);
    const tx: PointTransaction = {
      id: txId,
      customerId: custId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      transactionType: 'EARN',
      points: pointsToEarn,
      balanceBefore: before,
      balanceAfter: after,
      referenceOrderId: order.id,
      reason: `Automatic Earning: Pesanan #${order.orderNumber || order.id}`,
      createdAt: new Date().toISOString(),
    };

    registry.transactions = [tx, ...(registry.transactions || [])];

    // 7. Persist to Cloud Supabase Registry & public.customers
    await saveCloudLoyaltyRegistry(registry);

    try {
      const adminClient = getSupabase('super_admin');
      await adminClient.from('customers').update({
        points_balance: after,
        total_points_earned: newEarned,
      }).eq('id', custId);
    } catch (dbErr) {
      console.warn('[Loyalty Order DB update notice]:', dbErr);
    }

    console.log(`[Loyalty Success]: Awarded ${pointsToEarn} points to customer ${custId} for order ${order.id}. New balance: ${after}`);

    // Check & process referral reward on first order completion asynchronously
    processReferralRewardIfEligible(custId).catch((refErr) => {
      console.warn('[processReferralRewardIfEligible notice]:', refErr);
    });

    return { success: true, pointsEarned: pointsToEarn };
  } catch (err: any) {
    console.error('[Loyalty Earning Exception]:', err);
    return { success: false, error: 'Database exception: ' + err.message };
  }
}

/**
 * 12. Process Member Get Member (Referral) Reward upon First Order
 * Rules:
 * - Only runs once when new member has referred_by set and referral_rewarded is false.
 * - Referrer receives +100 points
 * - New Member receives +50 points
 * - Updates referral_rewarded = true in public.customers
 */
export async function processReferralRewardIfEligible(customerId: string): Promise<boolean> {
  if (!customerId) return false;

  try {
    const adminClient = getSupabase('super_admin');

    // 1. Fetch new member referral link status
    const { data: memberData, error: memberErr } = await adminClient
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, points_balance, total_points_earned, referred_by, referral_rewarded')
      .eq('id', customerId)
      .maybeSingle();

    if (memberErr || !memberData || !memberData.referred_by || memberData.referral_rewarded) {
      // Not eligible or already rewarded
      return false;
    }

    const referrerId = memberData.referred_by;

    // Prevent self-referral
    if (referrerId === customerId) {
      await adminClient.from('customers').update({ referral_rewarded: true }).eq('id', customerId);
      return false;
    }

    // 2. Fetch referrer information
    const { data: referrerData, error: refErr } = await adminClient
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, points_balance, total_points_earned')
      .eq('id', referrerId)
      .maybeSingle();

    if (refErr || !referrerData) {
      console.warn('[processReferralReward] Referrer not found:', referrerId);
      await adminClient.from('customers').update({ referral_rewarded: true }).eq('id', customerId);
      return false;
    }

    // 3. Update Registry & Customer Points
    const registry = await fetchCloudLoyaltyRegistry();
    const nowIso = new Date().toISOString();

    // Reward amounts from dynamic settings
    const { settings: referralSettings } = await getReferralRewardSettings();
    const REFERRER_REWARD_POINTS = Number(referralSettings.referrer_reward ?? 100);
    const MEMBER_REWARD_POINTS = Number(referralSettings.referred_reward ?? 50);

    // a. Update Referrer (+points)
    const refCurrentLoyalty = await getCustomerLoyalty(referrerId, referrerData.nomor_hp);
    const refBefore = refCurrentLoyalty.pointsBalance;
    const refAfter = refBefore + REFERRER_REWARD_POINTS;
    const refNewEarned = refCurrentLoyalty.totalPointsEarned + REFERRER_REWARD_POINTS;

    registry.balances[referrerId] = {
      pointsBalance: refAfter,
      totalPointsEarned: refNewEarned,
      totalPointsRedeemed: refCurrentLoyalty.totalPointsRedeemed,
    };

    const refTxId = 'TX-REF-' + Math.floor(Math.random() * 900000 + 100000);
    const refTx: PointTransaction = {
      id: refTxId,
      customerId: referrerId,
      customerName: referrerData.nama_lengkap,
      customerPhone: referrerData.nomor_hp,
      transactionType: 'EARN',
      points: REFERRER_REWARD_POINTS,
      balanceBefore: refBefore,
      balanceAfter: refAfter,
      reason: `Reward Referral: Undangan teman (${memberData.nama_lengkap || 'Member Baru'}) berhasil transaksi pertama`,
      createdAt: nowIso,
    };

    // b. Update New Member (+50 points)
    const memCurrentLoyalty = await getCustomerLoyalty(customerId, memberData.nomor_hp);
    const memBefore = memCurrentLoyalty.pointsBalance;
    const memAfter = memBefore + MEMBER_REWARD_POINTS;
    const memNewEarned = memCurrentLoyalty.totalPointsEarned + MEMBER_REWARD_POINTS;

    registry.balances[customerId] = {
      pointsBalance: memAfter,
      totalPointsEarned: memNewEarned,
      totalPointsRedeemed: memCurrentLoyalty.totalPointsRedeemed,
    };

    const memTxId = 'TX-REF-' + Math.floor(Math.random() * 900000 + 100000);
    const memTx: PointTransaction = {
      id: memTxId,
      customerId,
      customerName: memberData.nama_lengkap,
      customerPhone: memberData.nomor_hp,
      transactionType: 'EARN',
      points: MEMBER_REWARD_POINTS,
      balanceBefore: memBefore,
      balanceAfter: memAfter,
      reason: 'Bonus Referral: Transaksi pertama member baru via kode referral teman',
      createdAt: nowIso,
    };

    registry.transactions = [refTx, memTx, ...(registry.transactions || [])];

    // 4. Save Registry and Database Rows
    await saveCloudLoyaltyRegistry(registry);

    await Promise.all([
      adminClient.from('customers').update({
        points_balance: refAfter,
        total_points_earned: refNewEarned,
      }).eq('id', referrerId),
      adminClient.from('customers').update({
        points_balance: memAfter,
        total_points_earned: memNewEarned,
        referral_rewarded: true,
      }).eq('id', customerId),
    ]);

    console.log(`[Referral Success] Rewarded +${REFERRER_REWARD_POINTS} pts to referrer ${referrerId} and +${MEMBER_REWARD_POINTS} pts to member ${customerId}`);
    return true;
  } catch (err) {
    console.error('[processReferralReward] Exception:', err);
    return false;
  }
}

/**
 * 13. Retrieve all customers with their loyalty stats (for admin dashboard)
 */
export async function getCustomersWithLoyalty(): Promise<any[]> {
  try {
    const client = getSupabase('super_admin');
    const [custRowsRes, registry] = await Promise.all([
      client.from('customers').select('id, nama_lengkap, nomor_hp, points_balance, total_points_earned, total_points_redeemed').order('nama_lengkap', { ascending: true }),
      fetchCloudLoyaltyRegistry(),
    ]);

    const custRows = custRowsRes.data || [];
    return custRows.map((c: any) => {
      const regBal = registry.balances?.[c.id];
      const bal = regBal?.pointsBalance !== undefined ? Number(regBal.pointsBalance) : Number(c.points_balance || 0);
      const earned = regBal?.totalPointsEarned !== undefined ? Number(regBal.totalPointsEarned) : Number(c.total_points_earned || 0);
      const redeemed = regBal?.totalPointsRedeemed !== undefined ? Number(regBal.totalPointsRedeemed) : Number(c.total_points_redeemed || 0);

      return {
        id: c.id,
        namaLengkap: c.nama_lengkap,
        nomorHp: c.nomor_hp,
        pointsBalance: bal,
        totalPointsEarned: earned,
        totalPointsRedeemed: redeemed,
      };
    });
  } catch (err) {
    console.warn('[Get Customers With Loyalty Note]:', err);
    return [];
  }
}
