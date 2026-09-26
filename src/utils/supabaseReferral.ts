import { getSupabase } from './supabase';
import { adjustCustomerPointsManual } from './supabaseLoyalty';

export const REFERRAL_REWARD_REFERRER = 100;
export const REFERRAL_REWARD_NEW_MEMBER = 50;

export interface ReferredFriend {
  id: string;
  namaLengkap: string;
  createdAt: string;
  isRewarded: boolean;
}

export interface CustomerReferralStats {
  referralCode: string;
  referredFriends: ReferredFriend[];
  totalReferred: number;
  successfulReferrals: number;
  totalPointsEarned: number;
}

/**
 * Generate a clean, human-friendly 6-character referral code (Format: LETXXXXXX)
 * Uses uppercase letters and numbers avoiding easily confusable characters (0, O, 1, I).
 */
export function generateReferralCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'LET';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate a referral code against Supabase database (strictly once during registration).
 * Prevents self-referral.
 */
export async function validateReferralCode(
  rawCode: string,
  candidatePhone?: string
): Promise<{ isValid: boolean; referrerId?: string; referrerName?: string; error?: string }> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { isValid: false, error: 'Kode referral kosong.' };
  }

  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('customers')
      .select('id, nama_lengkap, nomor_hp, referral_code')
      .ilike('referral_code', cleanCode)
      .maybeSingle();

    if (error) {
      console.warn('[validateReferralCode] Database lookup notice:', error.message);
      return { isValid: false, error: 'Gagal memverifikasi kode referral.' };
    }

    if (!data) {
      return { isValid: false, error: 'Kode referral tidak ditemukan atau tidak valid.' };
    }

    // Prevent self-referral if phone is provided
    if (candidatePhone) {
      const cleanCandidate = candidatePhone.replace(/[^0-9]/g, '');
      const cleanOwner = (data.nomor_hp || '').replace(/[^0-9]/g, '');
      if (cleanCandidate && cleanOwner && (cleanCandidate === cleanOwner || cleanCandidate.endsWith(cleanOwner) || cleanOwner.endsWith(cleanCandidate))) {
        return { isValid: false, error: 'Anda tidak dapat menggunakan kode referral Anda sendiri.' };
      }
    }

    return {
      isValid: true,
      referrerId: data.id,
      referrerName: data.nama_lengkap || 'Member Leton',
    };
  } catch (err: any) {
    console.warn('[validateReferralCode] Exception:', err);
    return { isValid: false, error: 'Terjadi kendala saat memeriksa kode referral.' };
  }
}

/**
 * Fetch customer referral stats and list of invited friends on demand.
 * Strictly called only when the Referral section is opened. Cached in React state (no polling/realtime).
 */
export async function fetchCustomerReferralStats(
  customerId: string,
  customerReferralCode?: string
): Promise<CustomerReferralStats> {
  const defaultResult: CustomerReferralStats = {
    referralCode: customerReferralCode || '',
    referredFriends: [],
    totalReferred: 0,
    successfulReferrals: 0,
    totalPointsEarned: 0,
  };

  if (!customerId) return defaultResult;

  try {
    const client = getSupabase();

    // 1. Fetch referral code if not provided
    let activeCode = customerReferralCode || '';
    if (!activeCode) {
      const { data: custData } = await client
        .from('customers')
        .select('referral_code')
        .eq('id', customerId)
        .maybeSingle();
      
      if (custData && custData.referral_code) {
        activeCode = custData.referral_code;
      }
    }

    // If still missing (legacy customer), generate one and save once
    if (!activeCode) {
      activeCode = generateReferralCode();
      try {
        const adminClient = getSupabase('super_admin');
        await adminClient
          .from('customers')
          .update({ referral_code: activeCode })
          .eq('id', customerId);
      } catch {}
    }

    // 2. Fetch referred friends with only needed columns (No SELECT *)
    const { data: friendsData, error: friendsErr } = await client
      .from('customers')
      .select('id, nama_lengkap, created_at, referral_rewarded')
      .eq('referred_by', customerId)
      .order('created_at', { ascending: false });

    if (!friendsErr && Array.isArray(friendsData)) {
      const friends: ReferredFriend[] = friendsData.map((f: any) => ({
        id: f.id,
        namaLengkap: f.nama_lengkap || 'Member Baru',
        createdAt: f.created_at || new Date().toISOString(),
        isRewarded: Boolean(f.referral_rewarded),
      }));

      const successfulCount = friends.filter((f) => f.isRewarded).length;

      return {
        referralCode: activeCode,
        referredFriends: friends,
        totalReferred: friends.length,
        successfulReferrals: successfulCount,
        totalPointsEarned: successfulCount * REFERRAL_REWARD_REFERRER,
      };
    }

    return {
      ...defaultResult,
      referralCode: activeCode,
    };
  } catch (err) {
    console.warn('[fetchCustomerReferralStats] Error:', err);
    return defaultResult;
  }
}

/**
 * Process referral reward when a newly referred customer completes their first valid order.
 * STRICTLY IDEMPOTENT: Uses atomic database update on `referral_rewarded` to guarantee reward is awarded only once!
 */
export async function processReferralRewardOnFirstValidOrder(
  newCustomerId: string,
  orderId: string
): Promise<{ awarded: boolean; referrerId?: string; error?: string }> {
  if (!newCustomerId) return { awarded: false };

  try {
    const adminClient = getSupabase('super_admin');

    // 1. Fetch customer's referrer info
    const { data: customer, error: custErr } = await adminClient
      .from('customers')
      .select('id, nama_lengkap, referred_by, referral_rewarded')
      .eq('id', newCustomerId)
      .maybeSingle();

    if (custErr || !customer) {
      return { awarded: false, error: custErr?.message || 'Customer not found' };
    }

    // If customer was not referred by anyone or already rewarded, do nothing
    if (!customer.referred_by || customer.referral_rewarded === true) {
      return { awarded: false };
    }

    const referrerId = customer.referred_by;

    // 2. Atomic update to mark referral_rewarded = true (prevent duplicate rewards)
    const { data: updateRes, error: updateErr } = await adminClient
      .from('customers')
      .update({ referral_rewarded: true })
      .eq('id', newCustomerId)
      .eq('referral_rewarded', false)
      .select('id');

    if (updateErr || !updateRes || updateRes.length === 0) {
      // Another worker or process already rewarded this referral
      return { awarded: false };
    }

    console.log(`[Referral System] Processing first valid order reward for new member ${newCustomerId} (Referrer: ${referrerId})`);

    // 3. Award points to Referrer (+100 Points)
    try {
      await adjustCustomerPointsManual(
        referrerId,
        REFERRAL_REWARD_REFERRER,
        'MANUAL_ADD',
        `Bonus Referral: Temanmu (${customer.nama_lengkap || 'Member'}) menyelesaikan transaksi pertama (#${orderId})`,
        'System Referral'
      );
    } catch (refErr) {
      console.warn('[Referral System] Failed to award points to referrer:', refErr);
    }

    // 4. Award points to New Member (+50 Points)
    try {
      await adjustCustomerPointsManual(
        newCustomerId,
        REFERRAL_REWARD_NEW_MEMBER,
        'MANUAL_ADD',
        `Bonus Referral: Selamat atas transaksi pertamamu (#${orderId})`,
        'System Referral'
      );
    } catch (newErr) {
      console.warn('[Referral System] Failed to award points to new member:', newErr);
    }

    console.log(`[Referral System] Successfully awarded +${REFERRAL_REWARD_REFERRER} pts to Referrer and +${REFERRAL_REWARD_NEW_MEMBER} pts to New Member!`);
    return { awarded: true, referrerId };
  } catch (err: any) {
    console.error('[processReferralRewardOnFirstValidOrder] Exception:', err);
    return { awarded: false, error: err?.message || 'Internal referral exception' };
  }
}
