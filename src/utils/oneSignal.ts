// OneSignal Web Push Integration for Leton Coffee PWA
// Provides background push notifications for Outlet Admins (Sudirman, Kelakap 7, Let'GO)

import { getApiUrl } from './api';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

let isInitialized = false;
let initPromise: Promise<any> | null = null;

// Normalizes outlet identifiers into standard operational tags
export function normalizeOutletTag(rawOutletId: string | null | undefined): string {
  if (!rawOutletId) return 'unknown';
  const s = String(rawOutletId).toLowerCase().trim();

  if (
    s === 'sudirman' ||
    s.includes('sudirman') ||
    s === 'chapter-5' ||
    s === 'chapter_5' ||
    s === 'chapter5' ||
    s.includes('chapter 5') ||
    s.includes('chapter-5') ||
    s.includes('ch-5')
  ) {
    return 'sudirman';
  }

  if (
    s === 'kelakap_7' ||
    s === 'kelakap' ||
    s === 'ratusima' ||
    s.includes('kelakap') ||
    s.includes('ratusima') ||
    s === 'chapter-6' ||
    s === 'chapter_6' ||
    s === 'chapter6' ||
    s.includes('chapter 6') ||
    s.includes('chapter-6') ||
    s.includes('ch-6')
  ) {
    return 'kelakap_7';
  }

  if (
    s === 'letgo' ||
    s === 'letgo-mpp' ||
    s === 'let_go' ||
    s === 'let-go' ||
    s.includes('letgo') ||
    s.includes('let-go') ||
    s.includes('mpp')
  ) {
    return 'letgo';
  }

  return s;
}

// Fetch OneSignal App ID from frontend env or backend proxy
export async function getOneSignalAppId(): Promise<string> {
  const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID;
  if (envAppId && envAppId.trim()) {
    return envAppId.trim();
  }

  try {
    const res = await fetch(getApiUrl('/api/onesignal/config'));
    if (res.ok) {
      const data = await res.json();
      if (data?.appId) return data.appId.trim();
    }
  } catch (err) {
    console.warn('[OneSignal] Could not fetch dynamic appId from backend:', err);
  }

  return '517cbdc4-cd11-4661-b4e6-aec93387acb1';
}

// Initialize OneSignal Web SDK v16
export async function initOneSignal(): Promise<any> {
  if (isInitialized && window.OneSignal) {
    return window.OneSignal;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise(async (resolve, reject) => {
    try {
      const appId = await getOneSignalAppId();
      if (!appId) {
        console.warn('[OneSignal] App ID is missing. Set VITE_ONESIGNAL_APP_ID or backend config.');
        resolve(null);
        return;
      }

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          await OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
            notifyButton: {
              enable: false, // We use custom Leton Coffee Admin UI buttons
            },
          });
          console.log('[OneSignal] SDK v16 successfully initialized with App ID:', appId);
          isInitialized = true;
          resolve(OneSignal);
        } catch (initErr) {
          console.error('[OneSignal] Initialization error:', initErr);
          reject(initErr);
        }
      });
    } catch (err) {
      console.error('[OneSignal] Failed to initialize OneSignal:', err);
      reject(err);
    }
  });

  return initPromise;
}

// Check if push notifications are currently supported by the device / browser
export function isPushCapable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export interface OneSignalSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  permission?: NotificationPermission;
}

// Helper to wait until OneSignal PushSubscription ID is populated
export async function waitForOneSignalSubscriptionId(oneSignal: any, maxWaitMs = 12000): Promise<string | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const subId = oneSignal?.User?.PushSubscription?.id;
    const isOptedIn = Boolean(oneSignal?.User?.PushSubscription?.optedIn);
    if (subId && typeof subId === 'string' && subId.trim().length > 0) {
      return subId.trim();
    }

    // Attempt to opt-in again if not opted in
    if (!isOptedIn && oneSignal?.User?.PushSubscription?.optIn) {
      try {
        await oneSignal.User.PushSubscription.optIn();
      } catch (e) {}
    }

    await new Promise((r) => setTimeout(r, 600));
  }
  return oneSignal?.User?.PushSubscription?.id || null;
}

// Subscribe Admin to OneSignal Web Push with outlet tagging
export async function subscribeOneSignalAdmin(
  username: string,
  outletId: string,
  role?: string
): Promise<OneSignalSubscriptionResult> {
  console.log('[OneSignal] Subscribing admin device:', { username, outletId, role });

  if (!isPushCapable()) {
    return {
      success: false,
      error: 'Browser atau perangkat ini tidak mendukung Web Push Notifications.'
    };
  }

  try {
    const oneSignal = await initOneSignal();
    if (!oneSignal) {
      return {
        success: false,
        error: 'OneSignal App ID belum dikonfigurasi. Hubungi developer.'
      };
    }

    // 1. Request Notification Permission
    const permission = await oneSignal.Notifications.requestPermission();
    console.log('[ONESIGNAL] permission =', permission || Notification.permission);

    if (permission !== 'granted' && Notification.permission !== 'granted') {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        permission: Notification.permission
      };
    }

    // 2. Opt-in to Push Subscription
    await oneSignal.User.PushSubscription.optIn();

    // 3. Normalize outlet tag & role
    const normalizedOutlet = normalizeOutletTag(outletId);
    const normalizedRole = role || 'outlet_admin';

    // 4. Identify user with unique username in OneSignal
    if (username) {
      await oneSignal.login(username);
    }

    // 5. Add Tags for targeted outlet routing
    // Central/Super Admin must NOT receive operational pushes
    const isCentral = (
      normalizedOutlet === 'all' ||
      username === 'admin' ||
      username === 'superadmin' ||
      username === 'pusat' ||
      username === 'admin_pusat'
    ) && normalizedOutlet !== 'sudirman' && normalizedOutlet !== 'kelakap_7' && normalizedOutlet !== 'letgo';

    const targetOutlet = isCentral ? 'central' : normalizedOutlet;
    const targetRole = isCentral ? 'central_admin' : normalizedRole;

    const tags: Record<string, string> = {
      role: targetRole,
      outlet_id: targetOutlet,
      username: username || 'admin'
    };

    console.log('[OneSignal] Attaching tags for push filtering:', tags);
    await oneSignal.User.addTags(tags);

    // 6. Wait for valid PushSubscription ID (OneSignal v16 creates it asynchronously)
    let subscriptionId = await waitForOneSignalSubscriptionId(oneSignal);
    console.log('[ONESIGNAL] subscription_id =', subscriptionId);

    if (!subscriptionId) {
      console.error('[ONESIGNAL] Push subscription ID was empty or null after optIn.');
      return {
        success: false,
        error: 'Gagal mendapatkan OneSignal Subscription ID. Pastikan perangkat Anda terhubung ke internet dan izin notifikasi aktif, lalu coba lagi.',
        permission: Notification.permission
      };
    }

    const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'web';

    // 7. Call Supabase Edge Function: register-onesignal-subscription directly
    const edgeFunctionEndpoint = 'https://galwyavdonfzuibrmswt.supabase.co/functions/v1/register-onesignal-subscription';
    console.log('[ONESIGNAL] outlet_id =', targetOutlet);
    console.log('[ONESIGNAL] edge_function =', edgeFunctionEndpoint);
    console.log('[ONESIGNAL] request_started');

    const { getSupabaseAnonKey } = await import('./supabase');
    const supabaseAnonKey = getSupabaseAnonKey();

    const registerPayload = {
      subscription_id: subscriptionId,
      username: username || 'admin',
      outlet_id: targetOutlet,
      role: targetRole,
      device_info: deviceInfo
    };

    try {
      const edgeRes = await fetch(edgeFunctionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify(registerPayload)
      });

      console.log('[ONESIGNAL] response_status =', edgeRes.status);
      const rawText = await edgeRes.text();
      console.log('[ONESIGNAL] response_body =', rawText);

      let edgeJson: any = null;
      try {
        edgeJson = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[ONESIGNAL] Failed to parse JSON response from Edge Function:', parseErr);
      }

      // 8. Sukses HANYA jika response.success === true DAN response.verified === true
      if (edgeRes.ok && edgeJson && edgeJson.success === true && edgeJson.verified === true) {
        console.log('[ONESIGNAL] registration_verified = true. Verified row:', edgeJson.data);
        return {
          success: true,
          subscriptionId,
          permission: Notification.permission
        };
      }

      // If Edge Function failed or returned unverified, extract real error
      const realError = edgeJson?.error || `Pendaftaran gagal (HTTP ${edgeRes.status}): ${rawText || edgeRes.statusText}`;
      console.error('[ONESIGNAL] registration_verified = false. Error:', realError);
      return {
        success: false,
        error: realError,
        permission: Notification.permission
      };
    } catch (edgeCallErr: any) {
      const errorMsg = edgeCallErr?.message || String(edgeCallErr);
      console.error('[ONESIGNAL] Edge Function network exception:', edgeCallErr);
      return {
        success: false,
        error: `Gagal menghubungi server pendaftaran notifikasi: ${errorMsg}`,
        permission: Notification.permission
      };
    }
  } catch (err: any) {
    console.error('[OneSignal] Error during admin subscription:', err);
    return {
      success: false,
      error: err?.message || String(err)
    };
  }
}

// Unsubscribe Admin from OneSignal Web Push
export async function unsubscribeOneSignalAdmin(): Promise<boolean> {
  console.log('[OneSignal] Unsubscribing admin device...');
  try {
    const oneSignal = await initOneSignal();
    if (oneSignal && oneSignal.User) {
      await oneSignal.User.PushSubscription.optOut();
      await oneSignal.User.removeTags(['outlet_id', 'role', 'username']);
      await oneSignal.logout();
    }

    try {
      await fetch(getApiUrl('/api/onesignal/unsubscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: oneSignal?.User?.PushSubscription?.id || ''
        })
      });
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('[OneSignal] Error during unsubscription:', err);
    return false;
  }
}

// Check if currently subscribed to OneSignal
export async function isOneSignalSubscribed(): Promise<boolean> {
  if (!isPushCapable()) return false;
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return false;
  }

  try {
    const oneSignal = await initOneSignal();
    if (!oneSignal || !oneSignal.User?.PushSubscription) {
      return Notification.permission === 'granted';
    }
    return Boolean(oneSignal.User.PushSubscription.optedIn);
  } catch (err) {
    return Notification.permission === 'granted';
  }
}

// Trigger a test notification via OneSignal
export async function testOneSignalPush(outletId: string, username?: string): Promise<{ success: boolean; recipients?: number; id?: string; message?: string; error?: string }> {
  try {
    const normalizedOutlet = normalizeOutletTag(outletId);
    const res = await fetch(getApiUrl('/api/onesignal/test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: normalizedOutlet,
        username: username || 'Admin'
      })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Gagal memicu tes notifikasi OneSignal.'
    };
  }
}
