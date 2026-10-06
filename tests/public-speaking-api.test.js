import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/public-speaking.js';
import { createPSDatabase, callRpc } from './helpers/ps-db.js';

const tournamentId = '4a16320d-5ccc-4e53-aaca-b9033af9371c';
const owner = { id: 'owner' };
process.env.VITE_SUPABASE_URL = 'https://ps-test.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';

async function call(body, token = 'owner-token', method = 'POST') {
  let result;
  await handler({ method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }, {
    statusCode: 200, setHeader() {}, end(raw) { result = { status: this.statusCode, body: JSON.parse(raw) }; }
  });
  return result;
}

test('API enforces admin auth, isolates portals, and rejects stale writes', async t => {
  const originalFetch = global.fetch;
  const { db } = await createPSDatabase({ tournamentId });
  const calls = [];
  const load = async id => (await callRpc(db, 'ps_v2_load', { p_event_id: id }))[0];
  global.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname.endsWith('/auth/v1/user')) return options.headers.Authorization === 'Bearer owner-token' ? reply(owner) : options.headers.Authorization === 'Bearer outsider-token' ? reply({ id: 'outsider' }) : reply({}, 401);
    if (u.pathname.endsWith('/tournaments')) return reply([{ owner_id: owner.id }]);
    if (u.pathname.endsWith('/tournament_memberships')) return reply([]);
    const rpc = u.pathname.match(/\/rpc\/(ps_v2_[a-z_]+)$/);
    if (rpc) {
      assert.equal(options.headers.Authorization, 'Bearer service-test');
      calls.push(rpc[1]);
      return reply(...await callRpc(db, rpc[1], JSON.parse(options.body)));
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  t.after(() => { global.fetch = originalFetch; });
  assert.equal((await call({}, null, 'GET')).status, 405);
  assert.equal((await call({ action: 'list', tournamentId }, null)).status, 401);
  assert.equal((await call({ action: 'create', tournamentId, input: { name: 'Forbidden' } }, 'outsider-token')).status, 403);
  const created = await call({ action: 'create', tournamentId, input: { name: 'Prepared' } });
  assert.equal(created.status, 200);
  const id = created.body.id;
  let row = await load(id);
  assert.equal((await call({ action: 'read', eventId: id }, 'outsider-token')).status, 403);
  let result = await call({ action: 'add-speakers', eventId: id, version: row.version, input: { people: [{ name: 'Ama' }] } });
  assert.equal(result.status, 200);
  const stale = await call({ action: 'add-speakers', eventId: id, version: row.version, input: { people: [{ name: 'Must not persist' }] } });
  assert.equal(stale.status, 409);
  row = await load(id);
  assert.equal(row.state.speakers.length, 1);
  const amaId = row.state.speakers[0].id;
  result = await call({ action: 'portal-link', eventId: id, input: { role: 'speaker', personId: amaId } });
  const token = result.body.token;
  assert.match(token, /^psl_/);
  assert.ok(result.body.links[amaId], 'admin sees the link is active');
  // Only the hash is stored.
  const stored = await db.query('select token_hash from ps_access_tokens');
  assert.ok(!JSON.stringify(stored.rows).includes(token));
  assert.equal((await call({ action: 'portal-link', eventId: id, input: { role: 'speaker', personId: amaId } }, 'outsider-token')).status, 403);
  // Exchange the link for a session, as the portal does.
  const redeemed = await call({ action: 'redeem', token }, null);
  assert.equal(redeemed.status, 200); assert.match(redeemed.body.session, /^pss_/);
  const session = redeemed.body.session;
  assert.equal((await call({ action: 'read', session }, null)).body.state.participant.name, 'Ama');
  assert.equal((await call({ action: 'redeem', session }, null)).status, 400, 'a session cannot mint sessions');
  assert.equal((await call({ action: 'settings', session, version: redeemed.body.version, input: { name: 'Attack' } }, null)).status, 400);
  assert.equal((await call({ action: 'plan', session }, null)).status, 403);
  const publicView = await call({ action: 'public', eventId: id }, null);
  assert.equal(publicView.status, 200); assert.deepEqual(publicView.body.state.speakers, []);
  result = await call({ action: 'check-in', session, version: redeemed.body.version }, null);
  assert.equal(result.status, 200); assert.equal(result.body.state.participant.checkedIn, true);
  // Tampered and unknown tokens are refused.
  assert.equal((await call({ action: 'read', token: token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A') }, null)).status, 401);
  assert.equal((await call({ action: 'read', token: 'psl_' + 'x'.repeat(43) }, null)).status, 401);
  // Issuing a new link replaces the old link and ends its sessions.
  const replacement = (await call({ action: 'portal-link', eventId: id, input: { role: 'speaker', personId: amaId } })).body.token;
  assert.equal((await call({ action: 'read', token }, null)).status, 401);
  assert.equal((await call({ action: 'read', session }, null)).status, 401);
  assert.equal((await call({ action: 'read', token: replacement }, null)).status, 200);
  await call({ action: 'revoke-link', eventId: id, input: { role: 'speaker', personId: amaId, reason: 'Lost phone' } });
  assert.equal((await call({ action: 'read', token: replacement }, null)).status, 401);
  // Expired links stop working.
  const expiring = (await call({ action: 'portal-link', eventId: id, input: { role: 'speaker', personId: amaId } })).body.token;
  await db.query(`update ps_access_tokens set expires_at = now() - interval '1 second' where revoked_at is null`);
  assert.equal((await call({ action: 'read', token: expiring }, null)).status, 401);
  // Repeated bad guesses are rate limited.
  let limited = 0;
  for (let i = 0; i < 32; i++) if ((await call({ action: 'read', token: 'psl_' + String(i).padStart(43, 'y') }, null)).status === 429) limited++;
  assert.ok(limited >= 1);
  assert.equal((await load(id)).state.name, 'Prepared');
  const audit = await call({ action: 'audit', eventId: id });
  assert.ok(audit.body.audit.length >= 4);
  assert.ok(audit.body.audit.some(a => a.action === 'revoke-link') && audit.body.audit.some(a => a.action === 'issue-link'));
  // Retrying the same request (double click / dropped connection) is applied once.
  row = await load(id);
  const retry = { action: 'add-speakers', eventId: id, version: row.version, requestKey: '0d6c1f6e-6a40-4c69-9d2e-3b1f6a2c7e11', input: { people: [{ name: 'Retried once' }] } };
  assert.equal((await call(retry)).status, 200);
  const second = await call(retry);
  assert.equal(second.status, 200); assert.equal(second.body.replayed, true);
  assert.equal((await load(id)).state.speakers.filter(p => p.name === 'Retried once').length, 1);
  const listed = await call({ action: 'list', tournamentId });
  assert.equal(listed.body.events[0].speakers, 2);
});
