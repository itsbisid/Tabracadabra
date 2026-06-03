import webpush from 'web-push';
import {
  canAdministerTournament,
  collectBody,
  deletePushSubscription,
  getSessionContext,
  assertPushConfigured,
  listPushSubscriptions,
  sendJson
} from './push-utils.js';

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

  if (!payload.tournamentId || !payload.title || !payload.body) {
    sendJson(response, 400, { error: 'Tournament, title, and body are required.' });
    return;
  }

  const session = await getSessionContext(request);
  if (!session) {
    sendJson(response, 401, { error: 'You must be signed in to send push notifications.' });
    return;
  }

  if (!(await canAdministerTournament(session, payload.tournamentId))) {
    sendJson(response, 403, { error: 'You do not have permission to send push notifications for this tournament.' });
    return;
  }

  let config;
  try {
    config = assertPushConfigured();
  } catch (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  try {
    const subscriptions = await listPushSubscriptions(payload.tournamentId);
    const results = await Promise.allSettled(subscriptions.map(async record => {
      try {
        await webpush.sendNotification(record.subscription, JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || record.portal_url || '/#/'
        }));
        return { endpoint: record.endpoint, ok: true };
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await deletePushSubscription(record.endpoint);
        }
        throw error;
      }
    }));

    sendJson(response, 200, {
      ok: true,
      attempted: subscriptions.length,
      sent: results.filter(result => result.status === 'fulfilled').length,
      failed: results.filter(result => result.status === 'rejected').length
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not send push notifications.' });
  }
}
