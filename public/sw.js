// Leton Coffee - Production PWA Service Worker for Background Web Push
const SW_VERSION = '1.1.0-ios-bg-push';

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
      let data = {};

      try {
        data = event.data ? event.data.json() : {};
        console.log(`[SW ${SW_VERSION}] PAYLOAD_PARSED:`, data);
      } catch (err) {
        data = {
          title: '🔔 Leton Coffee',
          body: event.data ? event.data.text() : 'Pesanan baru telah diterima.'
        };
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

      try {
        await self.registration.showNotification(title, options);
        console.log(`[SW ${SW_VERSION}] SHOW_NOTIFICATION_SUCCESS for tag: ${options.tag}`);
      } catch (error) {
        console.error(`[SW ${SW_VERSION}] SHOW_NOTIFICATION_ERROR:`, error);

        // Fallback minimal notification without custom images
        try {
          await self.registration.showNotification(title, {
            body: options.body,
            tag: options.tag,
            data: options.data
          });
          console.log(`[SW ${SW_VERSION}] Minimal fallback SHOW_NOTIFICATION_SUCCESS`);
        } catch (fallbackErr) {
          console.error(`[SW ${SW_VERSION}] Minimal fallback SHOW_NOTIFICATION_FAILED:`, fallbackErr);
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
