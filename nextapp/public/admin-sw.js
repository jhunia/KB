/* stress_d admin — service worker for order alerts (push notifications).
   Registered by components/admin/OrderAlerts.tsx with scope /admin/. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'stress_d';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/brand/admin-icon-192.png',
      badge: '/brand/admin-icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/admin/orders' },
    })
  );
});

// Tapping the alert opens that order — reusing the admin app if it's already open
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/admin/orders', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin + '/admin')) {
        try {
          await client.focus();
          await client.navigate(url);
          return;
        } catch { /* window not controlled by this worker — open a fresh one below */ }
      }
    }
    await self.clients.openWindow(url);
  })());
});
