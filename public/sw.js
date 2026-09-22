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
        title: '🔔 Leton Coffee',
        body: event.data.text()
      };
    }
  }

  const title = payload.title || '🔔 Leton Coffee';
  const body = payload.body || 'Pesanan Baru Masuk!';
  const icon = payload.icon || '/logo_icon.jpg';
  const badge = payload.badge || '/logo_icon.jpg';
  const data = payload.data || {};

  const orderKey = data.orderNumber || data.orderId || `${Date.now()}`;

  const options = {
    body,
    icon,
    badge,
    vibrate: [200, 100, 200, 100, 200],
    data,
    tag: `order-${orderKey}`,
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle when user clicks the system notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const orderId = data.orderId || data.orderNumber || '';
  const outletId = data.outletId || '';
  const type = data.type || '';

  // Redirect url
  let targetUrl = '/#admin?tab=orders';
  if (orderId && type !== 'TEST_ORDER') {
    targetUrl = `/#admin?tab=orders&orderId=${encodeURIComponent(orderId)}&outletId=${encodeURIComponent(outletId)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window and focus it
        for (const client of clientList) {
          try {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              orderId,
              outletId
            });
          } catch (err) {}
          
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(c => c.focus());
          } else if ('focus' in client) {
            return client.focus();
          }
        }
        // If no open window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

