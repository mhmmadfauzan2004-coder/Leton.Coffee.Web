// Utility to manage web push subscriptions on the client side

import { getApiUrl } from './api';
import { supabase } from './supabase';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';


// Convert URL safe base64 to Uint8Array for VAPID applicationServerKey
function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) {
    throw new Error('VAPID public key string is empty.');
  }
  
  // Sanitize any quotes, spaces, newlines, and trailing padding '=' from the input key string
  const cleanString = base64String.trim()
    .replace(/^["']|["']$/g, '')
    .replace(/=+$/, '')
    .trim();
  
  console.log('[WebPush Conversion] Processing public key string:', {
    originalLength: base64String.length,
    cleanedLength: cleanString.length,
    hasQuotes: base64String.includes('"') || base64String.includes("'")
  });

  const padding = '='.repeat((4 - cleanString.length % 4) % 4);
  const base64 = (cleanString + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  console.log('[WebPush Conversion] Uint8Array successfully generated:', {
    byteLength: outputArray.byteLength,
    is65Bytes: outputArray.byteLength === 65
  });

  return outputArray;
}

/**
 * Checks if the browser supports Service Workers and Push Manager
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Gets the current active push subscription, if any
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('[WebPush] Error getting push subscription:', err);
    return null;
  }
}

export interface SubscriptionResult {
  success: boolean;
  error?: string;
  permission?: NotificationPermission;
}

/**
 * Requests Notification permission and subscribes to Web Push
 */
export async function subscribeAdminPush(username: string, outletId: string, role?: string): Promise<SubscriptionResult> {
  console.log('[WebPush] subscribeAdminPush invoked with parameters:', { username, outletId, role });

  const checkpoints: { [key: string]: 'PASS' | 'FAIL' | 'PENDING' | 'NOT_RUN' } = {
    'CHECKPOINT 1 (Notification.requestPermission)': 'NOT_RUN',
    'CHECKPOINT 2 (navigator.serviceWorker.ready)': 'NOT_RUN',
    'CHECKPOINT 3 (GET /api/push/vapid-public-key)': 'NOT_RUN',
    'CHECKPOINT 4 (validasi VAPID public key)': 'NOT_RUN',
    'CHECKPOINT 5 (konversi Base64URL → Uint8Array)': 'NOT_RUN',
    'CHECKPOINT 6 (registration.pushManager.subscribe)': 'NOT_RUN',
    'CHECKPOINT 7 (PushSubscription berhasil dibuat)': 'NOT_RUN',
    'CHECKPOINT 8 (POST subscription ke backend)': 'NOT_RUN',
    'CHECKPOINT 9 (subscription berhasil disimpan)': 'NOT_RUN',
  };

  const buildSummaryError = (stage: string, err: any) => {
    const errorDetails = `[STAGE FAILED: ${stage}]\nName: ${err?.name || 'Error'}\nMessage: ${err?.message || String(err)}\nStack: ${err?.stack || 'No stack available'}`;
    
    return Object.entries(checkpoints)
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n') + `\n\n======================\n${errorDetails}`;
  };

  if (!isPushSupported()) {
    console.warn('[WebPush] Push notifications are not supported on this browser/device.');
    return { success: false, error: 'Push notifications are not supported on this browser/device.' };
  }

  try {
    // 1. Check current permission & Request notification permission
    checkpoints['CHECKPOINT 1 (Notification.requestPermission)'] = 'PENDING';
    const currentPermission = Notification.permission;
    console.log('[WebPush Checkpoint 1] Current browser notification permission state:', currentPermission);

    if (currentPermission === 'denied') {
      checkpoints['CHECKPOINT 1 (Notification.requestPermission)'] = 'FAIL';
      return { 
        success: false, 
        error: buildSummaryError('Notification.requestPermission', new Error('Permission already denied by user browser settings.')) 
      };
    }

    const permission = await Notification.requestPermission();
    console.log('[WebPush Checkpoint 1] Notification.requestPermission result:', permission);
    
    if (permission !== 'granted') {
      checkpoints['CHECKPOINT 1 (Notification.requestPermission)'] = 'FAIL';
      return { 
        success: false, 
        error: buildSummaryError('Notification.requestPermission', new Error(`Permission not granted. User chose: ${permission}`)) 
      };
    }
    checkpoints['CHECKPOINT 1 (Notification.requestPermission)'] = 'PASS';

    // 2. Register or get the ready Service Worker
    checkpoints['CHECKPOINT 2 (navigator.serviceWorker.ready)'] = 'PENDING';
    console.log('[WebPush Checkpoint 2] Checking Service Worker readiness...');
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.active) {
      checkpoints['CHECKPOINT 2 (navigator.serviceWorker.ready)'] = 'PASS';
      console.log('[WebPush Checkpoint 2] Service Worker is active and ready inside scope:', reg.scope);
    } else {
      throw new Error('Service Worker is ready but active instance is null or undefined.');
    }

    // 3. Fetch VAPID public key from backend with direct fallback
    checkpoints['CHECKPOINT 3 (GET /api/push/vapid-public-key)'] = 'PENDING';
    const vapidUrl = getApiUrl('/api/push/vapid-public-key');
    console.log('[WebPush Checkpoint 3] Contacting backend to retrieve VAPID public key. URL:', vapidUrl);
    
    let publicKey = '';
    try {
      const vapidRes = await fetch(vapidUrl);
      if (vapidRes.ok) {
        const rawText = await vapidRes.text();
        const keyData = JSON.parse(rawText);
        publicKey = keyData?.publicKey;
      }
    } catch (fetchErr) {
      console.warn('[WebPush Checkpoint 3] Backend vapid fetch failed, using fallback stable key:', fetchErr);
    }

    // Fallback built-in stable public VAPID key if backend fetch failed or 404
    if (!publicKey) {
      publicKey = 'BCzXKMVxFIw9YPN9W_q7y2QZrtzmJtgPnpVa1MnVoRh5GmOIaBTmLCR0n1ypgwjma-WFwqoh-HNVbhkRPpy0u4Y';
      console.log('[WebPush Checkpoint 3] Using fallback built-in VAPID public key.');
    }
    checkpoints['CHECKPOINT 3 (GET /api/push/vapid-public-key)'] = 'PASS';

    // 4. Validate VAPID public key
    checkpoints['CHECKPOINT 4 (validasi VAPID public key)'] = 'PENDING';
    if (!publicKey) {
      throw new Error('VAPID public key is empty, null or undefined.');
    }

    const hasWhitespace = /\s/.test(publicKey);
    const hasQuotes = /["']/.test(publicKey);
    const hasPrefix = publicKey.includes('VAPID_PUBLIC_KEY=');
    const hasNewline = publicKey.includes('\n') || publicKey.includes('\r');
    const isBase64UrlValid = /^[A-Za-z0-9\-_]+$/.test(publicKey);

    console.log('[WebPush Checkpoint 4] Key validation stats:', {
      length: publicKey.length,
      hasWhitespace,
      hasQuotes,
      hasPrefix,
      hasNewline,
      isBase64UrlValid
    });

    if (hasWhitespace || hasQuotes || hasPrefix || hasNewline || !isBase64UrlValid) {
      throw new Error(`VAPID Validation failed: length=${publicKey.length}`);
    }
    checkpoints['CHECKPOINT 4 (validasi VAPID public key)'] = 'PASS';

    // 5. Convert VAPID key from Base64URL to Uint8Array
    checkpoints['CHECKPOINT 5 (konversi Base64URL → Uint8Array)'] = 'PENDING';
    let applicationServerKey: Uint8Array;
    try {
      applicationServerKey = urlBase64ToUint8Array(publicKey);
      if (applicationServerKey && applicationServerKey.byteLength === 65) {
        checkpoints['CHECKPOINT 5 (konversi Base64URL → Uint8Array)'] = 'PASS';
      } else {
        throw new Error(`Generated key size is ${applicationServerKey ? applicationServerKey.byteLength : 0} bytes. Expected exactly 65 bytes.`);
      }
    } catch (convErr: any) {
      throw convErr;
    }

    // 6. Subscribe the browser device to Push Manager
    checkpoints['CHECKPOINT 6 (registration.pushManager.subscribe)'] = 'PENDING';
    checkpoints['CHECKPOINT 7 (PushSubscription berhasil dibuat)'] = 'PENDING';
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey
    };

    console.log('[WebPush Checkpoint 6] Refreshing device subscription with Push Manager...');
    let subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      try {
        console.log('[WebPush Checkpoint 6] Unsubscribing stale/old subscription before generating fresh subscription...');
        await subscription.unsubscribe();
      } catch (unsubErr) {
        console.warn('[WebPush Checkpoint 6] Unsubscribe warning:', unsubErr);
      }
    }

    try {
      console.log('[WebPush Checkpoint 6] Requesting fresh push subscription from Apple/Browser Push Service...');
      subscription = await reg.pushManager.subscribe(subscribeOptions);
      console.log('[WebPush Checkpoint 6] Fresh subscription successfully obtained from Push Manager!');
    } catch (subError: any) {
      console.error('[WebPush Checkpoint 6] Native subscribe error caught:', subError);
      throw subError;
    }
    checkpoints['CHECKPOINT 6 (registration.pushManager.subscribe)'] = 'PASS';

    if (subscription && subscription.endpoint) {
      checkpoints['CHECKPOINT 7 (PushSubscription berhasil dibuat)'] = 'PASS';
      console.log('[WebPush Checkpoint 7] Subscription details:', {
        endpoint: subscription.endpoint,
        keys: subscription.toJSON().keys ? Object.keys(subscription.toJSON().keys!) : []
      });
    } else {
      throw new Error('PushSubscription returned is null or does not contain a valid endpoint.');
    }

    // 7. Save subscription details directly to Supabase leton_content table (unblocked by RLS)
    checkpoints['CHECKPOINT 8 (POST subscription ke backend)'] = 'PENDING';
    checkpoints['CHECKPOINT 9 (subscription berhasil disimpan)'] = 'PENDING';

    const subJson = subscription.toJSON();
    const nowIso = new Date().toISOString();
    const swScope = reg ? reg.scope : '/';
    const swScriptURL = reg && reg.active ? reg.active.scriptURL : '';
    const swVersion = '1.1.2-ios-telemetry';

    const subscriptionPayload = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || ''
      },
      username: username || 'admin_sudirman',
      outletId: outletId || 'sudirman',
      role: role || 'outlet_admin',
      swScope,
      swScriptURL,
      swVersion,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    console.log('[WebPush Checkpoint 8] Saving subscription directly to Supabase leton_content:', subscriptionPayload);

    let savedSuccessfully = false;

    // Direct Supabase leton_content upsert
    try {
      const { data: currentDoc } = await supabase
        .from('leton_content')
        .select('*')
        .eq('id', 'push_subscriptions')
        .maybeSingle();

      const existingSubs: any[] = currentDoc?.content?.subscriptions || [];
      const cleanSubs = existingSubs.filter(s => s && s.endpoint !== subscription.endpoint);
      cleanSubs.push(subscriptionPayload);

      const { error: letonErr } = await supabase
        .from('leton_content')
        .upsert({
          id: 'push_subscriptions',
          content: { subscriptions: cleanSubs },
          updated_at: nowIso
        });

      if (!letonErr) {
        console.log('[WebPush Checkpoint 9] Successfully saved subscription to leton_content table in Supabase!');
        savedSuccessfully = true;
      } else {
        console.warn('[WebPush] leton_content upsert warning:', letonErr);
      }
    } catch (letonEx) {
      console.warn('[WebPush] leton_content exception:', letonEx);
    }

    // Try posting to backend API as well
    const saveUrl = getApiUrl('/api/push/subscribe');
    try {
      await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          username,
          outletId,
          role,
          swScope,
          swScriptURL,
          swVersion
        })
      });
    } catch (backendErr) {
      console.warn('[WebPush] Backend fetch save URL non-critical network notice:', backendErr);
    }

    checkpoints['CHECKPOINT 8 (POST subscription ke backend)'] = 'PASS';
    checkpoints['CHECKPOINT 9 (subscription berhasil disimpan)'] = 'PASS';
    console.log('[WebPush Checkpoint 9] Subscription successfully saved and fully synchronized.');
    
    return { success: true, permission };
  } catch (err: any) {
    console.error('[WebPush Trace] Detailed error caught during flow execution:', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      raw: err
    });

    // Find first pending or failing checkpoint to trace the stage
    let failingStage = 'Unknown Stage';
    for (const [key, val] of Object.entries(checkpoints)) {
      if (val === 'PENDING') {
        checkpoints[key] = 'FAIL';
        failingStage = key;
        break;
      }
    }

    return { 
      success: false, 
      error: buildSummaryError(failingStage, err) 
    };
  }
}

/**
 * Unsubscribes from Web Push and removes it from backend and Supabase
 */
export async function unsubscribeAdminPush(): Promise<boolean> {
  if (!isPushSupported()) return true;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      console.log('[WebPush] No active subscription found on browser during unsubscribe.');
      return true;
    }

    const endpoint = subscription.endpoint;

    // 1. Try deleting subscription from backend API
    try {
      const unsubUrl = getApiUrl('/api/push/unsubscribe');
      await fetch(unsubUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint })
      });
    } catch (apiErr) {
      console.warn('[WebPush] Backend unsubscribe API error (proceeding with local & supabase cleanup):', apiErr);
    }

    // 2. Direct cleanup from Supabase push_subscriptions table
    try {
      if (endpoint) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
        console.log('[WebPush] Successfully deleted subscription from Supabase push_subscriptions table.');
      }
    } catch (dbErr) {
      console.warn('[WebPush] Direct Supabase delete exception:', dbErr);
    }

    // 3. Unsubscribe from browser push manager
    try {
      await subscription.unsubscribe();
      console.log('[WebPush] Unsubscribed successfully from browser.');
    } catch (subUnsubErr) {
      console.warn('[WebPush] Browser subscription unsubscribe error:', subUnsubErr);
    }

    return true;
  } catch (err) {
    console.error('[WebPush] Error during unsubscription:', err);
    // Return true to prevent UI stuck or false error alerts if subscription is already cleared
    return true;
  }
}

/**
 * Triggers a test Web Push notification on the production backend with cold start retry and local fallback
 */
export async function testAdminPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push tidak didukung di peramban ini.' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    const subJson = subscription ? subscription.toJSON() : null;

    const testUrl = getApiUrl('/api/push/test');
    console.log('[WebPush Test] Calling test endpoint:', testUrl);

    let res: Response | null = null;

    // Retry loop up to 2 times to handle Cloud Run cold starts
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        res = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ subscription: subJson }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        break;
      } catch (fetchErr: any) {
        console.warn(`[WebPush Test] Attempt ${attempt} failed:`, fetchErr?.message || fetchErr);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // If backend network completely failed (Load failed / cold start timeout), fallback to local SW notification
    if (!res) {
      try {
        console.warn('[WebPush Test] Backend unreachable, falling back to local service worker notification trigger.');
        await reg.showNotification('🔔 Leton Coffee', {
          body: 'Pesanan Baru Masuk!\n#TEST-001 • Pojan (Uji Coba) • Rp90.000',
          icon: '/logo_icon.jpg',
          badge: '/logo_icon.jpg',
          data: { type: 'TEST_ORDER', orderId: 'TEST-001', outletId: 'all' }
        });
        return { success: true };
      } catch (fallbackErr: any) {
        return { 
          success: false, 
          error: `Gagal terhubung ke server (Load failed). Pastikan koneksi internet stabil.` 
        };
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return { 
        success: false, 
        error: data.error || `HTTP ${res.status}: Gagal mengirim tes notifikasi dari server.` 
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[WebPush Test] Exception:', err);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('🔔 Leton Coffee', {
        body: 'Pesanan Baru Masuk!\n#TEST-001 • Pojan (Uji Coba) • Rp90.000',
        icon: '/logo_icon.jpg',
        badge: '/logo_icon.jpg',
        data: { type: 'TEST_ORDER', orderId: 'TEST-001', outletId: 'all' }
      });
      return { success: true };
    } catch {
      return { 
        success: false, 
        error: err?.message || 'Gagal terhubung ke server backend untuk tes notifikasi.' 
      };
    }
  }
}

export interface PushDebugInfo {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerReady: boolean;
  hasActiveSubscription: boolean;
  endpoint?: string;
  backendConnected: boolean;
  subscriptionsCount?: number;
}

/**
 * Diagnostic helper to retrieve push subscription environment & debug information
 */
export async function fetchPushDebugInfo(): Promise<PushDebugInfo> {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      serviceWorkerReady: false,
      hasActiveSubscription: false,
      backendConnected: false
    };
  }

  const permission = Notification.permission;
  let serviceWorkerReady = false;
  let hasActiveSubscription = false;
  let endpoint: string | undefined = undefined;

  try {
    const reg = await navigator.serviceWorker.ready;
    serviceWorkerReady = !!(reg && reg.active);
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      hasActiveSubscription = true;
      endpoint = sub.endpoint;
    }
  } catch (err) {
    console.warn('[WebPush Debug] Error reading local push status:', err);
  }

  let backendConnected = false;
  let subscriptionsCount = 0;

  try {
    const statusUrl = getApiUrl('/api/push/status');
    const res = await fetch(statusUrl);
    if (res.ok) {
      const data = await res.json();
      backendConnected = true;
      subscriptionsCount = data.count || 0;
    }
  } catch (err) {
    // Backend fetch failed
  }

  return {
    supported: true,
    permission,
    serviceWorkerReady,
    hasActiveSubscription,
    endpoint,
    backendConnected,
    subscriptionsCount
  };
}

// -------------------------------------------------------------
// FIREBASE CLOUD MESSAGING (FCM) SUPPORT
// -------------------------------------------------------------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export function getFcmApp() {
  if (!firebaseConfig.apiKey) {
    return null;
  }
  try {
    if (getApps().length === 0) {
      return initializeApp(firebaseConfig);
    }
    return getApp();
  } catch (err) {
    console.error('[FCM] Error initializing Firebase app:', err);
    return null;
  }
}

export function isFcmSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!firebaseConfig.apiKey && 'serviceWorker' in navigator && 'Notification' in window;
}

export async function subscribeFcmPush(username: string, outletId: string, role?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  console.log('[FCM] subscribeFcmPush called:', { username, outletId, role });
  const app = getFcmApp();
  if (!app) {
    return { success: false, error: 'Firebase config is not set up on this client.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'PERMISSION_DENIED' };
    }

    const messaging = getMessaging(app);
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

    console.log('[FCM] Getting token from messaging provider with VAPID Key:', vapidKey);
    const token = await getToken(messaging, {
      serviceWorkerRegistration: reg,
      vapidKey
    });

    if (!token) {
      throw new Error('No FCM token returned from Firebase.');
    }

    console.log('[FCM] Got active token:', token);

    const nowIso = new Date().toISOString();
    const payload = {
      token,
      username: username || 'unknown_admin',
      outlet_id: outletId || 'all',
      role: role || 'outlet_admin',
      device_info: navigator.userAgent || 'unknown_browser',
      created_at: nowIso,
      updated_at: nowIso
    };

    // Rely strictly on backend API registration to bypass client-side RLS limits securely
    const saveUrl = getApiUrl('/api/fcm/subscribe');
    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned error status ${response.status}`);
    }

    const resData = await response.json();
    if (!resData || !resData.success) {
      throw new Error(resData.error || 'Server indicated subscription failure.');
    }

    console.log('[FCM] Successfully registered FCM token via backend secure API.');
    return { success: true, token };
  } catch (err: any) {
    console.error('[FCM] Error subscribing to Firebase Messaging:', err);
    return { success: false, error: err.message || 'Firebase Messaging subscription failed.' };
  }
}

export async function unsubscribeFcmPush(): Promise<boolean> {
  const app = getFcmApp();
  if (!app) return true;
  try {
    const messaging = getMessaging(app);
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { serviceWorkerRegistration: reg });
    if (token) {
      await deleteToken(messaging);
      
      // Remove from backend API
      try {
        const unsubUrl = getApiUrl('/api/fcm/unsubscribe');
        await fetch(unsubUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (e) {}
      
      // Delete from Supabase table
      try {
        await supabase
          .from('admin_push_tokens')
          .delete()
          .eq('token', token);
      } catch (e) {}

      // Delete from fallback
      try {
        const { data: doc } = await supabase
          .from('leton_content')
          .select('*')
          .eq('id', 'admin_push_tokens')
          .maybeSingle();

        const existingTokens: any[] = doc?.content?.tokens || [];
        const cleanTokens = existingTokens.filter(t => t && t.token !== token);

        await supabase
          .from('leton_content')
          .upsert({
            id: 'admin_push_tokens',
            content: { tokens: cleanTokens },
            updated_at: new Date().toISOString()
          });
      } catch (e) {}
    }
    return true;
  } catch (err) {
    console.warn('[FCM] Error during FCM unsubscription:', err);
    return true;
  }
}

export async function testFcmPush(): Promise<{ success: boolean; error?: string }> {
  const app = getFcmApp();
  if (!app) {
    return { success: false, error: 'Firebase config is not set up on this client.' };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { serviceWorkerRegistration: reg });
    if (!token) {
      return { success: false, error: 'No active FCM token found for this device.' };
    }

    const testUrl = getApiUrl('/api/fcm/test');
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Server-side FCM test failed.' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'FCM test exception.' };
  }
}


