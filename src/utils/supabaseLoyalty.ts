import { getSupabase } from './supabase';
import { CustomerOrder } from '../types';

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
 * Helper to fetch central loyalty registry directly from cloud Supabase (leton_content)
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
 * Helper to save central loyalty registry directly to cloud Supabase (leton_content)
 */
async function saveCloudLoyaltyRegistry(registry: LoyaltyRegistry): Promise<boolean> {
  try {
    const client = getSupabase();
    const { error } = await client.from('leton_content').upsert({
      id: 'loyalty_registry',
      content: {
        balances: registry.balances || {},
        transactions: (registry.transactions || []).slice(0, 1000), // Keep recent 1000 transactions
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
 */
export async function getCustomerLoyalty(customerId: string): Promise<CustomerLoyaltyData> {
  if (!customerId) {
    return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
  }

  try {
    const registry = await fetchCloudLoyaltyRegistry();
    if (registry.balances && registry.balances[customerId]) {
      const data = registry.balances[customerId];
      return {
        pointsBalance: Number(data.pointsBalance || 0),
        totalPointsEarned: Number(data.totalPointsEarned || 0),
        totalPointsRedeemed: Number(data.totalPointsRedeemed || 0),
      };
    }

    // If not in balances map yet, calculate dynamically from transaction history
    if (registry.transactions && registry.transactions.length > 0) {
      const userTxs = registry.transactions.filter((t) => t.customerId === customerId);
      if (userTxs.length > 0) {
        let earned = 0;
        let redeemed = 0;
        for (const t of userTxs) {
          const pts = Number(t.points || 0);
          if (pts > 0) earned += pts;
          else redeemed += Math.abs(pts);
        }
        const balance = Math.max(0, earned - redeemed);
        return {
          pointsBalance: balance,
          totalPointsEarned: earned,
          totalPointsRedeemed: redeemed,
        };
      }
    }
  } catch (err) {
    console.warn('[Get Customer Loyalty Note]:', err);
  }

  return { pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0 };
}

/**
 * 7. Fetch Loyalty Transactions list from Cloud Supabase Database
 */
export async function getLoyaltyTransactions(customerId?: string): Promise<PointTransaction[]> {
  try {
    const registry = await fetchCloudLoyaltyRegistry();
    let txs = registry.transactions || [];
    if (customerId) {
      txs = txs.filter((t) => t.customerId === customerId);
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
    const registry = await fetchCloudLoyaltyRegistry();
    const current = registry.balances[customerId] || {
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
    };

    if (current.pointsBalance < reward.pointsRequired) {
      return { success: false, error: 'Saldo poin tidak mencukupi untuk menukar reward ini.' };
    }

    const before = current.pointsBalance;
    const after = before - reward.pointsRequired;

    // Update balance
    registry.balances[customerId] = {
      pointsBalance: after,
      totalPointsEarned: current.totalPointsEarned,
      totalPointsRedeemed: current.totalPointsRedeemed + reward.pointsRequired,
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

    // Save to Cloud Supabase
    await saveCloudLoyaltyRegistry(registry);

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
    const registry = await fetchCloudLoyaltyRegistry();
    const current = registry.balances[customerId] || {
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
    };

    const adjustVal = type === 'MANUAL_ADD' ? Math.abs(points) : -Math.abs(points);
    const before = current.pointsBalance;
    const after = before + adjustVal;

    if (after < 0) {
      return { success: false, error: 'Pengurangan melebihi jumlah saldo poin customer saat ini.' };
    }

    registry.balances[customerId] = {
      pointsBalance: after,
      totalPointsEarned: current.totalPointsEarned + (adjustVal > 0 ? adjustVal : 0),
      totalPointsRedeemed: current.totalPointsRedeemed + (adjustVal < 0 ? Math.abs(adjustVal) : 0),
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
    const current = registry.balances[custId] || {
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
    };

    const before = current.pointsBalance;
    const after = before + pointsToEarn;

    registry.balances[custId] = {
      pointsBalance: after,
      totalPointsEarned: current.totalPointsEarned + pointsToEarn,
      totalPointsRedeemed: current.totalPointsRedeemed,
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

    // 7. Persist to Cloud Supabase
    const saved = await saveCloudLoyaltyRegistry(registry);
    if (!saved) {
      console.warn('[Loyalty Save Warning]: Failed to save loyalty points to cloud database.');
    }

    console.log(`[Loyalty Success]: Awarded ${pointsToEarn} points to customer ${custId} for order ${order.id}. New balance: ${after}`);
    return { success: true, pointsEarned: pointsToEarn };
  } catch (err: any) {
    console.error('[Loyalty Earning Exception]:', err);
    return { success: false, error: 'Database exception: ' + err.message };
  }
}

/**
 * 12. Retrieve all customers with their loyalty stats (for admin dashboard)
 */
export async function getCustomersWithLoyalty(): Promise<any[]> {
  try {
    const client = getSupabase();
    const registry = await fetchCloudLoyaltyRegistry();

    const { data: custRows } = await client
      .from('customers')
      .select('id, nama_lengkap, nomor_hp')
      .order('nama_lengkap', { ascending: true });

    if (custRows && custRows.length > 0) {
      return custRows.map((c: any) => {
        const stats = registry.balances[c.id] || {
          pointsBalance: 0,
          totalPointsEarned: 0,
          totalPointsRedeemed: 0,
        };
        return {
          id: c.id,
          namaLengkap: c.nama_lengkap,
          nomorHp: c.nomor_hp,
          pointsBalance: Number(stats.pointsBalance || 0),
          totalPointsEarned: Number(stats.totalPointsEarned || 0),
          totalPointsRedeemed: Number(stats.totalPointsRedeemed || 0),
        };
      });
    }
  } catch (err) {
    console.warn('[Get Customers With Loyalty Note]:', err);
  }

  return [];
}
