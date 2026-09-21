// Utility to manage web push subscriptions on the client side

import { getApiUrl } from './api';

// Convert URL safe base64 to Uint8Array for VAPID applicationServerKey
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
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

  if (!isPushSupported()) {
    console.warn('[WebPush] Push notifications are not supported on this browser/device.');
    return { success: false, error: 'Push notifications are not supported on this browser/device.' };
  }

  try {
    // 1. Check current permission & Request notification permission
    const currentPermission = Notification.permission;
    console.log('[WebPush] Current browser notification permission state:', currentPermission);

    if (currentPermission === 'denied') {
      console.warn('[WebPush] Notification permission already denied by browser settings.');
      return { success: false, error: 'PERMISSION_DENIED', permission: 'denied' };
    }

    const permission = await Notification.requestPermission();
    console.log('[WebPush] Notification.requestPermission result:', permission);
    
    if (permission !== 'granted') {
      console.warn('[WebPush] Notification permission denied/ignored by user.');
      return { success: false, error: 'PERMISSION_DENIED', permission };
    }

    // 2. Fetch VAPID public key from backend
    console.log('[WebPush] Contacting backend to retrieve VAPID public key...');
    const vapidRes = await fetch(getApiUrl('/api/push/vapid-public-key'));
    if (!vapidRes.ok) {
      throw new Error(`HTTP ${vapidRes.status}: Failed to fetch VAPID public key from backend.`);
    }
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      throw new Error('VAPID public key retrieved is empty or invalid.');
    }
    console.log('[WebPush] VAPID public key successfully retrieved.');

    // 3. Register or get the ready Service Worker
    console.log('[WebPush] Checking Service Worker readiness...');
    const reg = await navigator.serviceWorker.ready;
    console.log('[WebPush] Service Worker is active and ready inside scope:', reg.scope);

    // 4. Subscribe the browser device to Push Manager
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    };

    console.log('[WebPush] Checking existing push subscription on browser...');
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      console.log('[WebPush] No active subscription found. Initiating subscription from push manager...');
      subscription = await reg.pushManager.subscribe(subscribeOptions);
      console.log('[WebPush] Device successfully subscribed to browser Push Service.');
    } else {
      console.log('[WebPush] Active device subscription already exists.');
    }

    // 5. Send subscription details to backend
    console.log('[WebPush] Synchronizing device subscription object with backend server...');
    const subRes = await fetch(getApiUrl('/api/push/subscribe'), {
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

    if (!subRes.ok) {
      const errorData = await subRes.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${subRes.status}: Failed to register subscription on Express backend.`);
    }

    console.log('[WebPush] Backend registration fully synchronized.');
    return { success: true, permission };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[WebPush] Error during subscription registration flow:', err);
    return { success: false, error: errorMsg };
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
