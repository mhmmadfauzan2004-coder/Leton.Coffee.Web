import { getSupabase } from './supabase';
import { getApiUrl } from './api';

export interface ReferralRewardSettings {
  referrer_reward: number;
  referred_reward: number;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_REFERRAL_SETTINGS: ReferralRewardSettings = {
  referrer_reward: 100,
  referred_reward: 50,
};

const REFERRAL_SETTINGS_CACHE_KEY = 'leton_referral_reward_settings_cache';

/**
 * Fetch Referral Reward Settings.
 * Prioritizes trusted backend API /api/referral-settings, with fallback to Supabase leton_content and in-memory/local cache.
 */
export async function getReferralRewardSettings(): Promise<{ settings: ReferralRewardSettings; isFallback: boolean }> {
  // 1. Try Backend API
  try {
    const res = await fetch(getApiUrl('/api/referral-settings'), {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.settings) {
        const s = json.settings;
        const parsed: ReferralRewardSettings = {
          referrer_reward: Number(s.referrer_reward ?? s.referrerReward ?? DEFAULT_REFERRAL_SETTINGS.referrer_reward),
          referred_reward: Number(s.referred_reward ?? s.referredReward ?? DEFAULT_REFERRAL_SETTINGS.referred_reward),
          updated_at: s.updated_at,
          updated_by: s.updated_by,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(parsed));
        }
        return { settings: parsed, isFallback: false };
      }
    }
  } catch (apiErr) {
    // Network fallback
  }

  // 2. Direct Supabase read fallback
  try {
    const client = getSupabase();
    const { data: contentRow, error: contentErr } = await client
      .from('leton_content')
      .select('*')
      .eq('id', 'referral_settings')
      .maybeSingle();

    if (!contentErr && contentRow && contentRow.content) {
      const c = contentRow.content;
      const parsed: ReferralRewardSettings = {
        referrer_reward: Number(c.referrer_reward ?? c.referrerReward ?? DEFAULT_REFERRAL_SETTINGS.referrer_reward),
        referred_reward: Number(c.referred_reward ?? c.referredReward ?? DEFAULT_REFERRAL_SETTINGS.referred_reward),
        updated_at: contentRow.updated_at || c.updated_at,
        updated_by: c.updated_by,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(parsed));
      }

      return { settings: parsed, isFallback: false };
    }
  } catch (err) {
    console.warn('[ReferralSettings] Supabase read fallback warning:', err);
  }

  // 3. Local Cache Fallback
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(REFERRAL_SETTINGS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { settings: parsed, isFallback: true };
      } catch {}
    }
  }

  return { settings: DEFAULT_REFERRAL_SETTINGS, isFallback: true };
}

/**
 * Save Referral Reward Settings.
 * Super Admin only.
 */
export async function saveReferralRewardSettings(
  newSettings: { referrer_reward: number; referred_reward: number },
  adminRole?: string,
  adminUsername?: string
): Promise<{ success: boolean; error?: string; settings?: ReferralRewardSettings }> {
  const refReward = Number(newSettings.referrer_reward);
  const memReward = Number(newSettings.referred_reward);

  if (isNaN(refReward) || !Number.isInteger(refReward) || refReward < 0) {
    return { success: false, error: 'Reward Pengundang harus berupa bilangan bulat positif (minimal 0 poin).' };
  }
  if (isNaN(memReward) || !Number.isInteger(memReward) || memReward < 0) {
    return { success: false, error: 'Reward Member Baru harus berupa bilangan bulat positif (minimal 0 poin).' };
  }
  if (refReward > 100000 || memReward > 100000) {
    return { success: false, error: 'Nilai reward maksimal 100.000 poin untuk menjaga stabilitas sistem loyalty.' };
  }

  const adminToken = typeof window !== 'undefined'
    ? localStorage.getItem('leton_admin_token') || 'leton_local_token'
    : 'leton_local_token';

  const payload: ReferralRewardSettings = {
    referrer_reward: Math.round(refReward),
    referred_reward: Math.round(memReward),
    updated_at: new Date().toISOString(),
    updated_by: adminUsername || 'Super Admin',
  };

  // 1. Try Backend API
  try {
    const res = await fetch(getApiUrl('/api/admin/referral-settings'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-admin-role': adminRole || 'super_admin',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(payload));
      }
      return { success: true, settings: payload };
    }

    if (res.status === 403 || res.status === 401) {
      return { success: false, error: json.error || 'Akses Ditolak: Hanya Super Admin yang dapat mengubah pengaturan reward referral.' };
    }
  } catch (apiErr) {
    console.warn('[ReferralSettings] API save warning, trying direct Supabase fallback:', apiErr);
  }

  // 2. Direct Supabase Fallback (if super_admin)
  try {
    const client = getSupabase('super_admin');
    const { error: sbErr } = await client.from('leton_content').upsert({
      id: 'referral_settings',
      content: payload,
      updated_at: new Date().toISOString(),
    });

    if (sbErr) {
      return { success: false, error: sbErr.message || 'Gagal menyimpan ke database Supabase.' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(payload));
    }

    return { success: true, settings: payload };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Terjadi kesalahan sistem saat menyimpan ke database.' };
  }
}
