import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, mutateEvent, scoreRow, standings, projectEvent, allocationWarnings } from '../api-shared/ps-engine.js';
import { issuePSLink, verifyPSLink, assertPSParticipant } from '../api-shared/ps-access.js';

const admin = { role: 'admin', id: 'tab' };
const mutate = (state, action, input = {}, actor = admin) => mutateEvent(state, action, input, actor);
function fixture(judgeCount = 2) {
  let state = createEvent({ name: 'Prepared speech' });
  state = mutate(state, 'add-speakers', { people: [{ name: 'Ama', institution: 'Ashesi', category: 'Novice' }, { name: 'Kofi', institution: 'UG' }] });
  state = mutate(state, 'add-judges', { people: Array.from({ length: judgeCount }, (_, i) => ({ name: `Judge ${i + 1}`, institution: 'KNUST' })) });
  state = mutate(state, 'create-round', { name: 'Round 1', speakerIds: state.speakers.map(p => p.id) });
  state = mutate(state, 'save-draw', { roundId: state.rounds[0].id, rooms: [{ name: 'Room 1', speakers: state.speakers.map(p => p.id), judges: state.judges.map(p => p.id) }] });
  return mutate(state, 'open-round', { roundId: state.rounds[0].id });
}
function ballot(state, judgeIndex = 0, overrides = {}) {
  return { roundId: state.rounds[0].id, roomId: state.rounds[0].rooms[0].id, judgeId: state.judges[judgeIndex].id, status: 'submitted', reason: 'Paper ballot entered by tab', rows: state.speakers.map((p, i) => ({ speakerId: p.id, rank: i + 1, scores: i ? [24, 24, 12] : [32, 32, 16], feedback: `Private feedback for ${p.name}` })), ...overrides };
}
function complete(state) {
  for (let i = 0; i < state.judges.length; i++) {
    state = mutate(state, 'ballot', ballot(state, i), { role: 'judge', id: state.judges[i].id });
    state = mutate(state, 'approve-ballot', { roundId: state.rounds[0].id, ballotId: state.rounds[0].ballots.at(-1).id });
  }
  return mutate(state, 'complete-round', { roundId: state.rounds[0].id });
}

test('scores normalize criterion marks by weight and reject non-numbers', () => {
  const event = createEvent({ name: 'Custom', rubric: [{ name: 'Content', max: 10, weight: 70 }, { name: 'Delivery', max: 20, weight: 30 }] });
  assert.equal(scoreRow(event, { scores: [8, 10] }), 71);
  for (const bad of [NaN, Infinity, '8', null, -1, 11]) assert.throws(() => scoreRow(event, { scores: [bad, 10] }));
  assert.throws(() => createEvent({ name: 'Bad', rubric: [{ name: 'Content', max: 40, weight: 40 }] }), /100/);
});

test('complete tournament: panel averaging, approval, publication and final break', () => {
  let state = fixture();
  assert.throws(() => mutate(state, 'complete-round', { roundId: state.rounds[0].id }), /approved/);
  state = complete(state);
  const ranks = standings(state);
  assert.equal(ranks[0].name, 'Ama'); assert.equal(ranks[0].score, 80); assert.equal(ranks[1].score, 60);
  assert.equal(projectEvent(state).standings.length, 0);
  state = mutate(state, 'publish', { roundId: state.rounds[0].id, resultsPublished: true, feedbackPublished: true });
  assert.equal(projectEvent(state).standings[0].score, 80);
  state = mutate(state, 'create-break', { name: 'Final', breakSize: 1 });
  assert.deepEqual(state.rounds[1].speakerIds, [state.speakers[0].id]);
  assert.equal(state.rounds[1].stage, 'final');
});

test('ballots reject unassigned judges, duplicate speakers, duplicate ranks and out of range scores', () => {
  const state = fixture(), data = ballot(state);
  assert.throws(() => mutate(state, 'ballot', data, { role: 'judge', id: 'outsider' }), /not a scoring judge/);
  assert.throws(() => mutate(state, 'ballot', data, { role: 'speaker', id: state.speakers[0].id }), /not a scoring judge/);
  assert.throws(() => mutate(state, 'ballot', { ...data, rows: [data.rows[0], data.rows[0]] }), /exactly once/);
  assert.throws(() => mutate(state, 'ballot', { ...data, rows: data.rows.map(r => ({ ...r, rank: 1 })) }), /unique rank/);
  assert.throws(() => mutate(state, 'ballot', { ...data, rows: data.rows.map(r => ({ ...r, scores: [100, 40, 20] })) }), /Content/);
  assert.throws(() => mutate(state, 'ballot', { ...data, reason: '' }), /why tab/);
});

test('submission locks, deliberate reopening and immutable completed rounds', () => {
  let state = fixture(1), data = ballot(state);
  state = mutate(state, 'ballot', data);
  assert.throws(() => mutate(state, 'ballot', data), /locked/);
  const b = state.rounds[0].ballots[0];
  assert.throws(() => mutate(state, 'reopen-ballot', { roundId: data.roundId, ballotId: b.id }), /reason/);
  state = mutate(state, 'reopen-ballot', { roundId: data.roundId, ballotId: b.id, reason: 'Correct transcription' });
  state = mutate(state, 'ballot', data);
  state = mutate(state, 'approve-ballot', { roundId: data.roundId, ballotId: b.id });
  state = mutate(state, 'complete-round', { roundId: data.roundId });
  assert.throws(() => mutate(state, 'reopen-ballot', { roundId: data.roundId, ballotId: b.id, reason: 'Oops' }), /open round/);
  assert.throws(() => mutate(state, 'settings', { name: 'Change rubric' }), /frozen/);
});

test('public projection excludes drafts, all ballots, private comments and link versions', () => {
  const state = complete(fixture());
  const publicJSON = JSON.stringify(projectEvent(state));
  assert.ok(!publicJSON.includes('Private feedback'));
  assert.ok(!publicJSON.includes('accessVersion'));
  assert.equal(projectEvent(state).rounds[0].ballots.length, 0);
  const judgeView = projectEvent(state, { role: 'judge', id: state.judges[0].id });
  assert.equal(judgeView.rounds[0].ballots.length, 1);
  assert.equal(judgeView.rounds[0].ballots[0].judgeId, state.judges[0].id);
  let released = mutate(state, 'publish', { roundId: state.rounds[0].id, feedbackPublished: true });
  const speakerView = projectEvent(released, { role: 'speaker', id: state.speakers[0].id });
  assert.equal(speakerView.rounds[0].feedback.length, 2);
  assert.ok(!JSON.stringify(speakerView).includes('Private feedback for Kofi'));
  assert.equal(speakerView.standings.length, 0);
  released = mutate(released, 'create-round', { name: 'Unpublished', speakerIds: released.speakers.map(s => s.id) });
  assert.ok(!JSON.stringify(projectEvent(released)).includes('Unpublished'));
});

test('speaker and peer judge feedback enforce room assignment and stay private', () => {
  let state = fixture();
  const data = { roundId: state.rounds[0].id, roomId: state.rounds[0].rooms[0].id, judgeId: state.judges[0].id, rating: 4, comment: 'Confidential evaluation' };
  state = mutate(state, 'judge-feedback', data, { role: 'speaker', id: state.speakers[0].id });
  assert.equal(state.rounds[0].judgeFeedback.length, 1);
  assert.ok(!JSON.stringify(projectEvent(state)).includes('Confidential evaluation'));
  assert.ok(!JSON.stringify(projectEvent(state, { role: 'judge', id: state.judges[0].id })).includes('Confidential evaluation'));
  assert.throws(() => mutate(state, 'judge-feedback', data, { role: 'speaker', id: 'outsider' }), /assigned room/);
  assert.throws(() => mutate(state, 'judge-feedback', data, { role: 'judge', id: state.judges[0].id }), /another judge/);
  assert.throws(() => mutate(state, 'publish', { roundId: data.roundId }, { role: 'judge', id: state.judges[0].id }), /administrators/);
});

test('draw validation prevents duplicates and requires conflict override', () => {
  let state = fixture();
  state.rounds[0].status = 'draft';
  state.judges[0].institution = 'Ashesi';
  assert.equal(allocationWarnings(state, state.rounds[0]).length, 1);
  assert.throws(() => mutate(state, 'open-round', { roundId: state.rounds[0].id }), /override/);
  assert.equal(mutate(state, 'open-round', { roundId: state.rounds[0].id, reason: 'No alternative judge available' }).rounds[0].status, 'open');
  const room = state.rounds[0].rooms[0];
  assert.throws(() => mutate(state, 'save-draw', { roundId: state.rounds[0].id, rooms: [{ ...room, speakers: [room.speakers[0], room.speakers[0]] }] }), /exactly one/);
  assert.throws(() => mutate(state, 'save-draw', { roundId: state.rounds[0].id, rooms: [{ ...room, judges: [room.judges[0], room.judges[0]] }] }), /once/);
});

test('rank aggregation averages panels and exact cutoff ties require a reason', () => {
  let state = fixture();
  state.scoring = 'rank';
  for (let i = 0; i < 2; i++) {
    const data = ballot(state, i);
    data.rows = data.rows.map((r, j) => ({ ...r, scores: [32, 32, 16], rank: i ? 2 - j : j + 1 }));
    state = mutate(state, 'ballot', data);
    state = mutate(state, 'approve-ballot', { roundId: data.roundId, ballotId: state.rounds[0].ballots.at(-1).id });
  }
  state = mutate(state, 'complete-round', { roundId: state.rounds[0].id });
  assert.deepEqual(standings(state).map(s => [s.place, s.rankTotal]), [[1, 1.5], [1, 1.5]]);
  assert.throws(() => mutate(state, 'create-break', { name: 'Final', breakSize: 1 }), /cutoff is tied/);
  state = mutate(state, 'create-break', { name: 'Final', breakSize: 1, tieSelections: [state.speakers[1].id], reason: 'Published tournament tie-break procedure applied by tab' });
  assert.deepEqual(state.rounds[1].speakerIds, [state.speakers[1].id]);
});

test('private links expire, reject tampering, rotate and revoke', () => {
  let state = fixture();
  const personId = state.judges[0].id;
  state = mutate(state, 'portal-link', { role: 'judge', personId });
  const token = issuePSLink('event', state.judges[0], 'judge', 'test-secret', 100);
  const actor = verifyPSLink(token, 'test-secret', 200);
  assert.equal(assertPSParticipant(state, actor).id, personId);
  assert.throws(() => verifyPSLink(token + 'x', 'test-secret', 200), /Invalid/);
  assert.throws(() => verifyPSLink(token, 'different-secret', 200), /Invalid/);
  assert.throws(() => verifyPSLink(token, 'test-secret', 15 * 86400000), /expired/);
  state = mutate(state, 'portal-link', { role: 'judge', personId });
  assert.throws(() => assertPSParticipant(state, actor), /revoked/);
});

test('failed mutations never alter the original state', () => {
  const state = fixture(); const before = structuredClone(state);
  assert.throws(() => mutate(state, 'add-speakers', { people: [{ name: 'New' }, { name: 'Ama', institution: 'Ashesi' }] }));
  assert.deepEqual(state, before);
});

export { fixture, ballot, complete };
