self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'TabraCadabra', body: event.data?.text() || 'Tournament update available.' };
  }

  const title = payload.title || 'TabraCadabra';
  const options = {
    body: payload.body || 'Tournament update available.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: payload.url || '/#/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/#/', self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = clientList.find(client => client.url === targetUrl);
    if (existingClient) return existingClient.focus();
    return clients.openWindow(targetUrl);
  })());
});
