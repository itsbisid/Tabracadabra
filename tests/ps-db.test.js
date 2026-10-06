// Database tests for the normalised PS storage (supabase/ps-v2.sql), run in PGlite.
// Every engine mutation is committed and re-loaded, and the reloaded state must match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEvent, mutateEvent, standings } from '../api-shared/ps-engine.js';
import { createPSDatabase, v2Commit, v2Load } from './helpers/ps-db.js';

const admin = { role: 'admin', id: 'tab' };

// The parts of state that must survive storage exactly.
function canonical(s) {
  const person = p => ({ id: p.id, name: p.name, institution: p.institution, category: p.category, active: p.active, checkedIn: p.checkedIn, accessVersion: p.accessVersion });
  return {
    name: s.name, type: s.type, rubric: s.rubric, scoring: s.scoring, durationSeconds: s.durationSeconds,
    speakers: s.speakers.map(person), judges: s.judges.map(person),
    rounds: s.rounds.map(r => ({
      id: r.id, name: r.name, stage: r.stage, status: r.status, drawPublished: r.drawPublished,
      resultsPublished: r.resultsPublished, feedbackPublished: r.feedbackPublished, speakerIds: [...r.speakerIds].sort(),
      breakReason: r.breakReason || '', allocationReason: r.allocationReason || '',
      rooms: r.rooms.map(room => ({ id: room.id, name: room.name, speakers: room.speakers, judges: [...room.judges].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
      ballots: r.ballots.map(b => ({ id: b.id, roomId: b.roomId, judgeId: b.judgeId, status: b.status,
        rows: b.rows.map(x => ({ speakerId: x.speakerId, rank: Number(x.rank), scores: x.scores.map(Number), feedback: x.feedback || '' })).sort((a, c) => a.speakerId.localeCompare(c.speakerId)) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      judgeFeedback: r.judgeFeedback.map(f => ({ fromRole: f.fromRole, fromId: f.fromId, toId: f.toId, roomId: f.roomId, rating: f.rating, comment: f.comment }))
        .sort((a, b) => (a.fromId + a.toId).localeCompare(b.fromId + b.toId))
    }))
  };
}

async function harness() {
  const { db, tournamentId } = await createPSDatabase();
  const eventId = randomUUID();
  let row = null;
  async function step(action, input = {}, actor = admin, initial) {
    const before = initial || row.state;
    const next = initial || mutateEvent(before, action, input, actor);
    row = await v2Commit(db, { eventId, tournamentId, version: row?.version ?? 0, state: next, action, actor: `${actor.role}:${actor.id}` });
    assert.deepEqual(canonical(row.state), canonical(next), `state changed in storage after "${action}"`);
    return row.state;
  }
  return { db, tournamentId, eventId, step, get row() { return row; } };
}

test('v2 storage round-trips a full tournament, one mutation at a time', async () => {
  const h = await harness();
  let s = await h.step('create', {}, admin, createEvent({ name: 'Synthetic prepared speech', rubric: [{ name: 'Content', max: 40, weight: 40 }, { name: 'Delivery', max: 35, weight: 35 }, { name: 'Language', max: 25, weight: 25 }] }));
  s = await h.step('add-speakers', { people: [{ name: 'Test Speaker A', institution: 'Inst 1', category: 'Novice' }, { name: 'Test Speaker B', institution: 'Inst 2' }, { name: 'Test Speaker C', institution: 'Inst 3' }] });
  s = await h.step('add-judges', { people: [{ name: 'Test Judge 1', institution: 'Inst 9' }, { name: 'Test Judge 2', institution: 'Inst 8' }] });
  assert.deepEqual(s.speakers.map(p => p.name), ['Test Speaker A', 'Test Speaker B', 'Test Speaker C'], 'registration order is preserved');
  s = await h.step('portal-link', { role: 'speaker', personId: s.speakers[0].id });
  assert.equal(s.speakers[0].accessVersion, 1);
  s = await h.step('create-round', { name: 'Round 1', speakerIds: s.speakers.map(p => p.id) });
  const roundId = s.rounds[0].id;
  s = await h.step('save-draw', { roundId, rooms: [{ name: 'Room 1', speakers: s.speakers.map(p => p.id), judges: s.judges.map(p => p.id) }] });
  // Redrawing a draft round replaces its heats cleanly.
  s = await h.step('save-draw', { roundId, rooms: [{ name: 'Room A', speakers: [...s.speakers.map(p => p.id)].reverse(), judges: s.judges.map(p => p.id) }] });
  assert.equal(s.rounds[0].rooms.length, 1);
  s = await h.step('open-round', { roundId });
  const room = s.rounds[0].rooms[0];
  for (const [j, judge] of s.judges.entries()) {
    const rows = room.speakers.map((speakerId, i) => ({ speakerId, rank: i + 1, scores: [36 - i * 4 - j, 30 - i * 3, 20 - i], feedback: `Synthetic feedback ${i}` }));
    s = await h.step('ballot', { roundId, roomId: room.id, status: 'draft', rows }, { role: 'judge', id: judge.id });
    s = await h.step('ballot', { roundId, roomId: room.id, status: 'submitted', rows }, { role: 'judge', id: judge.id });
    const ballot = s.rounds[0].ballots.find(b => b.judgeId === judge.id);
    s = await h.step('approve-ballot', { roundId, ballotId: ballot.id });
  }
  s = await h.step('judge-feedback', { roundId, roomId: room.id, judgeId: s.judges[1].id, rating: 4, comment: 'Clear reasons' }, { role: 'speaker', id: room.speakers[0] });
  s = await h.step('complete-round', { roundId });
  s = await h.step('publish', { roundId, resultsPublished: true, feedbackPublished: false });
  const table = standings(s);
  assert.equal(table.length, 3);
  assert.equal(table[0].speakerId, room.speakers[0]);
  s = await h.step('create-break', { name: 'Final', breakSize: 2 });
  assert.equal(s.rounds[1].stage, 'final');
  assert.equal(h.row.version, 18);

  // Ballot history is kept as revisions, and every commit is audited.
  const revisions = await h.db.query('select count(*)::int as n from ps_ballot_revisions where event_id=$1', [h.eventId]);
  assert.ok(revisions.rows[0].n >= 4);
  const audits = await h.db.query('select count(*)::int as n from ps_audit_events where event_id=$1', [h.eventId]);
  assert.equal(audits.rows[0].n, 18);
});

test('stale versions are rejected and request keys make retries idempotent', async () => {
  const h = await harness();
  let s = await h.step('create', {}, admin, createEvent({ name: 'Synthetic retry test' }));
  const next = mutateEvent(s, 'add-speakers', { people: [{ name: 'Test Speaker' }] }, admin);
  const requestKey = randomUUID();
  const first = await v2Commit(h.db, { eventId: h.eventId, tournamentId: h.tournamentId, version: 1, state: next, requestKey, payloadHash: 'abc' });
  // Same request replayed (double click / network retry): no second write, same result.
  const replay = await v2Commit(h.db, { eventId: h.eventId, tournamentId: h.tournamentId, version: 1, state: next, requestKey, payloadHash: 'abc' });
  assert.equal(replay.version, first.version);
  assert.equal(replay.state.speakers.length, 1);
  await assert.rejects(v2Commit(h.db, { eventId: h.eventId, tournamentId: h.tournamentId, version: 1, state: next, requestKey, payloadHash: 'different' }), /different request/);
  // A different request from an out-of-date version is refused.
  await assert.rejects(v2Commit(h.db, { eventId: h.eventId, tournamentId: h.tournamentId, version: 1, state: next }), /changed/);
});

test('events are scoped to their tournament and browser roles cannot read PS tables', async () => {
  const h = await harness();
  await h.step('create', {}, admin, createEvent({ name: 'Synthetic scope test' }));
  const otherTournament = randomUUID();
  await h.db.query('insert into tournaments(id) values($1)', [otherTournament]);
  await assert.rejects(v2Commit(h.db, { eventId: h.eventId, tournamentId: otherTournament, version: 1, state: h.row.state }), /does not belong/);
  const { rows } = await h.db.query(`select count(*)::int as n from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_name like 'ps\\_%'`);
  assert.equal(rows[0].n, 0);
});

test('deleting a tournament removes its v2 PS data', async () => {
  const h = await harness();
  await h.step('create', {}, admin, createEvent({ name: 'Synthetic delete test' }));
  await h.db.query('delete from tournaments where id=$1', [h.tournamentId]);
  const { rows } = await h.db.query('select count(*)::int as n from ps_competitions');
  assert.equal(rows[0].n, 0);
});

test('existing v1 events migrate into v2 without loss', async () => {
  const { db, tournamentId } = await createPSDatabase();
  let s = createEvent({ name: 'Synthetic legacy event' });
  s = mutateEvent(s, 'add-speakers', { people: [{ name: 'Legacy A' }, { name: 'Legacy B' }] }, admin);
  s = mutateEvent(s, 'add-judges', { people: [{ name: 'Legacy Judge' }] }, admin);
  s = mutateEvent(s, 'create-round', { name: 'R1', speakerIds: s.speakers.map(p => p.id) }, admin);
  const id = randomUUID();
  await db.query('select public.ps_commit($1,$2,0,$3::jsonb,$4,$5)', [id, tournamentId, JSON.stringify(s), 'admin:tab', 'create']);
  const { rows } = await db.query('select public.ps_migrate_v1_to_v2() as n');
  assert.equal(rows[0].n, 1);
  const loaded = await v2Load(db, id);
  assert.deepEqual(canonical(loaded.state), canonical(s));
  const again = await db.query('select public.ps_migrate_v1_to_v2() as n');
  assert.equal(again.rows[0].n, 0, 'migration is safe to rerun');
});
