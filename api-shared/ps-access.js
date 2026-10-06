// Private PS participant links. Tokens are 256-bit random values; only their SHA-256 hashes are
// stored (ps_access_tokens). A link ("psl_") is exchanged for a short session ("pss_") so the
// link can be removed from the address bar. Revoking a link ends its sessions server-side.
import { randomBytes, createHash } from 'node:crypto';

export const LINK_DAYS = 14;
export const SESSION_HOURS = 12;
export const newToken = kind => `${kind === 'session' ? 'pss' : 'psl'}_${randomBytes(32).toString('base64url')}`;
export const hashToken = token => createHash('sha256').update(String(token)).digest('hex');
export const tokenKind = token => typeof token === 'string' && /^ps[ls]_[A-Za-z0-9_-]{43}$/.test(token) ? (token.startsWith('pss_') ? 'session' : 'portal') : null;

export function assertPSParticipant(state, actor) {
  const person = (actor.role === 'speaker' ? state.speakers : state.judges).find(p => p.id === actor.id);
  if (!person || !person.active) throw new Error('This private link is no longer active. Ask tab for a new link.');
  return person;
}
