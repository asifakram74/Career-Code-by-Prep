// Career Code by Prep Titans - Mobile & Desktop Service Worker
const CACHE_NAME = 'career-code-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Direct message from client page to show a system notification in OS notification bar
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SHOW_SYSTEM_NOTIFICATION' || event.data.type === 'SHOW_NOTIFICATION')) {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Handle incoming background push events
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Career Code Notification',
    body: 'You have a new message or update.',
    queryId: null,
    url: '/',
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: payload.body || 'New career guidance update',
    icon: self.location.origin + '/icon-192.png',
    badge: self.location.origin + '/badge-72.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: payload.tag || `cc-notice-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || '/',
      queryId: payload.queryId,
      createdAt: Date.now(),
    },
    actions: [
      { action: 'open_chat', title: 'Open Chat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// When user taps the notification in the mobile status bar / notification drawer
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  const queryId = data.queryId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if (queryId) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_CLICKED',
              queryId,
              url: targetUrl,
            });
          }
          return client.focus();
        }
      }
      // Otherwise open fresh window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
