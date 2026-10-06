import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/public-speaking.js';

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
  const records = new Map();
  const audits = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname.endsWith('/auth/v1/user')) return options.headers.Authorization === 'Bearer owner-token' ? reply(owner) : options.headers.Authorization === 'Bearer outsider-token' ? reply({ id: 'outsider' }) : reply({}, 401);
    if (u.pathname.endsWith('/tournaments')) return reply([{ owner_id: owner.id }]);
    if (u.pathname.endsWith('/tournament_memberships')) return reply([]);
    if (u.pathname.endsWith('/ps_events')) {
      if (u.searchParams.has('id')) return reply([...records.values()].filter(r => `eq.${r.id}` === u.searchParams.get('id')));
      return reply([...records.values()]);
    }
    if (u.pathname.endsWith('/ps_audit')) return reply(audits);
    if (u.pathname.endsWith('/rpc/ps_commit')) {
      assert.equal(options.headers.Authorization, 'Bearer service-test');
      const p = JSON.parse(options.body); const old = records.get(p.p_event_id);
      if (old && old.version !== p.p_version) return reply({ code: '40001', message: 'Conflict' }, 409);
      const row = { id: p.p_event_id, tournament_id: p.p_tournament_id, version: p.p_version + 1, state: p.p_state };
      records.set(row.id, row); audits.push({ action: p.p_action, version: row.version }); return reply(row);
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
  let row = records.get(id);
  assert.equal((await call({ action: 'read', eventId: id }, 'outsider-token')).status, 403);
  let result = await call({ action: 'add-speakers', eventId: id, version: row.version, input: { people: [{ name: 'Ama' }] } });
  assert.equal(result.status, 200);
  const stale = await call({ action: 'add-speakers', eventId: id, version: row.version, input: { people: [{ name: 'Must not persist' }] } });
  assert.equal(stale.status, 409);
  row = records.get(id);
  assert.equal(row.state.speakers.length, 1);
  result = await call({ action: 'portal-link', eventId: id, version: row.version, input: { role: 'speaker', personId: row.state.speakers[0].id } });
  const token = result.body.token;
  assert.ok(token);
  assert.equal((await call({ action: 'read', token }, null)).body.state.participant.name, 'Ama');
  assert.equal((await call({ action: 'settings', token, version: result.body.version, input: { name: 'Attack' } }, null)).status, 400);
  const publicView = await call({ action: 'public', eventId: id }, null);
  assert.equal(publicView.status, 200); assert.deepEqual(publicView.body.state.speakers, []);
  assert.ok(!JSON.stringify(publicView).includes('accessVersion'));
  result = await call({ action: 'check-in', token, version: result.body.version }, null);
  assert.equal(result.status, 200); assert.equal(result.body.state.participant.checkedIn, true);
  row = records.get(id);
  await call({ action: 'portal-link', eventId: id, version: row.version, input: { role: 'speaker', personId: row.state.speakers[0].id } });
  assert.equal((await call({ action: 'read', token }, null)).status, 403);
  assert.equal(records.get(id).state.name, 'Prepared');
  assert.ok(audits.length >= 4);
});
