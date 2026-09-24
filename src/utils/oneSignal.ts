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

let lastSyncedSubId: string | null = null;
let isAutoSyncRegistered = false;

// Setup persistent auto-sync listeners for OneSignal v16
export async function setupOneSignalAutoSync(
  username: string,
  outletId: string,
  role?: string
): Promise<void> {
  if (typeof window === 'undefined' || !isPushCapable()) return;

  const normalizedOutlet = normalizeOutletTag(outletId);
  const normalizedRole = role || 'outlet_admin';
  const effectiveUser = username || 'admin';

  console.log('[OneSignal Auto-Sync] Initializing background auto-sync for:', {
    username: effectiveUser,
    outlet: normalizedOutlet,
    role: normalizedRole
  });

  try {
    const oneSignal = await initOneSignal();
    if (!oneSignal) return;

    const performSync = async (reason = 'auto-check') => {
      try {
        const isOptedIn = Boolean(oneSignal?.User?.PushSubscription?.optedIn);
        const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        const currentSubId = oneSignal?.User?.PushSubscription?.id;

        console.log(`[OneSignal Auto-Sync] Checking status (${reason}):`, {
          currentSubId: currentSubId || 'none',
          optedIn: isOptedIn,
          permission: perm,
          lastSynced: lastSyncedSubId
        });

        if (perm === 'granted' && currentSubId && typeof currentSubId === 'string' && currentSubId.length > 5) {
          if (currentSubId !== lastSyncedSubId) {
            console.log(`[OneSignal Auto-Sync] Detected new/changed subscription ID (${reason}):`, currentSubId);
            
            // Attach OneSignal Tags
            const isCentral = (
              normalizedOutlet === 'all' ||
              effectiveUser === 'admin' ||
              effectiveUser === 'superadmin' ||
              effectiveUser === 'pusat' ||
              effectiveUser === 'admin_pusat'
            ) && normalizedOutlet !== 'sudirman' && normalizedOutlet !== 'kelakap_7' && normalizedOutlet !== 'letgo';

            const targetOutlet = isCentral ? 'central' : normalizedOutlet;
            const targetRole = isCentral ? 'central_admin' : normalizedRole;

            try {
              await oneSignal.User.addTags({
                role: targetRole,
                outlet_id: targetOutlet,
                username: effectiveUser
              });
              if (effectiveUser) {
                await oneSignal.login(effectiveUser);
              }
            } catch (tagErr) {
              console.warn('[OneSignal Auto-Sync] Tag attachment notice:', tagErr);
            }

            // Sync to Supabase Database
            const syncRes = await syncSubscriptionIdToBackend(currentSubId, effectiveUser, targetOutlet, targetRole);
            if (syncRes.success) {
              lastSyncedSubId = currentSubId;
              try {
                localStorage.setItem('leton_last_synced_onesignal_sub', currentSubId);
              } catch (e) {}
              console.log('[OneSignal Auto-Sync] Auto-sync to database successful for ID:', currentSubId);
            }
          }
        }
      } catch (syncErr) {
        console.warn('[OneSignal Auto-Sync] Sync check error:', syncErr);
      }
    };

    // 1. Run initial sync check
    performSync('initial-load');

    // 2. Poll for the first 10 seconds in case OneSignal ID resolves asynchronously
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      const currentSubId = oneSignal?.User?.PushSubscription?.id;
      if (currentSubId && currentSubId !== lastSyncedSubId) {
        performSync(`poll-${pollCount}`);
      }
      if (pollCount >= 10 || (currentSubId && currentSubId === lastSyncedSubId)) {
        clearInterval(pollInterval);
      }
    }, 1000);

    // 3. Register persistent event listeners once
    if (!isAutoSyncRegistered) {
      isAutoSyncRegistered = true;

      // Event: PushSubscription change in OneSignal v16
      try {
        if (oneSignal.User?.PushSubscription?.addEventListener) {
          oneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
            console.log('[OneSignal Auto-Sync] PushSubscription "change" event fired:', event);
            performSync('subscription-change-event');
          });
        }
      } catch (evtErr) {
        console.warn('[OneSignal Auto-Sync] Could not add change listener:', evtErr);
      }

      // Event: Permission change
      try {
        if (oneSignal.Notifications?.addEventListener) {
          oneSignal.Notifications.addEventListener('permissionChange', (permission: any) => {
            console.log('[OneSignal Auto-Sync] Notifications "permissionChange" event fired:', permission);
            performSync('permission-change-event');
          });
        }
      } catch (evtErr) {
        console.warn('[OneSignal Auto-Sync] Could not add permissionChange listener:', evtErr);
      }

      // Event: Document visibility / focus (User returns to PWA or unlocks phone)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            console.log('[OneSignal Auto-Sync] PWA became visible, verifying subscription ID...');
            performSync('visibility-change');
          }
        });
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          performSync('window-focus');
        });
      }
    }
  } catch (err) {
    console.error('[OneSignal Auto-Sync] Error setting up auto-sync:', err);
  }
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

// Helper to register / upsert a subscription ID directly to backend
export async function syncSubscriptionIdToBackend(
  subscriptionId: string,
  username: string,
  outletId: string,
  role?: string,
  oldSubscriptionId?: string | null
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const normalizedOutlet = normalizeOutletTag(outletId);
    const { getSupabaseAnonKey } = await import('./supabase');
    const supabaseAnonKey = getSupabaseAnonKey();

    const isCentral = (
      normalizedOutlet === 'all' ||
      username === 'admin' ||
      username === 'superadmin' ||
      username === 'pusat' ||
      username === 'admin_pusat'
    ) && normalizedOutlet !== 'sudirman' && normalizedOutlet !== 'kelakap_7' && normalizedOutlet !== 'letgo';

    const targetOutlet = isCentral ? 'central' : normalizedOutlet;
    const targetRole = isCentral ? 'central_admin' : (role || 'outlet_admin');

    const prevStoredSubId = oldSubscriptionId !== undefined 
      ? oldSubscriptionId 
      : (typeof localStorage !== 'undefined' ? localStorage.getItem('leton_last_synced_onesignal_sub') : null);
    
    const effectiveOldSubId = prevStoredSubId && prevStoredSubId !== subscriptionId ? prevStoredSubId : undefined;

    const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'web';
    const registerPayload = {
      subscription_id: subscriptionId,
      old_subscription_id: effectiveOldSubId || null,
      username: username || 'admin',
      outlet_id: targetOutlet,
      role: targetRole,
      device_info: deviceInfo,
      is_active: true
    };

    const edgeFunctionEndpoint = 'https://galwyavdonfzuibrmswt.supabase.co/functions/v1/register-onesignal-subscription';
    
    console.log('[OneSignal] Current subscription ID:', subscriptionId);
    console.log('[OneSignal] Previous synced subscription ID:', effectiveOldSubId || 'none');
    console.log('[OneSignal] Registration started');

    const edgeRes = await fetch(edgeFunctionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify(registerPayload)
    });

    const rawText = await edgeRes.text();
    let edgeJson: any = null;
    try {
      edgeJson = JSON.parse(rawText);
    } catch (e) {}

    if (edgeRes.ok && edgeJson && edgeJson.success === true && edgeJson.verified === true) {
      console.log('[OneSignal] Registration success');
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('leton_last_synced_onesignal_sub', subscriptionId);
        }
        lastSyncedSubId = subscriptionId;
      } catch (e) {}
      return { success: true, data: edgeJson.data };
    }

    const errDetail = edgeJson?.error || `HTTP ${edgeRes.status}: ${rawText || edgeRes.statusText}`;
    console.error('[OneSignal] Registration failed:', errDetail);
    return { success: false, error: errDetail };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[OneSignal] Registration failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
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

    await oneSignal.User.addTags(tags);

    // 6. Wait for valid PushSubscription ID (OneSignal v16 creates it asynchronously)
    let subscriptionId = await waitForOneSignalSubscriptionId(oneSignal);

    if (!subscriptionId) {
      console.error('[OneSignal] Registration failed: Push subscription ID was empty or null after optIn.');
      return {
        success: false,
        error: 'Gagal mendapatkan OneSignal Subscription ID. Pastikan perangkat Anda terhubung ke internet dan izin notifikasi aktif, lalu coba lagi.',
        permission: Notification.permission
      };
    }

    const previousSubscriptionId = typeof localStorage !== 'undefined' 
      ? localStorage.getItem('leton_last_synced_onesignal_sub') 
      : null;

    // 7. Await complete backend registration before returning success
    const syncRes = await syncSubscriptionIdToBackend(
      subscriptionId,
      username || 'admin',
      targetOutlet,
      targetRole,
      previousSubscriptionId
    );

    if (syncRes.success) {
      return {
        success: true,
        subscriptionId,
        permission: Notification.permission
      };
    } else {
      return {
        success: false,
        error: syncRes.error || 'Gagal mendaftarkan perangkat ke server notifikasi.',
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

// Get comprehensive push & PWA diagnostics
export async function getPushDiagnostics(): Promise<{
  notificationPermission: string;
  swRegistered: boolean;
  swScope?: string;
  swActiveState?: string;
  swScriptUrl?: string;
  osSubscriptionId?: string | null;
  osPermissionState?: string;
  isPwaStandalone: boolean;
  userAgent: string;
}> {
  let swRegistered = false;
  let swScope = 'None';
  let swActiveState = 'None';
  let swScriptUrl = 'None';

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swRegistered = true;
        swScope = reg.scope || 'Registered';
        if (reg.active) {
          swActiveState = reg.active.state;
          swScriptUrl = reg.active.scriptURL;
        } else if (reg.installing) {
          swActiveState = 'installing';
        } else if (reg.waiting) {
          swActiveState = 'waiting';
        }
      }
    } catch (e) {}
  }

  let osSubscriptionId: string | null = null;
  let osPermissionState = 'unknown';

  try {
    const oneSignal = await initOneSignal().catch(() => null);
    if (oneSignal?.User?.PushSubscription) {
      osSubscriptionId = oneSignal.User.PushSubscription.id || null;
      osPermissionState = oneSignal.User.PushSubscription.optedIn ? 'opted-in' : 'opted-out';
    }
  } catch (e) {}

  const isPwaStandalone =
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && (navigator as any).standalone === true);

  return {
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    swRegistered,
    swScope,
    swActiveState,
    swScriptUrl,
    osSubscriptionId,
    osPermissionState,
    isPwaStandalone: Boolean(isPwaStandalone),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  };
}

// Trigger a test notification via OneSignal Edge Function directly
export async function testOneSignalPush(outletId: string, username?: string): Promise<{ success: boolean; recipients?: number; id?: string; message?: string; error?: string; target?: any }> {
  try {
    const normalizedOutlet = normalizeOutletTag(outletId);
    const { getSupabaseAnonKey } = await import('./supabase');
    const supabaseAnonKey = getSupabaseAnonKey();

    const edgeFunctionEndpoint = 'https://galwyavdonfzuibrmswt.supabase.co/functions/v1/send-order-push';

    console.log('[ONESIGNAL TEST PUSH] Calling Edge Function:', edgeFunctionEndpoint, 'for outlet:', normalizedOutlet);

    const res = await fetch(edgeFunctionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        type: 'TEST',
        outlet_id: normalizedOutlet,
        username: username || 'Admin'
      })
    });

    const rawText = await res.text();
    console.log('[ONESIGNAL TEST PUSH] Response status:', res.status, 'body:', rawText);

    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = { error: rawText };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Gagal memicu tes notifikasi OneSignal.'
    };
  }
}
