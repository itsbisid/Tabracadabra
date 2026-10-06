import { randomUUID } from 'node:crypto';
import { collectBody, selectRows, sendJson } from '../api-shared/portal-utils.js';
import { canAdministerTournament, getSessionContext } from '../api-shared/deletion-utils.js';
import { createEvent, mutateEvent, projectEvent } from '../api-shared/ps-engine.js';
import { issuePSLink, verifyPSLink, assertPSParticipant } from '../api-shared/ps-access.js';

const eq = value => encodeURIComponent(String(value));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

export async function commitEvent(row, state, actor, action, reason) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/ps_commit`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_event_id: row.id, p_tournament_id: row.tournament_id, p_version: row.version, p_state: state, p_actor: `${actor.role}:${actor.id}`, p_action: action, p_reason: String(reason || '').slice(0, 1000) })
  });
  const body = await response.json();
  if (!response.ok) fail(body.message || 'Could not save public speaking event.', body.code === '40001' ? 409 : 500);
  return Array.isArray(body) ? body[0] : body;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return sendJson(response, 405, { error: 'Method not allowed.' }); }
  try {
    const payload = request.body && typeof request.body === 'object' ? request.body : JSON.parse(await collectBody(request, 1024 * 512));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Invalid request.');
    const { action, input = {} } = payload;
    let row, actor;
    if (payload.token) {
      try { actor = verifyPSLink(payload.token, process.env.SUPABASE_SERVICE_ROLE_KEY); } catch (error) { fail(error.message, 401); }
      if (!uuid(actor.eventId)) fail('Invalid event.', 401);
      [row] = await selectRows('ps_events', `?id=eq.${eq(actor.eventId)}&select=*`);
      if (!row) fail('Event not found.', 404);
      try { assertPSParticipant(row.state, actor); } catch (error) { fail(error.message, 403); }
    } else if (action === 'public') {
      if (!uuid(payload.eventId)) fail('Invalid event.');
      [row] = await selectRows('ps_events', `?id=eq.${eq(payload.eventId)}&select=*`);
      if (!row) fail('Event not found.', 404);
      return sendJson(response, 200, { id: row.id, state: projectEvent(row.state) });
    } else {
      const session = await getSessionContext(request);
      if (!session) fail('Sign in to manage public speaking.', 401);
      if (payload.eventId) {
        if (!uuid(payload.eventId)) fail('Invalid event.');
        [row] = await selectRows('ps_events', `?id=eq.${eq(payload.eventId)}&select=*`);
        if (!row) fail('Event not found.', 404);
      }
      const tournamentId = row?.tournament_id || payload.tournamentId;
      if (typeof tournamentId !== 'string' || !tournamentId || tournamentId.length > 100) fail('Choose a tournament.');
      if (!(await canAdministerTournament(session, tournamentId))) fail('Only this tournament’s administrators can manage public speaking.', 403);
      actor = { role: 'admin', id: session.user.id };
      if (action === 'list') {
        const events = await selectRows('ps_events', `?tournament_id=eq.${eq(tournamentId)}&select=id,state,version&order=created_at.asc`);
        return sendJson(response, 200, { events: events.map(e => ({ id: e.id, name: e.state.name, type: e.state.type, speakers: e.state.speakers.length, rounds: e.state.rounds.length })) });
      }
      if (action === 'create') {
        const created = await commitEvent({ id: randomUUID(), tournament_id: tournamentId, version: 0 }, createEvent(input), actor, action);
        return sendJson(response, 200, { id: created.id, version: created.version, state: projectEvent(created.state, actor) });
      }
    }
    if (!row) fail('Choose a public speaking event.');
    if (action === 'read') return sendJson(response, 200, { id: row.id, version: row.version, state: projectEvent(row.state, actor) });
    if (action === 'audit' && actor.role === 'admin') {
      const audit = await selectRows('ps_audit', `?event_id=eq.${eq(row.id)}&select=id,actor,action,reason,version,created_at&order=id.desc&limit=100`);
      return sendJson(response, 200, { audit });
    }
    if (payload.version !== row.version) fail('This event changed. Refresh and try again; your submission was not saved.', 409);
    const state = mutateEvent(row.state, action, input, actor);
    const saved = await commitEvent(row, state, actor, action, input.reason);
    let token;
    if (action === 'portal-link') {
      const person = (input.role === 'speaker' ? state.speakers : state.judges).find(p => p.id === input.personId);
      token = issuePSLink(row.id, person, input.role, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return sendJson(response, 200, { id: saved.id, version: saved.version, state: projectEvent(saved.state, actor), ...(token ? { token } : {}) });
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message || 'Could not complete this public speaking action.' });
  }
}
