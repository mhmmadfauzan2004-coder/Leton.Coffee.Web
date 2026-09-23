// Leton Coffee - Production PWA Service Worker for Background Web Push with OneSignal v16
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const SW_VERSION = '1.2.0-onesignal';

const SUPABASE_URL = 'https://galwyavdonfzuibrmswt.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbHd5YXZkb25menVpYnJtc3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzOTY3MjAsImV4cCI6MjA1Nzk3MjcyMH0.KqY9Y637n2f-qf14d8x2X_57h8hQy7kL5bM1qP9R2Yw';

async function sendTelemetryLog(stage, details) {
  try {
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/leton_content?id=eq.sw_telemetry_logs&select=*`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    
    let logs = [];
    if (getRes.ok) {
      const data = await getRes.json();
      if (Array.isArray(data) && data[0]?.content?.logs) {
        logs = data[0].content.logs.slice(-50);
      }
    }
    
    logs.push({
      timestamp: new Date().toISOString(),
      version: SW_VERSION,
      stage,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
    });
    
    await fetch(`${SUPABASE_URL}/rest/v1/leton_content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        id: 'sw_telemetry_logs',
        content: { logs },
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn('[SW Telemetry Warning]:', err);
  }
}

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing Service Worker...`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating Service Worker...`);
  event.waitUntil(self.clients.claim());
});

// Single clean independent push handler
self.addEventListener('push', (event) => {
  console.log(`[SW ${SW_VERSION}] PUSH_EVENT_RECEIVED`);

  event.waitUntil(
    (async () => {
      await sendTelemetryLog('PUSH_EVENT_RECEIVED', {
        hasData: Boolean(event.data),
        timestamp: new Date().toISOString()
      });

      let data = {};

      try {
        data = event.data ? event.data.json() : {};
        console.log(`[SW ${SW_VERSION}] PAYLOAD_PARSED:`, data);
        await sendTelemetryLog('PAYLOAD_PARSED', data);
      } catch (err) {
        data = {
          title: '🔔 Leton Coffee',
          body: event.data ? event.data.text() : 'Pesanan baru telah diterima.'
        };
        await sendTelemetryLog('PAYLOAD_PARSE_WARNING', { text: data.body });
      }

      const title = data.title || '🔔 Leton Coffee';
      const baseUrl = 'https://leton-coffee-web.pages.dev';

      // Lightweight 23KB notification icon for iOS background memory limit
      const options = {
        body: data.body || 'Pesanan baru telah diterima.',
        icon: data.icon || `${baseUrl}/logo_icon_small.png`,
        tag: data.tag || `push-${data.orderId || data.orderNumber || Date.now()}`,
        data: data.data || {
          orderId: data.orderId,
          outletId: data.outletId,
          url: data.data?.url || '/#admin?tab=orders'
        }
      };

      console.log(`[SW ${SW_VERSION}] SHOW_NOTIFICATION_CALLED with tag: ${options.tag}`);
      await sendTelemetryLog('SHOW_NOTIFICATION_CALLED', { title, tag: options.tag, icon: options.icon });

      try {
        await self.registration.showNotification(title, options);
        console.log(`[SW ${SW_VERSION}] SHOW_NOTIFICATION_SUCCESS for tag: ${options.tag}`);
        await sendTelemetryLog('SHOW_NOTIFICATION_SUCCESS', { tag: options.tag });
      } catch (error) {
        console.error(`[SW ${SW_VERSION}] SHOW_NOTIFICATION_ERROR:`, error);
        await sendTelemetryLog('SHOW_NOTIFICATION_ERROR', { tag: options.tag, error: error?.message || String(error) });

        // Fallback minimal notification without custom images
        try {
          await self.registration.showNotification(title, {
            body: options.body,
            tag: options.tag,
            data: options.data
          });
          console.log(`[SW ${SW_VERSION}] Minimal fallback SHOW_NOTIFICATION_SUCCESS`);
          await sendTelemetryLog('MINIMAL_FALLBACK_SUCCESS', { tag: options.tag });
        } catch (fallbackErr) {
          console.error(`[SW ${SW_VERSION}] Minimal fallback SHOW_NOTIFICATION_FAILED:`, fallbackErr);
          await sendTelemetryLog('MINIMAL_FALLBACK_FAILED', { tag: options.tag, error: fallbackErr?.message || String(fallbackErr) });
        }
      }
    })()
  );
});

// Single clean notificationclick handler
self.addEventListener('notificationclick', (event) => {
  console.log(`[SW ${SW_VERSION}] Notification clicked:`, event.notification.tag);
  event.notification.close();

  const data = event.notification.data || {};
  const orderId = data.orderId || '';
  const outletId = data.outletId || '';

  let targetUrl = data.url || '/#admin';
  if (orderId && orderId !== 'TEST-001') {
    targetUrl = `/#admin?tab=orders&orderId=${encodeURIComponent(orderId)}&outletId=${encodeURIComponent(outletId)}`;
  }

  event.waitUntil(
    (async () => {
      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      } catch (err) {
        console.error(`[SW ${SW_VERSION}] Notification click handler error:`, err);
      }
    })()
  );
});

// -------------------------------------------------------------
// ONESIGNAL BACKGROUND WORKER INTEGRATION
// -------------------------------------------------------------
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
  console.log('[SW] OneSignal SDK service worker successfully imported.');
} catch (e) {
  console.log('[SW] OneSignal SDK import skipped or already handled by OneSignalSDKWorker.js');
}
