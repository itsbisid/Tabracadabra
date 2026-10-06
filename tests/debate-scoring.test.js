// Configurable debate speaker scoring (single score or criteria). Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDebateScoring, debateScoringFor, speakerScore, describeDebateScoring, LEGACY_DEBATE_SCORING } from '../api-shared/debate-scoring.js';

test('tournaments without debate_scoring keep the 60–80 range (BP regression)', () => {
  const s = debateScoringFor({ tracks: 'Debate only', min_points: 50, max_points: 100 });
  assert.deepEqual(s, LEGACY_DEBATE_SCORING);
  assert.equal(speakerScore(s, { total: 75 }), 75);
  assert.throws(() => speakerScore(s, { total: 59 }), /between 60 and 80/);
  assert.throws(() => speakerScore(s, { total: 81 }), /between 60 and 80/);
  assert.throws(() => speakerScore(s, { total: 75.5 }), /increments of 1/);
});

test('single score per speaker follows the configured range and step', () => {
  const s = validateDebateScoring({ min: 50, max: 100, step: 0.5 });
  assert.equal(speakerScore(s, { total: 72.5 }), 72.5);
  assert.throws(() => speakerScore(s, { total: 72.25 }), /increments of 0.5/);
  assert.throws(() => speakerScore(s, { total: 101 }), /between 50 and 100/);
  assert.throws(() => validateDebateScoring({ min: 80, max: 60 }), /below the maximum/);
});

test('criteria: speaker score is the sum of criterion marks', () => {
  const s = validateDebateScoring({ step: 0.5, criteria: [{ name: 'Matter', max: 40 }, { name: 'Manner', max: 40 }, { name: 'Method', max: 20 }] });
  assert.equal(s.max, 100); assert.equal(s.min, 0);
  assert.equal(speakerScore(s, { marks: [30, 28.5, 15] }), 73.5);
  assert.equal(speakerScore(s, { marks: ['30', '28.5', '15'], total: 73.5 }), 73.5);
  assert.throws(() => speakerScore(s, { marks: [30, 28.5, 15], total: 80 }), /does not match/);
  assert.throws(() => speakerScore(s, { marks: [41, 28, 15] }), /Matter: enter 0 to 40/);
  assert.throws(() => speakerScore(s, { marks: [30, 28.25, 15] }), /increments of 0.5/);
  assert.throws(() => speakerScore(s, { marks: [30, 28] }), /every criterion/);
  assert.throws(() => speakerScore(s, { total: 73 }), /every criterion/);
  assert.match(describeDebateScoring(s), /Matter \/40 \+ Manner \/40 \+ Method \/20 = speaker score out of 100/);
});

test('any number of criteria (1–10), unique names, sensible minimum', () => {
  const one = validateDebateScoring({ criteria: [{ name: 'Overall', max: 100 }] });
  assert.equal(one.max, 100);
  const five = validateDebateScoring({ criteria: ['A', 'B', 'C', 'D', 'E'].map(name => ({ name, max: 20 })), min: 50 });
  assert.equal(five.max, 100); assert.throws(() => speakerScore(five, { marks: [5, 5, 5, 5, 5] }), /below the minimum of 50/);
  assert.throws(() => validateDebateScoring({ criteria: Array.from({ length: 11 }, (_, i) => ({ name: `C${i}`, max: 5 })) }), /at most 10/);
  assert.throws(() => validateDebateScoring({ criteria: [{ name: 'Matter', max: 50 }, { name: 'matter', max: 50 }] }), /unique/);
  assert.throws(() => validateDebateScoring({ criteria: [{ name: 'Matter', max: 50 }], min: 50 }), /minimum speaker score must be below/);
  assert.throws(() => validateDebateScoring({ step: 0.5, criteria: [{ name: 'Matter', max: 40.25 }] }), /multiple/);
});

test('server ballot validation uses the tournament scoring', async t => {
  process.env.VITE_SUPABASE_URL = 'https://bp-test.invalid';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const { default: handler } = await import('../api/portal-ballot.js');
  const utils = await import('../api-shared/portal-utils.js');
  const token = utils.createPortalToken({ role: 'judge', id: 'judge-1', tournamentId: 'tour-1' });
  const teams = ['og', 'oo', 'cg', 'co'];
  const pairing = { id: 'pair-1', tournament_id: 'tour-1', round_id: 'round-1', og_team_id: 'og', oo_team_id: 'oo', cg_team_id: 'cg', co_team_id: 'co' };
  let settings = { tracks: 'Debate only', debate_scoring: { step: 1, criteria: [{ name: 'Matter', max: 40 }, { name: 'Manner', max: 40 }, { name: 'Method', max: 20 }] } };
  let saved = null;
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    const u = new URL(url), reply = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (options.method === 'POST' && u.pathname.endsWith('/ballots')) { saved = JSON.parse(options.body); return reply(saved); }
    if (u.pathname.endsWith('/tournaments')) return reply([{ settings }]);
    if (u.pathname.endsWith('/draw_pairings')) return reply([pairing]);
    if (u.pathname.endsWith('/rounds')) return reply([{ id: 'round-1', status: 'Released' }]);
    if (u.pathname.endsWith('/ballots')) return reply([]);
    if (u.pathname.endsWith('/adjudicator_allocations')) return reply([{ adjudicator_id: 'judge-1', pairing_id: 'pair-1', role: 'CHAIR' }]);
    if (u.pathname.endsWith('/adjudicators')) return reply([{ id: 'judge-1', tournament_id: 'tour-1' }]);
    return reply([]);
  };
  t.after(() => { global.fetch = original; });
  const call = async ballots => { let out; await handler({ method: 'POST', headers: {}, on(ev, cb) { if (ev === 'data') cb(Buffer.from(JSON.stringify({ token, pairingId: 'pair-1', ballots }))); if (ev === 'end') cb(); } }, { statusCode: 200, setHeader() {}, end(raw) { out = { status: this.statusCode, body: JSON.parse(raw) }; } }); return out; };
  const marks = [[30, 30, 15], [28, 29, 14], [26, 27, 13], [25, 25, 12]];
  const ok = await call(teams.map((team_id, i) => ({ team_id, rank: i + 1, s1_marks: marks[i], s2_marks: marks[i] })));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(saved.find(r => r.team_id === 'og').s1_points, 75);
  assert.ok(!('s1_marks' in saved[0]), 'only totals are written to the ballots table');
  const bad = await call(teams.map((team_id, i) => ({ team_id, rank: i + 1, s1_marks: [45, 30, 15], s2_marks: marks[i] })));
  assert.ok(bad.status >= 400 && /Matter: enter 0 to 40/.test(bad.body.error), JSON.stringify(bad.body));
  settings = { tracks: 'Debate only' };
  const legacy = await call(teams.map((team_id, i) => ({ team_id, rank: i + 1, s1_points: 85, s2_points: 70 })));
  assert.ok(legacy.status >= 400 && /between 60 and 80/.test(legacy.body.error), 'legacy tournaments keep 60–80');
});
