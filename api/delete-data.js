import {
  canAdministerTournament,
  collectBody,
  deleteAccountData,
  deleteTournamentData,
  getSessionContext,
  sendJson
} from '../api-shared/deletion-utils.js';

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

  const scope = String(payload.scope || '').trim().toLowerCase();
  if (!['account', 'tournament'].includes(scope)) {
    sendJson(response, 400, { error: 'A valid deletion scope is required.' });
    return;
  }

  try {
    const session = await getSessionContext(request);
    if (!session) {
      sendJson(response, 401, { error: `You must be signed in to delete this ${scope}.` });
      return;
    }

    if (scope === 'account') {
      const result = await deleteAccountData(session.user);
      sendJson(response, 200, { ok: true, result });
      return;
    }

    const tournamentId = String(payload.tournamentId || '').trim();
    if (!tournamentId) {
      sendJson(response, 400, { error: 'A tournament id is required.' });
      return;
    }

    if (!(await canAdministerTournament(session, tournamentId))) {
      sendJson(response, 403, { error: 'You do not have permission to delete this tournament.' });
      return;
    }

    const deleted = await deleteTournamentData(tournamentId);
    sendJson(response, 200, { ok: true, deleted });
  } catch (error) {
    sendJson(response, 500, { error: error.message || `Could not delete this ${scope}.` });
  }
}
