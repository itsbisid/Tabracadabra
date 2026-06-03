import webpush from 'web-push';
import { assertPushConfigured, collectBody, sendJson, upsertPushSubscription } from './push-utils.js';

function isValidSubscription(subscription) {
  return subscription
    && typeof subscription.endpoint === 'string'
    && subscription.endpoint.startsWith('https://')
    && subscription.keys?.p256dh
    && subscription.keys?.auth;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await collectBody(request));
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid JSON payload.' });
    return;
  }

  if (!payload.tournamentId || !payload.participantId || !isValidSubscription(payload.subscription)) {
    sendJson(response, 400, { error: 'Tournament, participant, and valid push subscription are required.' });
    return;
  }

  try {
    const subscription = payload.subscription;
    const record = await upsertPushSubscription({
      tournament_id: payload.tournamentId,
      participant_role: payload.participantRole === 'judge' ? 'judge' : 'team',
      participant_id: payload.participantId,
      participant_name: payload.participantName || null,
      portal_url: payload.portalUrl || null,
      endpoint: subscription.endpoint,
      subscription,
      user_agent: request.headers['user-agent'] || null,
      updated_at: new Date().toISOString()
    });

    const config = assertPushConfigured();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    await webpush.sendNotification(subscription, JSON.stringify({
      title: 'TabraCadabra notifications enabled',
      body: 'You will receive tournament updates here.',
      url: payload.portalUrl || '/#/'
    })).catch(() => null);

    sendJson(response, 200, { ok: true, id: record?.id || null });
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not save push subscription.' });
  }
}
