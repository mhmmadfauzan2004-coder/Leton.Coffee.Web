// Utility to manage web push subscriptions on the client side

import { getApiUrl } from './api';

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

    // 3. Fetch VAPID public key from backend
    checkpoints['CHECKPOINT 3 (GET /api/push/vapid-public-key)'] = 'PENDING';
    const vapidUrl = getApiUrl('/api/push/vapid-public-key');
    console.log('[WebPush Checkpoint 3] Contacting backend to retrieve VAPID public key. URL:', vapidUrl);
    
    const vapidRes = await fetch(vapidUrl);
    if (!vapidRes.ok) {
      throw new Error(`HTTP ${vapidRes.status}: Failed to fetch VAPID public key. Endpoint: ${vapidUrl}`);
    }
    
    // Read response text first to debug Safari json parsing error
    const rawText = await vapidRes.text();
    console.log('[WebPush Checkpoint 3] Raw public key response text length:', rawText.length);
    
    let keyData: any;
    try {
      keyData = JSON.parse(rawText);
    } catch (parseErr: any) {
      throw new Error(`JSON_PARSE_ERROR: Failed to parse backend response as JSON. Raw: ${rawText.substring(0, 150)}`);
    }

    const publicKey = keyData?.publicKey;
    checkpoints['CHECKPOINT 3 (GET /api/push/vapid-public-key)'] = 'PASS';

    // 4. Validate VAPID public key
    checkpoints['CHECKPOINT 4 (validasi VAPID public key)'] = 'PENDING';
    if (!publicKey) {
      throw new Error('VAPID public key is empty, null or undefined in backend JSON.');
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
      throw new Error(`VAPID Validation failed: length=${publicKey.length}, whitespace=${hasWhitespace}, quotes=${hasQuotes}, prefix=${hasPrefix}, newline=${hasNewline}, base64url=${isBase64UrlValid}`);
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

    console.log('[WebPush Checkpoint 6] Checking existing push subscription on browser...');
    let subscription = await reg.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[WebPush Checkpoint 6] No active subscription. Initiating subscription from push manager...');
      try {
        subscription = await reg.pushManager.subscribe(subscribeOptions);
      } catch (subError: any) {
        console.error('[WebPush Checkpoint 6] Native subscribe error caught:', subError);
        throw subError;
      }
      console.log('[WebPush Checkpoint 6] Device successfully subscribed to browser Push Service.');
    } else {
      console.log('[WebPush Checkpoint 6] Active device subscription already exists.');
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

    // 7. Send subscription details to backend
    checkpoints['CHECKPOINT 8 (POST subscription ke backend)'] = 'PENDING';
    checkpoints['CHECKPOINT 9 (subscription berhasil disimpan)'] = 'PENDING';
    const saveUrl = getApiUrl('/api/push/subscribe');
    console.log('[WebPush Checkpoint 8] Saving subscription to URL:', saveUrl);

    const subRes = await fetch(saveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription,
        username,
        outletId,
        role
      })
    });
    checkpoints['CHECKPOINT 8 (POST subscription ke backend)'] = 'PASS';

    if (!subRes.ok) {
      const errorText = await subRes.text().catch(() => '');
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `HTTP ${subRes.status}: ${errorText}` };
      }
      throw new Error(errorData.error || `HTTP ${subRes.status}: Failed to synchronize subscription on backend.`);
    }

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
 * Unsubscribes from Web Push and removes it from backend
 */
export async function unsubscribeAdminPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // 1. Tell backend to delete subscription
      await fetch(getApiUrl('/api/push/unsubscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint })
      });

      // 2. Unsubscribe from browser push manager
      await subscription.unsubscribe();
      console.log('[WebPush] Unsubscribed successfully.');
    }

    return true;
  } catch (err) {
    console.error('[WebPush] Error during unsubscription:', err);
    return false;
  }
}
