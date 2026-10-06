import { randomUUID } from 'node:crypto';
import { collectBody, sendJson } from '../api-shared/portal-utils.js';
import { canAdministerTournament, getSessionContext } from '../api-shared/deletion-utils.js';
import { createEvent, mutateEvent, projectEvent, previewRules, planCapacity } from '../api-shared/ps-engine.js';
import { assertPSParticipant, hashToken, newToken, tokenKind, LINK_DAYS, SESSION_HOURS } from '../api-shared/ps-access.js';
import { proposeDraw } from '../api-shared/ps-draw.js';
import { allowRequest, auditTrail, checkToken, commitEvent, issueToken, linkStatus, listEvents, loadEvent, revokeTokens } from '../api-shared/ps-store.js';

const clientKey = request => String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || request.socket?.remoteAddress || 'unknown';

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
    const credential = payload.session || payload.token;
    if (credential) {
      // Participant access: a private link (psl_) or the session it was exchanged for (pss_).
      const kind = tokenKind(credential);
      const grant = kind ? await checkToken(hashToken(credential)) : null;
      if (!grant) {
        if (!(await allowRequest(`bad-link:${clientKey(request)}`, 30, 600))) fail('Too many attempts. Wait a few minutes and try again.', 429);
        fail('This private link is invalid, expired or has been replaced. Ask tab for a new link.', 401);
      }
      actor = { role: grant.role, id: grant.id, eventId: grant.eventId };
      row = await eventRow(grant.eventId, 401);
      try { assertPSParticipant(row.state, actor); } catch (error) { fail(error.message, 403); }
      if (action === 'redeem') {
        if (kind !== 'portal') fail('Open your private link to start a session.', 400);
        if (!(await allowRequest(`redeem:${clientKey(request)}`, 60, 600))) fail('Too many attempts. Wait a few minutes and try again.', 429);
        const session = newToken('session');
        const expiresAt = new Date(Math.min(Date.parse(grant.expiresAt), Date.now() + SESSION_HOURS * 3600000)).toISOString();
        await issueToken({ eventId: grant.eventId, entryId: grant.id, hash: hashToken(session), purpose: 'session', expiresAt, parentHash: hashToken(credential) });
        return sendJson(response, 200, { session, sessionExpiresAt: expiresAt, id: row.id, version: row.version, state: projectEvent(row.state, actor) });
      }
    } else if (action === 'public') {
      row = await eventRow(payload.eventId);
      return sendJson(response, 200, { id: row.id, state: projectEvent(row.state) });
    } else {
      const session = await getSessionContext(request);
      if (!session) fail('Sign in to manage public speaking.', 401);
      // Read-only and tournament-independent: validates draft rules (also used before a tournament exists).
      if (action === 'preview-rules') return sendJson(response, 200, previewRules(input, input.sampleScores));
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
    if (action === 'read') return sendJson(response, 200, { id: row.id, version: row.version, state: projectEvent(row.state, actor), ...(actor.role === 'admin' ? { links: await linkStatus(row.id) } : {}) });
    if (action === 'portal-link' || action === 'revoke-link') {
      if (actor.role !== 'admin') fail('Only tournament administrators can manage private links.', 403);
      if (!['speaker', 'judge'].includes(input.role)) fail('Invalid participant role.');
      const person = (input.role === 'speaker' ? row.state.speakers : row.state.judges).find(p => p.id === input.personId);
      if (!person) fail('Participant not found.', 404);
      if (action === 'revoke-link') {
        await revokeTokens(row.id, person.id, `admin:${actor.id}`, input.reason);
        return sendJson(response, 200, { revoked: true, links: await linkStatus(row.id) });
      }
      if (!person.active) fail('Restore this participant before issuing a link.');
      const token = newToken('portal'), expiresAt = new Date(Date.now() + LINK_DAYS * 86400000).toISOString();
      await issueToken({ eventId: row.id, entryId: person.id, hash: hashToken(token), purpose: 'portal', expiresAt, actor: `admin:${actor.id}`, reason: input.reason });
      return sendJson(response, 200, { token, expiresAt, links: await linkStatus(row.id) });
    }
    if (action === 'propose-draw') {
      // Read-only: suggests sections, speaking order and judges for a draft round. Tab reviews, edits and saves.
      if (actor.role !== 'admin') fail('Only tournament administrators can draw rounds.', 403);
      const round = row.state.rounds.find(r => r.id === input.roundId);
      if (!round) fail('Round not found.', 404);
      if (round.status !== 'draft') fail('Only draft rounds can be drawn.');
      return sendJson(response, 200, proposeDraw(row.state, round, input));
    }
    if (action === 'plan') {
      if (actor.role !== 'admin') fail('Only tournament administrators can plan capacity.', 403);
      return sendJson(response, 200, { plan: planCapacity(row.state, input) });
    }
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
    return sendJson(response, 200, { id: saved.id, version: saved.version, state: projectEvent(saved.state, actor), ...(actor.role === 'admin' ? { links: await linkStatus(row.id) } : {}) });
  } catch (error) {
    const status = error.status || 400;
    if (status >= 500) console.error(JSON.stringify({ route: 'public-speaking', error: error.message }));
    sendJson(response, status, { error: status >= 500 ? 'Public speaking is temporarily unavailable. Your change was not saved.' : (error.message || 'Could not complete this public speaking action.') });
  }
}
