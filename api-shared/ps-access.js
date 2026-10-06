import { createHmac, timingSafeEqual } from 'node:crypto';

function signature(payload, secret) {
  if (!secret) throw new Error('Missing Supabase server configuration.');
  return createHmac('sha256', secret).update(`public-speaking:${payload}`).digest('base64url');
}

export function issuePSLink(eventId, person, role, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ eventId, id: person.id, role, version: person.accessVersion, expires: now + 14 * 86400000 })).toString('base64url');
  return `${body}.${signature(body, secret)}`;
}

export function verifyPSLink(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 3000) throw new Error('A private PS link is required.');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Invalid private link.');
  const expected = Buffer.from(signature(parts[0], secret));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid private link.');
  const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (!data.eventId || !data.id || !['speaker', 'judge'].includes(data.role) || !Number.isInteger(data.version) || data.version < 1 || !Number.isFinite(data.expires) || data.expires <= now) throw new Error('This link has expired. Ask tab for a new private link.');
  return data;
}

export function assertPSParticipant(state, actor) {
  const person = (actor.role === 'speaker' ? state.speakers : state.judges).find(p => p.id === actor.id);
  if (!person || !person.active || person.accessVersion !== actor.version) throw new Error('This private link has been revoked. Ask tab for a new link.');
  return person;
}
