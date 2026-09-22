// Leton Coffee - Production PWA Service Worker for Background Web Push
const SW_VERSION = '1.0.9-ios-bg-push';

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
  console.log(`[SW ${SW_VERSION}] Push event received`);

  event.waitUntil(
    (async () => {
      let data = {};

      try {
        data = event.data ? event.data.json() : {};
      } catch (err) {
        data = {
          title: 'TEST BACKGROUND PUSH',
          body: event.data ? event.data.text() : 'Background push received'
        };
      }

      const title = data.title || '🔔 Leton Coffee';
      const baseUrl = self.location ? self.location.origin : '';

      const options = {
        body: data.body || 'Pesanan baru telah diterima.',
        icon: data.icon ? (data.icon.startsWith('http') ? data.icon : `${baseUrl}${data.icon}`) : `${baseUrl}/logo_icon.jpg`,
        badge: data.badge ? (data.badge.startsWith('http') ? data.badge : `${baseUrl}${data.badge}`) : `${baseUrl}/logo_icon.jpg`,
        tag: data.tag || `push-${data.orderId || data.orderNumber || Date.now()}`,
        data: data.data || {
          orderId: data.orderId,
          outletId: data.outletId,
          url: data.data?.url || '/#admin'
        }
      };

      try {
        await self.registration.showNotification(title, options);
        console.log(`[SW ${SW_VERSION}] showNotification SUCCESS for tag: ${options.tag}`);
      } catch (error) {
        console.error(`[SW ${SW_VERSION}] showNotification ERROR:`, error);

        // Fallback minimal notification without custom images
        try {
          await self.registration.showNotification(title, {
            body: options.body,
            tag: options.tag,
            data: options.data
          });
          console.log(`[SW ${SW_VERSION}] Minimal fallback showNotification SUCCESS`);
        } catch (fallbackErr) {
          console.error(`[SW ${SW_VERSION}] Minimal fallback showNotification FAILED:`, fallbackErr);
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
