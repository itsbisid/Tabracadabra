// GUDC 2026 public speaking rules ("we rank, we do not score"), from the speakers' and judges'
// briefing: 1st = 10, 2nd = 9 … anchored at the top; no ties; absent speakers not ranked; room
// result = panel total; standings = points summed over rounds, mean across the panel; tie-breaks:
// judge firsts, head to head, band profile, total minus weakest round, chair's ballot. Synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEvent, mutateEvent, roundResults, standings, projectEvent } from '../api-shared/ps-engine.js';
import { validateRules, GUDC_GUIDANCE } from '../api-shared/ps-rules.js';
import { createPSDatabase, v2Commit } from './helpers/ps-db.js';

const admin = { role: 'admin', id: 'tab' };
const m = (s, a, i = {}, actor = admin) => mutateEvent(s, a, i, actor);
const GUDC = { scoring: 'points', pointsTop: 10, rubric: GUDC_GUIDANCE.prepared, minHeat: 2, maxHeat: 10, panelSize: 1, finalPanelSize: 3 };

function event(speakers, judges, rules = {}) {
  let s = createEvent({ name: 'Synthetic GUDC-style event', ...GUDC, ...rules });
  s = m(s, 'add-speakers', { people: speakers.map(name => ({ name, institution: `${name} Uni` })) });
  s = m(s, 'add-judges', { people: judges.map(name => ({ name, institution: `${name} Pool` })) });
  return s;
}
const id = (s, name) => (s.speakers.find(p => p.name === name) || s.judges.find(p => p.name === name)).id;
// rooms: [{ speakers: ['A','B'], judges: ['J1'], ranks: { J1: { A: 1, B: 2 } } }]; rank 'absent' marks an absent speaker.
function round(s, rooms, { complete = true } = {}) {
  s = m(s, 'create-round', { name: `Round ${s.rounds.length + 1}`, format: 'Prepared speeches', timeSeconds: 180, speakerIds: rooms.flatMap(r => r.speakers.map(n => id(s, n))) });
  const r = () => s.rounds.at(-1);
  s = m(s, 'save-draw', { roundId: r().id, rooms: rooms.map((room, i) => ({ name: `Room ${i + 1}`, speakers: room.speakers.map(n => id(s, n)), judges: room.judges.map(n => id(s, n)) })) });
  s = m(s, 'open-round', { roundId: r().id, reason: 'Synthetic test' });
  for (const [ri, room] of rooms.entries()) for (const judge of room.judges) {
    const rows = room.speakers.map(n => room.ranks[judge][n] === 'absent' ? { speakerId: id(s, n), absent: true } : { speakerId: id(s, n), rank: room.ranks[judge][n] });
    s = m(s, 'ballot', { roundId: r().id, roomId: r().rooms[ri].id, status: 'submitted', rows }, { role: 'judge', id: id(s, judge) });
    s = m(s, 'approve-ballot', { roundId: r().id, ballotId: r().ballots.at(-1).id });
  }
  return complete ? m(s, 'complete-round', { roundId: r().id }) : s;
}
const row = (table, name) => table.find(r => r.name === name);

test('rules: ranks only, criteria are guidance, no penalties, default tie-break order', () => {
  const r = validateRules(GUDC);
  assert.equal(r.scoring, 'points'); assert.equal(r.pointsTop, 10);
  assert.deepEqual(r.tieBreaks, ['judgeFirsts', 'headToHead', 'bandProfile', 'totalMinusWeakest', 'chairBallot']);
  assert.deepEqual(r.rubric.map(c => c.name), ['Response to topic', 'Content and argument', 'Structure', 'Delivery']);
  assert.ok(!('weight' in r.rubric[0]), 'criteria carry no weights or marks');
  assert.equal(r.penalty.method, 'none');
  assert.throws(() => validateRules({ ...GUDC, tieBreaks: ['coinToss'] }), /supported list/);
});

test('points scale anchored at the top: 1st = 10 … in a room of 6 the last gets 5', () => {
  let s = event(['A', 'B', 'C', 'D', 'E', 'F'], ['J1']);
  s = round(s, [{ speakers: ['A', 'B', 'C', 'D', 'E', 'F'], judges: ['J1'], ranks: { J1: { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 } } }]);
  const res = roundResults(s, s.rounds[0]);
  assert.deepEqual(['A', 'B', 'C', 'D', 'E', 'F'].map(n => res.find(r => r.speakerId === id(s, n)).score), [10, 9, 8, 7, 6, 5]);
});

test('panel: room result is the panel total, standings use the panel mean', () => {
  let s = event(['A', 'B', 'C'], ['J1', 'J2', 'J3'], { panelSize: 3 });
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['J1', 'J2', 'J3'], ranks: { J1: { A: 1, B: 2, C: 3 }, J2: { A: 1, B: 3, C: 2 }, J3: { A: 2, B: 1, C: 3 } } }]);
  const a = roundResults(s, s.rounds[0]).find(r => r.speakerId === id(s, 'A'));
  assert.equal(a.panelTotal, 29); // 10 + 10 + 9
  assert.equal(a.score, 9.6667);  // 29 / 3
  assert.equal(a.firsts, 2);
  assert.equal(row(standings(s), 'A').place, 1);
});

test('points summed over rounds; one weak round does not end a tournament', () => {
  let s = event(['A', 'B', 'C', 'D'], ['J1', 'J2']);
  s = round(s, [{ speakers: ['A', 'B'], judges: ['J1'], ranks: { J1: { A: 1, B: 2 } } }, { speakers: ['C', 'D'], judges: ['J2'], ranks: { J2: { C: 1, D: 2 } } }]);
  s = round(s, [{ speakers: ['A', 'C'], judges: ['J1'], ranks: { J1: { C: 1, A: 2 } } }, { speakers: ['B', 'D'], judges: ['J2'], ranks: { J2: { B: 1, D: 2 } } }]);
  const t = standings(s);
  assert.equal(row(t, 'A').score, 19); assert.equal(row(t, 'C').score, 20); assert.equal(row(t, 'B').score, 19); assert.equal(row(t, 'D').score, 18);
  assert.equal(t[0].name, 'C');
});

test('ballots: no scores, no ties, absent speakers are not ranked', () => {
  let s = event(['A', 'B', 'C'], ['J1']);
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['J1'], ranks: { J1: { A: 1, B: 2, C: 3 } } }], { complete: false });
  const r = s.rounds.at(-1), roomId = r.rooms[0].id, judge = { role: 'judge', id: id(s, 'J1') };
  s = m(s, 'reopen-ballot', { roundId: r.id, ballotId: r.ballots[0].id, reason: 'test' });
  const base = { roundId: r.id, roomId, status: 'submitted' };
  assert.throws(() => m(s, 'ballot', { ...base, rows: [{ speakerId: id(s, 'A'), rank: 1, scores: [70] }, { speakerId: id(s, 'B'), rank: 2 }, { speakerId: id(s, 'C'), rank: 3 }] }, judge), /ranks only/);
  assert.throws(() => m(s, 'ballot', { ...base, rows: [{ speakerId: id(s, 'A'), rank: 1 }, { speakerId: id(s, 'B'), rank: 1 }, { speakerId: id(s, 'C'), rank: 3 }] }, judge), /No ties/);
  assert.throws(() => m(s, 'ballot', { ...base, rows: [{ speakerId: id(s, 'A'), rank: 1 }, { speakerId: id(s, 'B'), absent: true }, { speakerId: id(s, 'C'), rank: 3 }] }, judge), /from 1 to 2/);
  s = m(s, 'ballot', { ...base, rows: [{ speakerId: id(s, 'A'), rank: 2 }, { speakerId: id(s, 'B'), absent: true }, { speakerId: id(s, 'C'), rank: 1 }] }, judge);
  s = m(s, 'approve-ballot', { roundId: r.id, ballotId: s.rounds.at(-1).ballots[0].id });
  s = m(s, 'complete-round', { roundId: r.id });
  const res = roundResults(s, s.rounds.at(-1));
  assert.equal(res.find(x => x.speakerId === id(s, 'B')).absent, true);
  assert.equal(res.find(x => x.speakerId === id(s, 'B')).score, 0);
  assert.equal(res.find(x => x.speakerId === id(s, 'C')).score, 10);
});

test('unequal room sizes are allowed (anchored at the top)', () => {
  let s = event(['A', 'B', 'C', 'D', 'E'], ['J1', 'J2']);
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['J1'], ranks: { J1: { A: 1, B: 2, C: 3 } } }, { speakers: ['D', 'E'], judges: ['J2'], ranks: { J2: { D: 1, E: 2 } } }]);
  assert.equal(row(standings(s), 'A').score, 10); assert.equal(row(standings(s), 'D').score, 10);
});

test('tie-break 1: judge firsts (A 10+10+8 vs B 9+9+10, both 28/3)', () => {
  let s = event(['A', 'B', 'P', 'Q', 'R', 'S'], ['J1', 'J2', 'J3', 'K1', 'K2', 'K3'], { panelSize: 3 });
  s = round(s, [
    { speakers: ['A', 'P', 'Q'], judges: ['J1', 'J2', 'J3'], ranks: { J1: { A: 1, P: 2, Q: 3 }, J2: { A: 1, P: 2, Q: 3 }, J3: { P: 1, Q: 2, A: 3 } } },
    { speakers: ['B', 'R', 'S'], judges: ['K1', 'K2', 'K3'], ranks: { K1: { R: 1, B: 2, S: 3 }, K2: { R: 1, B: 2, S: 3 }, K3: { B: 1, R: 2, S: 3 } } }
  ]);
  const t = standings(s), a = row(t, 'A'), b = row(t, 'B');
  assert.equal(a.score, b.score);
  assert.ok(a.place < b.place); assert.equal(a.judgeFirsts, 2); assert.equal(b.judgeFirsts, 1);
  assert.equal(b.tieBreak, 'Judge firsts');
});

test('tie-break 2: head to head (A beat B when they met)', () => {
  let s = event(['A', 'B', 'D', 'E', 'F', 'G'], ['J1', 'J2']);
  s = round(s, [{ speakers: ['D', 'A', 'B'], judges: ['J1'], ranks: { J1: { D: 1, A: 2, B: 3 } } }, { speakers: ['E', 'G', 'F'], judges: ['J2'], ranks: { J2: { E: 1, G: 2, F: 3 } } }]);
  s = round(s, [{ speakers: ['E', 'B'], judges: ['J1'], ranks: { J1: { E: 1, B: 2 } } }, { speakers: ['F', 'G', 'A'], judges: ['J2'], ranks: { J2: { F: 1, G: 2, A: 3 } } }]);
  const t = standings(s), a = row(t, 'A'), b = row(t, 'B');
  assert.equal(a.score, 17); assert.equal(b.score, 17); assert.equal(a.judgeFirsts, 0); assert.equal(b.judgeFirsts, 0);
  assert.ok(a.place < b.place); assert.equal(b.tieBreak, 'Head to head');
});

test('tie-break 3: band profile (A 2nd+4th vs B 3rd+3rd, both 16/2)', () => {
  let s = event(['A', 'B', 'P', 'Q', 'R', 'S', 'T', 'U'], ['J1', 'J2', 'K1', 'K2'], { panelSize: 2 });
  s = round(s, [
    { speakers: ['A', 'P', 'Q', 'R'], judges: ['J1', 'J2'], ranks: { J1: { P: 1, A: 2, Q: 3, R: 4 }, J2: { P: 1, Q: 2, R: 3, A: 4 } } },
    { speakers: ['B', 'S', 'T', 'U'], judges: ['K1', 'K2'], ranks: { K1: { S: 1, T: 2, B: 3, U: 4 }, K2: { S: 1, T: 2, B: 3, U: 4 } } }
  ]);
  const t = standings(s), a = row(t, 'A'), b = row(t, 'B');
  assert.equal(a.score, 8); assert.equal(b.score, 8);
  assert.ok(a.place < b.place); assert.equal(b.tieBreak, 'Band profile');
});

test("tie-break 5: chair's ballot when everything else is equal", () => {
  let s = event(['A', 'B', 'C'], ['Chair', 'Panellist'], { panelSize: 2 });
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['Chair', 'Panellist'], ranks: { Chair: { A: 1, B: 2, C: 3 }, Panellist: { B: 1, A: 2, C: 3 } } }]);
  const t = standings(s), a = row(t, 'A'), b = row(t, 'B');
  assert.equal(a.score, 9.5); assert.equal(b.score, 9.5);
  assert.ok(a.place < b.place); assert.equal(b.tieBreak, "Chair's ballot");
});

test('breaks: tie-breaks decide the cutoff; only a true tie needs a recorded decision', () => {
  let s = event(['A', 'B', 'C'], ['Chair', 'Panellist'], { panelSize: 2, finalPanelSize: 2 });
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['Chair', 'Panellist'], ranks: { Chair: { A: 1, B: 2, C: 3 }, Panellist: { B: 1, A: 2, C: 3 } } }]);
  const final = m(s, 'create-break', { name: 'Final', breakSize: 1 });
  assert.deepEqual(final.rounds.at(-1).speakerIds, [id(s, 'A')], "chair's ballot separates A and B, so no manual decision");
  let t = event(['A', 'B'], ['J1', 'J2']);
  t = round(t, [{ speakers: ['A'], judges: ['J1'], ranks: { J1: { A: 1 } } }, { speakers: ['B'], judges: ['J2'], ranks: { J2: { B: 1 } } }]);
  assert.throws(() => m(t, 'create-break', { name: 'Final', breakSize: 1 }), /cutoff is tied/);
  const decided = m(t, 'create-break', { name: 'Final', breakSize: 1, tieSelections: [id(t, 'B')], reason: 'Decided by CAP per tournament rules' });
  assert.deepEqual(decided.rounds.at(-1).speakerIds, [id(t, 'B')]);
});

test('rounds carry their own format, time and judging guidance; speakers see ranks, never scores', () => {
  let s = event(['A', 'B'], ['J1']);
  s = m(s, 'create-round', { name: 'Round 2', format: 'Business pitch', timeSeconds: 180, guidance: ['Name the innovation', 'Plausibility is part of the content'], speakerIds: s.speakers.map(p => p.id) });
  assert.equal(s.rounds[0].format, 'Business pitch'); assert.deepEqual(s.rounds[0].guidance, ['Name the innovation', 'Plausibility is part of the content']);
  s = m(s, 'save-draw', { roundId: s.rounds[0].id, rooms: [{ name: 'Room 1', speakers: s.speakers.map(p => p.id), judges: [s.judges[0].id] }] });
  s = m(s, 'open-round', { roundId: s.rounds[0].id });
  s = m(s, 'ballot', { roundId: s.rounds[0].id, roomId: s.rounds[0].rooms[0].id, status: 'submitted', rows: [{ speakerId: id(s, 'A'), rank: 1, worked: 'Clear name' }, { speakerId: id(s, 'B'), rank: 2 }] }, { role: 'judge', id: s.judges[0].id });
  s = m(s, 'approve-ballot', { roundId: s.rounds[0].id, ballotId: s.rounds[0].ballots[0].id });
  s = m(s, 'complete-round', { roundId: s.rounds[0].id });
  s = m(s, 'publish', { roundId: s.rounds[0].id, resultsPublished: true, feedbackPublished: true });
  const view = projectEvent(s, { role: 'speaker', id: id(s, 'A') });
  assert.equal(view.rounds[0].format, 'Business pitch');
  assert.equal(view.rounds[0].feedback[0].worked, 'Clear name');
  assert.deepEqual(view.rounds[0].feedback[0].scores, []);
});

test('rank-points ballots, absences and round formats survive database storage', async () => {
  const { db, tournamentId } = await createPSDatabase();
  let s = event(['A', 'B', 'C'], ['J1']);
  s = round(s, [{ speakers: ['A', 'B', 'C'], judges: ['J1'], ranks: { J1: { A: 2, B: 'absent', C: 1 } } }]);
  const saved = await v2Commit(db, { eventId: randomUUID(), tournamentId, version: 0, state: s });
  assert.equal(saved.state.rounds[0].format, 'Prepared speeches');
  assert.equal(saved.state.rounds[0].timeSeconds, 180);
  assert.deepEqual(standings(saved.state).map(r => [r.name, r.score]), standings(s).map(r => [r.name, r.score]));
  assert.equal(roundResults(saved.state, saved.state.rounds[0]).find(r => r.speakerId === id(s, 'B')).absent, true);
});
