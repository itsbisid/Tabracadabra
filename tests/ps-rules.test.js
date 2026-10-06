// Configurable PS rules, checked against hand calculations. All data is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRules, calculatePerformance, capacityPlan } from '../api-shared/ps-rules.js';
import { createEvent, mutateEvent, roundResults, standings, previewRules, planCapacity, EXAMPLE_PRESETS } from '../api-shared/ps-engine.js';

const admin = { role: 'admin', id: 'tab' };
const m = (s, action, input = {}, actor = admin) => mutateEvent(s, action, input, actor);

// Content 40% (out of 10, half marks), Delivery 35% (out of 20), Language 25% (out of 5, half marks).
const RUBRIC = [
  { id: 'content', name: 'Content', max: 10, weight: 40, step: 0.5 },
  { id: 'delivery', name: 'Delivery', max: 20, weight: 35 },
  { id: 'language', name: 'Language', max: 5, weight: 25, step: 0.5 }
];

test('weighted score normalises each criterion by its maximum (40/35/25)', () => {
  const rules = validateRules({ rubric: RUBRIC });
  // 7.5/10*40 = 30; 15/20*35 = 26.25; 4/5*25 = 20  ->  76.25
  const r = calculatePerformance(rules, { scores: [7.5, 15, 4] });
  assert.equal(r.total, 76.25);
  assert.deepEqual(r.breakdown.map(b => Number(b.contribution)), [30, 26.25, 20]);
  assert.equal(calculatePerformance(rules, { scores: [10, 20, 5] }).total, 100);
  assert.throws(() => calculatePerformance(rules, { scores: [7.3, 15, 4] }), /increments of 0.5/);
  assert.throws(() => calculatePerformance(rules, { scores: [11, 15, 4] }), /outside its range/);
  assert.throws(() => calculatePerformance(rules, { scores: [7.5, 15] }), /Every criterion/);
});

test('decimal arithmetic avoids floating point drift', () => {
  const rules = validateRules({ rubric: [{ name: 'A', max: 3, weight: 10 }, { name: 'B', max: 3, weight: 20 }, { name: 'C', max: 3, weight: 70 }] });
  // 1/3*10 + 1/3*20 + 1/3*70 = 33.3333...
  assert.equal(calculatePerformance(rules, { scores: [1, 1, 1] }).total, 33.3333);
});

test('timing penalties follow the configured rule and are capped', () => {
  const rules = validateRules({ rubric: RUBRIC, durationSeconds: 180, graceSeconds: 15, penalty: { method: 'overtime', pointsPerStep: 2, stepSeconds: 10, cap: 6 } });
  const row = { scores: [7.5, 15, 4] };
  assert.equal(calculatePerformance(rules, { ...row, elapsedSeconds: 195 }).total, 76.25, 'inside grace: no penalty');
  assert.equal(calculatePerformance(rules, { ...row, elapsedSeconds: 200 }).total, 74.25, '5s over -> 1 step -> 2 points');
  assert.equal(calculatePerformance(rules, { ...row, elapsedSeconds: 240 }).total, 70.25, '45s over -> 5 steps = 10, capped at 6');
  assert.throws(() => calculatePerformance(rules, row), /elapsed speech time/);
});

test('invalid rule combinations are rejected', () => {
  assert.throws(() => validateRules({ rubric: [{ name: 'A', max: 10, weight: 60 }, { name: 'B', max: 10, weight: 30 }] }), /total 100/);
  assert.throws(() => validateRules({ rubric: [{ name: 'A', max: 10, weight: 50 }, { name: 'a', max: 10, weight: 50 }] }), /unique/);
  assert.throws(() => validateRules({ rubric: [{ name: 'A', max: 10, weight: 100, step: 3 }] }), /increments/);
  assert.throws(() => validateRules({ minHeat: 5, maxHeat: 4 }), /Maximum speakers per heat/);
  assert.throws(() => validateRules({ panelSize: 0 }), /panel/);
  assert.throws(() => validateRules({ scoring: 'median' }), /supported/);
  for (const preset of Object.values(EXAMPLE_PRESETS)) assert.ok(validateRules({ rubric: preset }));
});

test('capacity planner: 60 speakers, 6 per heat, 8 rooms, 2 judges per heat', () => {
  const rules = validateRules({ maxHeat: 6, minHeat: 4, panelSize: 2 });
  const full = capacityPlan({ entrants: 60, rooms: 8, judges: 16, rules });
  assert.equal(full.heats, 10); assert.equal(full.concurrency, 8); assert.equal(full.waves, 2); assert.equal(full.feasible, true);
  // Not impossible just because there are fewer rooms than heats.
  const fewJudges = capacityPlan({ entrants: 60, rooms: 8, judges: 10, rules });
  assert.equal(fewJudges.concurrency, 5, 'only 5 full panels of 2 judges'); assert.equal(fewJudges.waves, 2);
  const standby = capacityPlan({ entrants: 60, rooms: 8, judges: 19, rules });
  assert.equal(standby.standbyJudges, 3);
  const tooSmall = capacityPlan({ entrants: 7, rooms: 8, judges: 4, rules });
  assert.equal(tooSmall.feasible, false); assert.match(tooSmall.problems[0], /minimum heat size/);
  const noJudges = capacityPlan({ entrants: 12, rooms: 8, judges: 1, rules });
  assert.equal(noJudges.feasible, false);
  const rank = capacityPlan({ entrants: 13, rooms: 8, judges: 8, rules: validateRules({ maxHeat: 6, minHeat: 4, scoring: 'rank' }) });
  assert.ok(rank.problems.some(p => /equal heat sizes/.test(p)));
});

test('setup preview gives a hand-checkable sample ballot', () => {
  const { sample } = previewRules({ rubric: RUBRIC });
  // 75% of each range, snapped to its increment: 7.5, 15, 3.5 -> 30 + 26.25 + 17.5
  assert.deepEqual(sample.scores, [7.5, 15, 3.5]);
  assert.equal(sample.result.total, 73.75);
});

function eventWith(rules, speakers, judges) {
  let s = createEvent({ name: 'Synthetic rules event', ...rules });
  s = m(s, 'add-speakers', { people: speakers.map((name, i) => ({ name, institution: `Inst ${i}` })) });
  s = m(s, 'add-judges', { people: judges.map(name => ({ name, institution: 'Judges Inst' })) });
  return s;
}
function runRound(s, rooms, ballotFor) {
  s = m(s, 'create-round', { name: `Round ${s.rounds.length + 1}`, speakerIds: rooms.flat() });
  const round = () => s.rounds.at(-1);
  s = m(s, 'save-draw', { roundId: round().id, rooms: rooms.map((speakers, i) => ({ name: `Room ${i + 1}`, speakers, judges: [s.judges[i % s.judges.length].id] })) });
  s = m(s, 'open-round', { roundId: round().id, reason: 'Synthetic test allocation' });
  for (const room of round().rooms) for (const judgeId of room.judges) {
    s = m(s, 'ballot', { roundId: round().id, roomId: room.id, status: 'submitted', rows: room.speakers.map((speakerId, i) => ballotFor(speakerId, i)) }, { role: 'judge', id: judgeId });
    s = m(s, 'approve-ballot', { roundId: round().id, ballotId: round().ballots.at(-1).id });
  }
  return m(s, 'complete-round', { roundId: round().id });
}

test('penalties recorded on ballots flow into round results and standings', () => {
  let s = eventWith({ rubric: RUBRIC, panelSize: 1, penalty: { method: 'overtime', pointsPerStep: 2, stepSeconds: 10, cap: 6 } }, ['A', 'B'], ['J']);
  const [a, b] = s.speakers.map(p => p.id);
  s = runRound(s, [[a, b]], (id, i) => ({ speakerId: id, rank: i + 1, scores: [7.5, 15, 4], elapsedSeconds: id === a ? 190 : 200 }));
  const results = roundResults(s, s.rounds[0]);
  assert.equal(results.find(r => r.speakerId === a).score, 76.25);
  assert.equal(results.find(r => r.speakerId === b).score, 74.25);
  assert.equal(results.find(r => r.speakerId === b).judges[0].penalty, 2);
  assert.equal(standings(s)[0].speakerId, a);
});

test('panel aggregation: mean versus sum is explicit', () => {
  for (const [aggregation, expected] of [['mean', 76.25], ['sum', 152.5]]) {
    let s = eventWith({ rubric: RUBRIC, aggregation, panelSize: 2 }, ['A', 'B'], ['J1', 'J2']);
    s = m(s, 'create-round', { name: 'R1', speakerIds: s.speakers.map(p => p.id) });
    s = m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'Room 1', speakers: s.speakers.map(p => p.id), judges: s.judges.map(p => p.id) }] });
    s = m(s, 'open-round', { roundId: s.rounds[0].id });
    for (const judge of s.judges) {
      s = m(s, 'ballot', { roundId: s.rounds[0].id, roomId: s.rounds[0].rooms[0].id, status: 'submitted', rows: s.speakers.map((p, i) => ({ speakerId: p.id, rank: i + 1, scores: [7.5, 15, 4] })) }, { role: 'judge', id: judge.id });
      s = m(s, 'approve-ballot', { roundId: s.rounds[0].id, ballotId: s.rounds[0].ballots.at(-1).id });
    }
    assert.equal(roundResults(s, s.rounds[0])[0].score, expected, aggregation);
  }
});

test('rank mode refuses unequal heats unless within-heat progression is configured', () => {
  let s = eventWith({ scoring: 'rank', panelSize: 1, minHeat: 2 }, ['A', 'B', 'C', 'D', 'E'], ['J1', 'J2']);
  const ids = s.speakers.map(p => p.id);
  s = m(s, 'create-round', { name: 'R1', speakerIds: ids });
  assert.throws(() => m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'Room 1', speakers: ids.slice(0, 3), judges: [s.judges[0].id] }, { name: 'Room 2', speakers: ids.slice(3), judges: [s.judges[1].id] }] }), /same number of speakers/);

  let w = eventWith({ scoring: 'rank', rankPolicy: 'within-heat', panelSize: 1, minHeat: 2 }, ['A', 'B', 'C', 'D', 'E'], ['J1', 'J2']);
  const wid = w.speakers.map(p => p.id);
  w = runRound(w, [wid.slice(0, 3), wid.slice(3)], (id, i) => ({ speakerId: id, rank: i + 1, scores: [30, 30, 15] }));
  const table = standings(w);
  // First in a heat of 3 and first in a heat of 2 both have position 0; last places both have position 1.
  assert.equal(table.find(r => r.name === 'A').rankTotal, 0);
  assert.equal(table.find(r => r.name === 'D').rankTotal, 0);
  assert.equal(table.find(r => r.name === 'B').rankTotal, 0.5);
  assert.equal(table.find(r => r.name === 'C').rankTotal, 1);
  assert.equal(table.find(r => r.name === 'E').rankTotal, 1);
});

test('heat size limits and panel size are enforced or flagged', () => {
  let s = eventWith({ maxHeat: 2, minHeat: 2, panelSize: 2 }, ['A', 'B', 'C'], ['J1', 'J2']);
  const ids = s.speakers.map(p => p.id);
  s = m(s, 'create-round', { name: 'R1', speakerIds: ids });
  assert.throws(() => m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'Room 1', speakers: ids, judges: [s.judges[0].id] }] }), /maximum per heat is 2/);
  s = m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'Room 1', speakers: ids.slice(0, 2), judges: [s.judges[0].id] }, { name: 'Room 2', speakers: ids.slice(2), judges: [s.judges[1].id] }] });
  assert.throws(() => m(s, 'open-round', { roundId: s.rounds[0].id }), /override reason/);
  const opened = m(s, 'open-round', { roundId: s.rounds[0].id, reason: 'Judge shortage; agreed by tab' });
  assert.equal(opened.rounds[0].allocationReason, 'Judge shortage; agreed by tab');
});

test('rules are versioned and frozen once rounds exist', () => {
  let s = eventWith({ panelSize: 1 }, ['A', 'B'], ['J']);
  assert.equal(s.ruleVersion, 1);
  s = m(s, 'settings', { name: s.name, type: s.type, rubric: RUBRIC });
  assert.equal(s.ruleVersion, 2);
  s = m(s, 'create-round', { name: 'R1', speakerIds: s.speakers.map(p => p.id) });
  assert.throws(() => m(s, 'settings', { name: s.name, rubric: RUBRIC }), /frozen/);
  assert.equal(planCapacity(s).entrants, 2);
});

test('structured feedback is stored and only released feedback reaches the speaker', async () => {
  const { projectEvent } = await import('../api-shared/ps-engine.js');
  let s = eventWith({ panelSize: 1 }, ['A', 'B'], ['J']);
  const [a, b] = s.speakers.map(p => p.id);
  s = runRound(s, [[a, b]], (id, i) => ({ speakerId: id, rank: i + 1, scores: [30, 30, 15], worked: `Worked ${i}`, improve: `Improve ${i}`, nextStep: `Next ${i}` }));
  const before = projectEvent(s, { role: 'speaker', id: a });
  assert.deepEqual(before.rounds[0].feedback, []);
  s = m(s, 'publish', { roundId: s.rounds[0].id, resultsPublished: true, feedbackPublished: true });
  const mine = projectEvent(s, { role: 'speaker', id: a }).rounds[0].feedback;
  assert.equal(mine.length, 1); assert.equal(mine[0].worked, 'Worked 0'); assert.equal(mine[0].nextStep, 'Next 0');
  assert.ok(!JSON.stringify(projectEvent(s, { role: 'speaker', id: a })).includes('Worked 1'), 'another speaker\'s feedback never leaks');
});
