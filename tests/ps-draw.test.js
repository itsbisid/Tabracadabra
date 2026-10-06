// Draw generator tests against published speech-tab practice. All names are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, mutateEvent, standings } from '../api-shared/ps-engine.js';
import { proposeDraw, sectionSizes } from '../api-shared/ps-draw.js';
import { validateRules } from '../api-shared/ps-rules.js';

const admin = { role: 'admin', id: 'tab' };
const m = (s, action, input = {}, actor = admin) => mutateEvent(s, action, input, actor);

function event({ speakers, schools, judges, judgeSchools = judges, rules = {} }) {
  let s = createEvent({ name: 'Synthetic draw test', minHeat: 4, maxHeat: 6, panelSize: 1, finalPanelSize: 3, ...rules });
  s = m(s, 'add-speakers', { people: Array.from({ length: speakers }, (_, i) => ({ name: `Speaker ${String(i + 1).padStart(2, '0')}`, institution: `School ${i % schools}` })) });
  s = m(s, 'add-judges', { people: Array.from({ length: judges }, (_, i) => ({ name: `Judge ${i + 1}`, institution: `Judge School ${i % judgeSchools}` })) });
  return s;
}
// Draws, saves and opens a round. Marks it completed directly when no results are needed.
function drawRound(s, { seed = 'seed', stage = 'preliminary', method, complete = true, speakerIds } = {}) {
  s = m(s, 'create-round', { name: `Round ${s.rounds.length + 1}`, stage, speakerIds: speakerIds || s.speakers.map(p => p.id) });
  const round = s.rounds.at(-1);
  const { rooms, report } = proposeDraw(s, round, { seed, method });
  s = m(s, 'save-draw', { roundId: round.id, rooms });
  s = m(s, 'open-round', { roundId: round.id, reason: 'Synthetic test' });
  if (complete) { s = structuredClone(s); s.rounds.at(-1).status = 'completed'; }
  return { s, report, rooms: s.rounds.at(-1).rooms };
}
const schoolOf = (s, id) => s.speakers.find(p => p.id === id).institution;
const sameSchoolPairs = (s, rooms) => rooms.reduce((n, r) => n + r.speakers.reduce((k, a, i) => k + r.speakers.slice(i + 1).filter(b => schoolOf(s, a) === schoolOf(s, b)).length, 0), 0);

test('section sizes are as even as possible and respect min/max', () => {
  const rules = validateRules({ minHeat: 4, maxHeat: 6 });
  assert.deepEqual(sectionSizes(60, rules), Array(10).fill(6));
  assert.deepEqual(sectionSizes(25, rules), [5, 5, 5, 5, 5]);
  assert.deepEqual(sectionSizes(13, rules), [5, 4, 4]);
  assert.deepEqual(sectionSizes(13, rules, 3), [5, 4, 4]);
  assert.throws(() => sectionSizes(13, rules, 4), /minimum is 4/);
  assert.throws(() => sectionSizes(13, rules, 2), /maximum is 6/);
});

test('60 speakers from 10 schools: 10 sections of 6 with no same-school pairs', () => {
  const { s, rooms, report } = drawRound(event({ speakers: 60, schools: 10, judges: 10 }));
  assert.equal(rooms.length, 10);
  assert.ok(rooms.every(r => r.speakers.length === 6));
  assert.equal(sameSchoolPairs(s, rooms), 0);
  assert.deepEqual(report.sameInstitution, []);
  assert.equal(new Set(rooms.flatMap(r => r.speakers)).size, 60, 'every speaker exactly once');
});

test('the same seed reproduces the same draw', () => {
  const base = event({ speakers: 30, schools: 6, judges: 6 });
  const withRound = m(base, 'create-round', { name: 'R1', speakerIds: base.speakers.map(p => p.id) });
  const a = proposeDraw(withRound, withRound.rounds[0], { seed: 'gudc-2026' });
  const b = proposeDraw(withRound, withRound.rounds[0], { seed: 'gudc-2026' });
  const c = proposeDraw(withRound, withRound.rounds[0], { seed: 'another-seed' });
  assert.deepEqual(a.rooms, b.rooms);
  assert.notDeepEqual(a.rooms, c.rooms);
  assert.equal(a.report.seed, 'gudc-2026');
});

test('three prelims: schools apart and repeat meetings at the proven minimum', () => {
  let s = event({ speakers: 24, schools: 6, judges: 8 });
  const meetings = new Map();
  const repeatsPerRound = [];
  for (let r = 0; r < 3; r++) {
    let rooms; ({ s, rooms } = drawRound(s, { seed: `prelim-${r}` }));
    let repeats = 0;
    for (const room of rooms) room.speakers.forEach((a, i) => room.speakers.slice(i + 1).forEach(b => {
      const k = [a, b].sort().join('|'); if (meetings.get(k)) repeats++; meetings.set(k, (meetings.get(k) || 0) + 1);
    }));
    assert.equal(sameSchoolPairs(s, rooms), 0, `round ${r + 1} keeps schools apart`);
    repeatsPerRound.push(repeats);
  }
  // Each round-2 section of 6 needs one speaker per school, drawn from only 4 round-1 sections,
  // so at least 2 pairs per section must meet again: 8 repeats is the mathematical minimum.
  assert.equal(repeatsPerRound[0], 0); assert.equal(repeatsPerRound[1], 8, `round 2 repeats: ${repeatsPerRound[1]}`);
  assert.ok(repeatsPerRound[2] <= 16, `round 3 repeats: ${repeatsPerRound[2]}`);
});

test('speaking order: everyone speaks early and late across three prelims, and averages even out', () => {
  let s = event({ speakers: 24, schools: 6, judges: 8 });
  const positions = new Map(s.speakers.map(p => [p.id, []]));
  for (let r = 0; r < 3; r++) {
    let rooms; ({ s, rooms } = drawRound(s, { seed: `order-${r}` }));
    for (const room of rooms) room.speakers.forEach((id, i) => positions.get(id).push({ i, n: room.speakers.length }));
  }
  let early = 0, late = 0; const means = [];
  for (const list of positions.values()) {
    if (list.some(p => p.i <= 1)) early++;
    if (list.some(p => p.i >= p.n - 2)) late++;
    means.push(list.reduce((t, p) => t + p.i / (p.n - 1), 0) / list.length);
  }
  assert.ok(early >= 23, `${early}/24 had an early slot`);
  assert.ok(late >= 23, `${late}/24 had a late slot`);
  assert.ok(Math.max(...means) - Math.min(...means) <= 0.6, 'average positions are close');
});

test('judges: never their own school, no repeats while avoidable, load spread evenly', () => {
  // Judges come from two of the speakers' schools, so placing them takes care.
  // 18 judges for 8 seats per round. Two are from School 0 and must stay on standby (every section
  // has a School 0 speaker); the other 16 are enough for two rounds without anyone judging a speaker twice.
  let s = event({ speakers: 24, schools: 6, judges: 18, rules: { panelSize: 2 } });
  s = structuredClone(s);
  s.judges.forEach((j, i) => { j.institution = i < 2 ? 'School 0' : `Independent ${i}`; });
  const seen = new Set(); let repeats = 0; const load = new Map();
  for (let r = 0; r < 2; r++) {
    let rooms, report; ({ s, rooms, report } = drawRound(s, { seed: `judges-${r}` }));
    assert.deepEqual(report.judgeIssues.filter(x => /institution/.test(x)), []);
    for (const room of rooms) {
      assert.equal(room.judges.length, 2);
      for (const j of room.judges) {
        load.set(j, (load.get(j) || 0) + 1);
        assert.ok(room.speakers.every(id => !(s.judges.find(x => x.id === j).institution === schoolOf(s, id))), 'no own-school judging');
        for (const id of room.speakers) { if (seen.has(`${j}|${id}`)) repeats++; seen.add(`${j}|${id}`); }
      }
    }
  }
  assert.equal(repeats, 0);
  // With only the minimum number of judges, repeats become unavoidable and are reported instead.
  let tight = event({ speakers: 24, schools: 6, judges: 8, rules: { panelSize: 2 } });
  ({ s: tight } = drawRound(tight, { seed: 't1' }));
  const second = drawRound(tight, { seed: 't2' });
  assert.ok(second.report.judgeIssues.some(x => /has judged .* before/.test(x)));
  assert.ok(Math.max(...load.values()) - Math.min(...load.values()) <= 1);
  assert.ok(!s.judges.slice(0, 2).some(j => load.has(j.id)), 'conflicted judges stay on standby');
});

test('judge shortages are reported, not hidden', () => {
  const base = event({ speakers: 24, schools: 6, judges: 3 });
  const s = m(base, 'create-round', { name: 'R1', speakerIds: base.speakers.map(p => p.id) });
  const { report, rooms } = proposeDraw(s, s.rounds[0], { seed: 'short' });
  assert.equal(rooms.filter(r => r.judges.length === 0).length, 1);
  assert.ok(report.judgeIssues.some(x => /0 of 1 judges/.test(x)));
  assert.ok(report.notes.some(x => /waves or add judges/.test(x)));
});

function completeWithRanks(s, rankOf) {
  const round = s.rounds.at(-1);
  for (const room of round.rooms) for (const judgeId of room.judges) {
    const rows = [...room.speakers].sort((a, b) => rankOf(a) - rankOf(b)).map((speakerId, i) => ({ speakerId, rank: i + 1, scores: [40 - i * 2, 40 - i * 2, 20 - i] }));
    s = m(s, 'ballot', { roundId: round.id, roomId: room.id, status: 'submitted', rows }, { role: 'judge', id: judgeId });
    s = m(s, 'approve-ballot', { roundId: round.id, ballotId: s.rounds.at(-1).ballots.at(-1).id });
  }
  return m(s, 'complete-round', { roundId: round.id });
}

test('elimination rounds are snaked by standings, with reverse speaking order', () => {
  let s = event({ speakers: 12, schools: 12, judges: 8, rules: { finalPanelSize: 1 } });
  // One prelim in a single section, so standings follow a known order: Speaker 01 best.
  s = m(s, 'create-round', { name: 'Prelim', speakerIds: s.speakers.map(p => p.id) });
  const order = [...s.speakers.map(p => p.id)];
  const halves = [order.slice(0, 6), order.slice(6)];
  s = m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'A', speakers: halves[0], judges: [s.judges[0].id] }, { name: 'B', speakers: halves[1], judges: [s.judges[1].id] }] });
  s = m(s, 'open-round', { roundId: s.rounds[0].id, reason: 'test' });
  const rank = id => order.indexOf(id);
  s = completeWithRanks(s, rank);
  const table = standings(s);
  const bySeed = table.map(r => r.speakerId);
  s = m(s, 'create-round', { name: 'Semis', stage: 'semifinal', speakerIds: bySeed });
  const { rooms, report } = proposeDraw(s, s.rounds.at(-1), { seed: 'semis', sections: 2 });
  assert.equal(report.method, 'snake');
  const seedOf = id => report.seeds[id];
  const sectionSeeds = rooms.map(r => r.speakers.map(seedOf).sort((a, b) => a - b));
  // Serpentine with tied seeds allowed to swap; seed 1 and seed 2 are never together.
  assert.ok(sectionSeeds.some(x => x.includes(1)) && !sectionSeeds.find(x => x.includes(1)).includes(2));
  for (const room of rooms) assert.equal(room.speakers.length, 6);
  // Reverse speaking order: whoever spoke later in the prelim speaks earlier now.
  const prelimPos = new Map(s.rounds[0].rooms.flatMap(r => r.speakers.map((id, i) => [id, i + 1])));
  for (const room of rooms) for (let i = 1; i < room.speakers.length; i++) assert.ok(prelimPos.get(room.speakers[i - 1]) >= prelimPos.get(room.speakers[i]));
});

test('snake keeps seeds and only swaps identical standings to separate schools', () => {
  let s = event({ speakers: 8, schools: 8, judges: 4, rules: { minHeat: 4, maxHeat: 4, finalPanelSize: 1 } });
  s = m(s, 'create-round', { name: 'Final', stage: 'final', speakerIds: s.speakers.map(p => p.id) });
  // No standings yet: everyone is "unranked" (identical), so school separation may reorder freely.
  const { rooms } = proposeDraw(s, s.rounds[0], { seed: 'x', sections: 2 });
  assert.equal(rooms.length, 2);
  assert.equal(sameSchoolPairs(s, rooms), 0);
});
