// PS persistence through the normalised v2 functions in supabase/ps-v2.sql.
// Only the server (service role) can call these; browser roles have no table access.
import { createHash } from 'node:crypto';

function config() {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Public speaking is not configured on the server.'), { status: 500 });
  return { url, key };
}

export async function rpc(name, args) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const conflict = body?.code === '40001';
    throw Object.assign(new Error(conflict ? 'This event changed. Refresh and try again; your submission was not saved.' : (body?.message || 'Could not reach public speaking storage.')), { status: conflict ? 409 : 500 });
  }
  return body;
}

export const loadEvent = eventId => rpc('ps_v2_load', { p_event_id: eventId });
export const listEvents = tournamentId => rpc('ps_v2_list', { p_tournament_id: tournamentId });
export const auditTrail = eventId => rpc('ps_v2_audit', { p_event_id: eventId });

export const payloadHash = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');

export function commitEvent(row, state, actor, action, { reason = '', requestKey = null, request = null } = {}) {
  return rpc('ps_v2_commit', {
    p_event_id: row.id, p_tournament_id: row.tournament_id, p_version: row.version, p_state: state,
    p_actor: `${actor.role}:${actor.id}`, p_action: action, p_reason: String(reason || '').slice(0, 1000),
    p_request_key: requestKey, p_payload_hash: requestKey ? payloadHash(request) : ''
  });
}
