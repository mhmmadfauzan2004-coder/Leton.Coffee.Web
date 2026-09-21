// Leton Coffee - Production PWA Service Worker for Background Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications
self.addEventListener('push', (event) => {
  let payload = {};
  
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = {
        title: '🔔 Pesanan Baru — Leton Coffee',
        body: event.data.text()
      };
    }
  }

  const title = payload.title || '🔔 Pesanan Baru — Leton Coffee';
  const body = payload.body || 'Pesanan baru telah masuk di Leton Coffee.';
  const icon = payload.icon || '/logo_icon.jpg';
  const badge = payload.badge || '/logo_icon.jpg';
  const data = payload.data || {};

  const options = {
    body,
    icon,
    badge,
    vibrate: [100, 50, 100],
    data,
    tag: 'new-order-notification',
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle when user clicks the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const orderId = data.orderId || '';
  const outletId = data.outletId || '';

  // Redirect url
  const targetUrl = `/#admin?tab=orders&orderId=${orderId}&outletId=${outletId}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window and focus it
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === '/' || clientUrl.hash.includes('#admin')) {
            // Send message to the window to update its view if needed
            try {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                orderId,
                outletId
              });
            } catch (err) {}
            
            return client.navigate(targetUrl).then(c => c.focus());
          }
        }
        // If no open window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
