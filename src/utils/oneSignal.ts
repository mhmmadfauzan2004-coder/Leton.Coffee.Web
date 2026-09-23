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
    console.log('[OneSignal] Notification permission status:', permission);

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

    const tags: Record<string, string> = {
      role: isCentral ? 'central_admin' : normalizedRole,
      outlet_id: isCentral ? 'central' : normalizedOutlet,
      username: username || 'admin'
    };

    console.log('[OneSignal] Attaching tags for push filtering:', tags);
    await oneSignal.User.addTags(tags);

    // 6. Get Subscription ID
    const subscriptionId = oneSignal.User.PushSubscription.id;
    console.log('[OneSignal] Registered subscription ID:', subscriptionId);

    // 7. Save subscription record to backend Supabase
    try {
      const deviceInfo = typeof navigator !== 'undefined' ? `${navigator.platform || ''} ${navigator.userAgent.slice(0, 80)}` : 'web';
      await fetch(getApiUrl('/api/onesignal/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscriptionId || 'active',
          username,
          outletId: isCentral ? 'central' : normalizedOutlet,
          role: tags.role,
          deviceInfo
        })
      });
      console.log('[OneSignal] Subscription saved to backend database.');
    } catch (syncErr) {
      console.warn('[OneSignal] Backend subscription save warning:', syncErr);
    }

    return {
      success: true,
      subscriptionId,
      permission: Notification.permission
    };
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
