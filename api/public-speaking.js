import { randomUUID } from 'node:crypto';
import { collectBody, sendJson } from '../api-shared/portal-utils.js';
import { canAdministerTournament, getSessionContext } from '../api-shared/deletion-utils.js';
import { createEvent, mutateEvent, projectEvent } from '../api-shared/ps-engine.js';
import { issuePSLink, verifyPSLink, assertPSParticipant } from '../api-shared/ps-access.js';
import { auditTrail, commitEvent, listEvents, loadEvent } from '../api-shared/ps-store.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

async function eventRow(eventId, status = 404) {
  if (!uuid(eventId)) fail('Invalid event.', status === 401 ? 401 : 400);
  const row = await loadEvent(eventId);
  if (!row) fail('Event not found.', 404);
  return row;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return sendJson(response, 405, { error: 'Method not allowed.' }); }
  try {
    const payload = request.body && typeof request.body === 'object' ? request.body : JSON.parse(await collectBody(request, 1024 * 512));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Invalid request.');
    const { action, input = {} } = payload;
    const requestKey = payload.requestKey == null ? null : (uuid(payload.requestKey) ? payload.requestKey : fail('Invalid request key.'));
    let row, actor;
    if (payload.token) {
      try { actor = verifyPSLink(payload.token, process.env.SUPABASE_SERVICE_ROLE_KEY); } catch (error) { fail(error.message, 401); }
      row = await eventRow(actor.eventId, 401);
      try { assertPSParticipant(row.state, actor); } catch (error) { fail(error.message, 403); }
    } else if (action === 'public') {
      row = await eventRow(payload.eventId);
      return sendJson(response, 200, { id: row.id, state: projectEvent(row.state) });
    } else {
      const session = await getSessionContext(request);
      if (!session) fail('Sign in to manage public speaking.', 401);
      if (payload.eventId) row = await eventRow(payload.eventId);
      const tournamentId = row?.tournament_id || payload.tournamentId;
      if (typeof tournamentId !== 'string' || !tournamentId || tournamentId.length > 100) fail('Choose a tournament.');
      if (!(await canAdministerTournament(session, tournamentId))) fail('Only this tournament’s administrators can manage public speaking.', 403);
      actor = { role: 'admin', id: session.user.id };
      if (action === 'list') return sendJson(response, 200, { events: await listEvents(tournamentId) });
      if (action === 'create') {
        const created = await commitEvent({ id: randomUUID(), tournament_id: tournamentId, version: 0 }, createEvent(input), actor, action, { requestKey, request: payload });
        return sendJson(response, 200, { id: created.id, version: created.version, state: projectEvent(created.state, actor) });
      }
    }
    if (!row) fail('Choose a public speaking event.');
    if (action === 'read') return sendJson(response, 200, { id: row.id, version: row.version, state: projectEvent(row.state, actor) });
    if (action === 'audit') {
      if (actor.role !== 'admin') fail('Only tournament administrators can view history.', 403);
      return sendJson(response, 200, { audit: await auditTrail(row.id) });
    }
    if (payload.version !== row.version) {
      // A retry of a request that already succeeded returns the saved result; anything else is stale.
      if (!requestKey || !Number.isInteger(payload.version)) fail('This event changed. Refresh and try again; your submission was not saved.', 409);
      const replay = await commitEvent({ ...row, version: payload.version }, row.state, actor, action, { requestKey, request: payload });
      return sendJson(response, 200, { id: replay.id, version: replay.version, state: projectEvent(replay.state, actor), replayed: true });
    }
    const state = mutateEvent(row.state, action, input, actor);
    const saved = await commitEvent(row, state, actor, action, { reason: input.reason, requestKey, request: payload });
    let token;
    if (action === 'portal-link') {
      const person = (input.role === 'speaker' ? saved.state.speakers : saved.state.judges).find(p => p.id === input.personId);
      token = issuePSLink(row.id, person, input.role, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return sendJson(response, 200, { id: saved.id, version: saved.version, state: projectEvent(saved.state, actor), ...(token ? { token } : {}) });
  } catch (error) {
    const status = error.status || 400;
    if (status >= 500) console.error(JSON.stringify({ route: 'public-speaking', error: error.message }));
    sendJson(response, status, { error: status >= 500 ? 'Public speaking is temporarily unavailable. Your change was not saved.' : (error.message || 'Could not complete this public speaking action.') });
  }
}
