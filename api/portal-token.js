import {
  collectBody,
  createPortalToken,
  hashToken,
  selectRows,
  sendJson,
  validateTokenProfile
} from './portal-utils.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = JSON.parse(await collectBody(request));
    const role = payload.role === 'judge' ? 'judge' : 'team';
    const tokenData = { role, id: payload.id, tournamentId: payload.tournamentId };
    await validateTokenProfile(tokenData);

    const token = createPortalToken(tokenData);
    const checkIns = await selectRows(
      'portal_check_ins',
      `?tournament_id=eq.${encodeURIComponent(tokenData.tournamentId)}&participant_role=eq.${role}&participant_id=eq.${encodeURIComponent(tokenData.id)}&select=checked_in_at,token_hash`
    );

    sendJson(response, 200, {
      ok: true,
      token,
      checkIn: checkIns[0] ? {
        checkedIn: true,
        checkedInAt: checkIns[0].checked_in_at,
        tokenMatches: checkIns[0].token_hash === hashToken(token)
      } : { checkedIn: false }
    });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not create portal token.' });
  }
}
