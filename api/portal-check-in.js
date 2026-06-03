import {
  collectBody,
  hashToken,
  sendJson,
  upsertRows,
  validateTokenProfile,
  verifyPortalToken
} from './portal-utils.js';

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = request.method === 'GET'
      ? { token: new URL(request.url, 'https://tabracadabra.app').searchParams.get('token') }
      : JSON.parse(await collectBody(request));
    const tokenData = verifyPortalToken(payload.token);
    await validateTokenProfile(tokenData);

    const rows = await upsertRows('portal_check_ins', [{
      tournament_id: tokenData.tournamentId,
      participant_role: tokenData.role,
      participant_id: tokenData.id,
      token_hash: hashToken(payload.token),
      checked_in_at: new Date().toISOString(),
      user_agent: request.headers['user-agent'] || null
    }], 'tournament_id,participant_role,participant_id');

    if (request.method === 'GET') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Check-in recorded</title><body style="font-family:Inter,Arial,sans-serif;background:#f4f7fb;color:#172033;display:grid;place-items:center;min-height:100vh;margin:0"><main style="background:white;border:1px solid #dbe3ee;border-radius:8px;padding:28px;max-width:420px;text-align:center"><h1 style="margin:0 0 8px;font-size:24px">Check-in recorded</h1><p style="color:#64748b;line-height:1.5">This participant has been checked in for the tournament.</p></main></body>`);
      return;
    }

    sendJson(response, 200, { ok: true, checkIn: rows[0] || null });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not check in.' });
  }
}
