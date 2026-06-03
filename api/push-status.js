import { collectBody, findPushSubscription, sendJson } from './push-utils.js';

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

  if (!payload.tournamentId || !payload.participantId || !payload.endpoint) {
    sendJson(response, 400, { error: 'Tournament, participant, and endpoint are required.' });
    return;
  }

  try {
    const record = await findPushSubscription({
      tournamentId: payload.tournamentId,
      participantRole: payload.participantRole === 'judge' ? 'judge' : 'team',
      participantId: payload.participantId,
      endpoint: payload.endpoint
    });

    sendJson(response, 200, {
      ok: true,
      subscribed: Boolean(record),
      updatedAt: record?.updated_at || null
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not check push subscription.' });
  }
}
