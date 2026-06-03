function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

async function getPushConfig() {
  const response = await fetch('/api/push-config');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Push notifications are not configured.');
  return data;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getRegisteredPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPortalPushStatus({ tournamentId, participantRole, participantId }) {
  if (!isPushSupported()) {
    return { state: 'unsupported', permission: 'unsupported', subscribed: false };
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    return { state: 'denied', permission, subscribed: false };
  }

  let subscription = await getRegisteredPushSubscription();
  if (!subscription && permission === 'granted') {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
  }

  if (!subscription) {
    return { state: 'not_subscribed', permission, subscribed: false };
  }

  const response = await fetch('/api/push-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tournamentId,
      participantRole,
      participantId,
      endpoint: subscription.endpoint
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Push subscription status could not be checked.');

  return {
    state: data.subscribed ? 'subscribed' : 'local_only',
    permission,
    subscribed: Boolean(data.subscribed),
    updatedAt: data.updatedAt || null
  };
}

export async function subscribeToPortalPush({ tournamentId, participantRole, participantId, participantName, portalUrl }) {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const { publicKey } = await getPushConfig();
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tournamentId,
      participantRole,
      participantId,
      participantName,
      portalUrl,
      subscription
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Push subscription could not be saved.');
  return data;
}

export async function sendTournamentPush({ authorization, tournamentId, title, body, url }) {
  const response = await fetch('/api/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {})
    },
    body: JSON.stringify({ tournamentId, title, body, url })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Push notification could not be sent.');
  return data;
}
