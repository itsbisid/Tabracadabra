// Public speaking rules. Shared by the API and tests; never trusts client totals.
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { validateRules, calculatePerformance, capacityPlan, EXAMPLE_PRESETS } from './ps-rules.js';

export { EXAMPLE_PRESETS };

export const DEFAULT_RUBRIC = [
  { name: 'Content', max: 40, weight: 40 },
  { name: 'Delivery', max: 40, weight: 40 },
  { name: 'Structure', max: 20, weight: 20 }
];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const required = value => { const v = text(value); assert(v, 'A name is required.'); return v; };
const integer = (value, min, max) => {
  assert(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, `Enter a whole number from ${min} to ${max}.`);
  return value;
};
const find = (items, id, label) => { const item = items.find(x => x.id === id); assert(item, `${label} not found.`); return item; };
const adminOnly = actor => assert(actor.role === 'admin', 'Only tournament administrators can do this.');
const rounded = x => Math.round((x + Number.EPSILON) * 10000) / 10000;

// All configurable rules are validated by ps-rules.js. Older events without the newer
// settings fall back to the documented defaults there.
const RULE_KEYS = ['rubric', 'scoring', 'aggregation', 'minHeat', 'maxHeat', 'panelSize', 'finalPanelSize', 'rankPolicy', 'feedbackPolicy', 'timezone',
  'preliminaryRounds', 'breakSize', 'durationSeconds', 'preparationSeconds', 'graceSeconds', 'changeoverSeconds', 'deliberationSeconds', 'travelSeconds',
  'roomCount', 'precision', 'feedbackDeadline', 'penalty'];
function settings(input) {
  const rules = validateRules({ ...input, rubric: input.rubric || DEFAULT_RUBRIC });
  return Object.fromEntries(RULE_KEYS.map(k => [k, rules[k]]));
}
const ruleCache = new WeakMap();
export function rulesOf(event) {
  if (!ruleCache.has(event)) ruleCache.set(event, validateRules({ ...event, rubric: event.rubric || DEFAULT_RUBRIC }));
  return ruleCache.get(event);
}

// Read-only helpers for the setup screens: a hand-checkable sample ballot and a capacity estimate.
export function previewRules(input, sampleScores) {
  const rules = validateRules({ ...input, rubric: input.rubric || DEFAULT_RUBRIC });
  const scores = sampleScores || rules.rubric.map(c => Number(new Decimal(c.max - c.min).mul(0.75).div(c.step).floor().mul(c.step).plus(c.min)));
  const elapsedSeconds = rules.penalty.method === 'overtime' ? rules.durationSeconds + rules.graceSeconds + rules.penalty.stepSeconds : undefined;
  return { rules, sample: { scores, elapsedSeconds, result: calculatePerformance(rules, { scores, elapsedSeconds }) } };
}
export function planCapacity(event, input = {}) {
  const rules = rulesOf(event);
  const entrants = input.entrants ?? event.speakers.filter(p => p.active).length;
  const judges = input.judges ?? event.judges.filter(p => p.active).length;
  const rooms = input.rooms ?? rules.roomCount;
  return { entrants, judges, rooms, ...capacityPlan({ entrants, rooms, judges, rules }) };
}

export function createEvent(input) {
  return { name: required(input.name), type: text(input.type || 'Prepared speech'), ...settings(input), ruleVersion: 1, speakers: [], judges: [], rounds: [] };
}

export function scoreRow(event, row) {
  return calculatePerformance(rulesOf(event), row).total;
}

// One result per speaker per room, from approved ballots only. Every judge counts equally.
export function roundResults(event, round) {
  const rules = rulesOf(event), results = [];
  for (const room of round.rooms) {
    const ballots = room.judges.map(judgeId => round.ballots.find(b => b.roomId === room.id && b.judgeId === judgeId && b.status === 'approved'));
    if (!ballots.length || ballots.some(b => !b)) continue;
    for (const speakerId of room.speakers) {
      const judged = ballots.map(b => {
        const row = b.rows.find(r => r.speakerId === speakerId);
        const calc = calculatePerformance(rules, { ...row, elapsedSeconds: row.elapsedSeconds ?? undefined });
        return { judgeId: b.judgeId, rank: row.rank, total: calc.total, penalty: Number(calc.penalty) };
      });
      const sum = judged.reduce((t, x) => t.plus(x.total), new Decimal(0)), rankSum = judged.reduce((t, x) => t.plus(x.rank), new Decimal(0));
      const score = (rules.aggregation === 'sum' ? sum : sum.div(judged.length)).toDecimalPlaces(4).toNumber();
      const meanRank = rankSum.div(judged.length).toDecimalPlaces(4).toNumber();
      // Within-heat progression compares relative position (0 = first, 1 = last) so unequal heats are comparable. Used only when configured.
      const position = room.speakers.length > 1 ? new Decimal(meanRank).minus(1).div(room.speakers.length - 1).toDecimalPlaces(4).toNumber() : 0;
      results.push({ speakerId, roundId: round.id, roomId: room.id, heatSize: room.speakers.length, score, rankSum: rankSum.toNumber(), judgeCount: judged.length, meanRank, position, judges: judged });
    }
  }
  return results;
}

// Equal judge weight; equal round weight. Exact ties share a place.
export function standings(event, rounds = event.rounds.filter(r => r.stage === 'preliminary' && r.status === 'completed')) {
  const rows = new Map();
  for (const round of rounds) for (const result of roundResults(event, round)) {
    const speaker = event.speakers.find(s => s.id === result.speakerId);
    if (!rows.has(speaker.id)) rows.set(speaker.id, { speakerId: speaker.id, name: speaker.name, institution: speaker.institution, category: speaker.category, active: speaker.active, rounds: 0, score: 0, rankTotal: 0 });
    const row = rows.get(speaker.id);
    row.rounds++;
    row.score = rounded(row.score + result.score);
    row.rankTotal = rounded(row.rankTotal + (rulesOf(event).rankPolicy === 'within-heat' ? result.position : result.meanRank));
  }
  const compare = event.scoring === 'rank'
    ? (a, b) => a.rankTotal - b.rankTotal || b.score - a.score
    : (a, b) => b.score - a.score || a.rankTotal - b.rankTotal;
  const sorted = [...rows.values()].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  return sorted.map((row, i) => ({ ...row, average: rounded(row.score / row.rounds), place: i && compare(row, sorted[i - 1]) === 0 ? 0 : i + 1 })).map((row, i, all) => {
    if (!row.place) row.place = all[i - 1].place;
    return row;
  });
}

function validateRooms(event, rooms, expected) {
  assert(Array.isArray(rooms) && rooms.length > 0 && rooms.length <= 100, 'Add at least one room.');
  const seenSpeakers = new Set(), seenJudges = new Set(), seenRooms = new Set();
  const clean = rooms.map(room => {
    const name = required(room.name);
    assert(!seenRooms.has(name.toLowerCase()), 'Room names must be unique within a round.'); seenRooms.add(name.toLowerCase());
    assert(Array.isArray(room.speakers) && room.speakers.length > 0 && room.speakers.length <= 50, 'Each room needs 1–50 speakers.');
    assert(Array.isArray(room.judges) && room.judges.length > 0 && room.judges.length <= 10, 'Assign 1–10 scoring judges to every room.');
    for (const id of room.speakers) {
      const speaker = find(event.speakers, id, 'Speaker');
      assert(expected.includes(id) && !seenSpeakers.has(id), 'Every selected speaker must appear in exactly one room.');
      assert(speaker.active, 'Withdrawn speakers cannot be drawn.'); seenSpeakers.add(id);
    }
    for (const id of room.judges) {
      const judge = find(event.judges, id, 'Judge');
      assert(judge.active && !seenJudges.has(id), 'A judge can only be assigned once per round.'); seenJudges.add(id);
    }
    return { id: randomUUID(), name, speakers: [...room.speakers], judges: [...room.judges] };
  });
  assert(seenSpeakers.size === expected.length, 'Include every selected speaker exactly once.');
  return clean;
}

export function allocationWarnings(event, round) {
  const warnings = [], rules = rulesOf(event);
  const panel = round.stage === 'preliminary' ? rules.panelSize : rules.finalPanelSize;
  for (const room of round.rooms) {
    if (room.judges.length !== panel) warnings.push(`${room.name}: ${room.judges.length} judge(s) assigned; the configured panel is ${panel}.`);
    if (room.speakers.length < rules.minHeat) warnings.push(`${room.name}: ${room.speakers.length} speaker(s); the configured minimum is ${rules.minHeat}.`);
    room.speakers.forEach((a, i) => room.speakers.slice(i + 1).forEach(b => {
      const sa = find(event.speakers, a, 'Speaker'), sb = find(event.speakers, b, 'Speaker');
      if (sa.institution && sa.institution.toLowerCase() === sb.institution.toLowerCase()) warnings.push(`${room.name}: ${sa.name} and ${sb.name} are both from ${sa.institution}.`);
    }));
  }
  for (const room of round.rooms) for (const judgeId of room.judges) {
    const judge = find(event.judges, judgeId, 'Judge');
    for (const speakerId of room.speakers) {
      const speaker = find(event.speakers, speakerId, 'Speaker');
      if (judge.institution && judge.institution.toLowerCase() === speaker.institution.toLowerCase()) warnings.push(`${room.name}: ${judge.name} and ${speaker.name} share an institution.`);
      if (event.rounds.some(r => r.id !== round.id && r.rooms.some(rm => rm.judges.includes(judgeId) && rm.speakers.includes(speakerId)))) warnings.push(`${room.name}: ${judge.name} has already been allocated to ${speaker.name}.`);
    }
  }
  return warnings;
}

function breakSpeakers(event, input) {
  const completed = event.rounds.filter(r => r.stage === 'preliminary' && r.status === 'completed');
  assert(completed.length && !event.rounds.some(r => r.stage === 'preliminary' && r.status !== 'completed'), 'Complete all preliminary rounds before generating a break.');
  const ranked = standings(event, completed).filter(s => s.active && s.rounds === completed.length && (!input.category || s.category === input.category));
  const count = integer(input.breakSize, 1, ranked.length);
  const cutoff = ranked[count - 1];
  const better = ranked.filter(s => event.scoring === 'rank' ? s.rankTotal < cutoff.rankTotal || (s.rankTotal === cutoff.rankTotal && s.score > cutoff.score) : s.score > cutoff.score || (s.score === cutoff.score && s.rankTotal < cutoff.rankTotal));
  const tied = ranked.filter(s => s.score === cutoff.score && s.rankTotal === cutoff.rankTotal);
  const needed = count - better.length;
  if (tied.length > needed) {
    assert(Array.isArray(input.tieSelections) && input.tieSelections.length === needed && new Set(input.tieSelections).size === needed && input.tieSelections.every(id => tied.some(s => s.speakerId === id)), `Break cutoff is tied between ${tied.map(s => s.name).join(', ')}. Select ${needed} tied speaker(s) and record a reason.`);
    assert(text(input.reason, 1000), 'Record the reason for resolving the cutoff tie.');
    return [...better.map(s => s.speakerId), ...input.tieSelections];
  }
  return ranked.slice(0, count).map(s => s.speakerId);
}

export function mutateEvent(original, action, input, actor) {
  const event = structuredClone(original);
  const now = new Date().toISOString();
  if (!['ballot', 'judge-feedback', 'check-in'].includes(action)) adminOnly(actor);
  if (action === 'settings') {
    assert(!event.rounds.length, 'Event rules are frozen once rounds exist.');
    Object.assign(event, settings(input), { name: required(input.name), type: text(input.type), ruleVersion: (event.ruleVersion || 1) + 1 });
  } else if (action === 'add-speakers' || action === 'add-judges') {
    const list = action === 'add-speakers' ? event.speakers : event.judges;
    assert(Array.isArray(input.people) && input.people.length > 0 && input.people.length <= 500, 'Add 1–500 people at a time.');
    assert(list.length + input.people.length <= 2000, 'An event supports up to 2,000 people per role.');
    for (const p of input.people) {
      const name = required(p.name), institution = text(p.institution);
      assert(!list.some(s => s.name.toLowerCase() === name.toLowerCase() && s.institution.toLowerCase() === institution.toLowerCase()), `Already registered: ${name} (${institution || 'no institution'}).`);
      list.push({ id: randomUUID(), name, institution, category: text(p.category), active: true, checkedIn: false });
    }
  } else if (action === 'person-status') {
    assert(['speaker', 'judge'].includes(input.role), 'Invalid participant role.');
    const p = find(input.role === 'speaker' ? event.speakers : event.judges, input.personId, 'Participant');
    assert(!event.rounds.some(r => r.status !== 'completed' && r.rooms.some(room => (input.role === 'speaker' ? room.speakers : room.judges).includes(p.id))), 'Remove this participant from unfinished draws before withdrawing them.');
    p.active = Boolean(input.active);
  } else if (action === 'check-in') {
    assert(actor.role === 'speaker', 'Only speakers can check in here.');
    find(event.speakers, actor.id, 'Speaker').checkedIn = true;
  } else if (action === 'create-round' || action === 'create-break') {
    assert(event.rounds.length < 30, 'An event supports up to 30 rounds.');
    assert(!event.rounds.some(r => r.status !== 'completed'), 'Complete the current round before creating the next one.');
    const ids = action === 'create-break' ? breakSpeakers(event, input) : input.speakerIds;
    assert(Array.isArray(ids) && ids.length && new Set(ids).size === ids.length, 'Select speakers for this round.');
    const stage = action === 'create-break' ? 'final' : (input.stage || 'preliminary');
    assert(['preliminary', 'semifinal', 'final'].includes(stage), 'Invalid round stage.');
    assert(!(stage === 'preliminary' && event.rounds.some(r => r.stage !== 'preliminary')), 'Preliminary rounds cannot follow elimination rounds.');
    event.rounds.push({ id: randomUUID(), name: required(input.name), stage, speakerIds: [...ids], status: 'draft', drawPublished: false, resultsPublished: false, feedbackPublished: false, rooms: [], ballots: [], judgeFeedback: [], breakReason: text(input.reason, 1000), createdAt: now });
  } else {
    const round = find(event.rounds, input.roundId, 'Round');
    if (action === 'save-draw') {
      assert(round.status === 'draft', 'Only draft rounds can be allocated.');
      round.rooms = validateRooms(event, input.rooms, round.speakerIds);
      const rules = rulesOf(event);
      for (const room of round.rooms) assert(room.speakers.length <= rules.maxHeat, `${room.name} has ${room.speakers.length} speakers; the maximum per heat is ${rules.maxHeat}.`);
      if (rules.scoring === 'rank' && rules.rankPolicy === 'equal-heats') assert(new Set(round.rooms.map(r => r.speakers.length)).size === 1, 'Rank-based standings compare rank totals across rooms, so every room needs the same number of speakers. Rebalance the rooms or choose within-heat progression in the event rules.');
    } else if (action === 'open-round') {
      assert(round.status === 'draft', 'Only draft rounds can be opened.');
      validateRooms(event, round.rooms, round.speakerIds);
      const warnings = allocationWarnings(event, round);
      assert(!warnings.length || text(input.reason, 1000), 'Resolve the allocation warnings or record an override reason.');
      round.allocationReason = text(input.reason, 1000);
      round.status = 'open'; round.drawPublished = true;
    } else if (action === 'ballot') {
      assert(round.status === 'open', 'Ballots are accepted only while this round is open.');
      const room = find(round.rooms, input.roomId, 'Room');
      const judgeId = actor.role === 'admin' ? input.judgeId : actor.id;
      assert((actor.role === 'admin' || actor.role === 'judge') && room.judges.includes(judgeId), 'You are not a scoring judge in this room.');
      if (actor.role === 'admin') assert(text(input.reason, 1000), 'Record why tab is entering this judge’s ballot.');
      const existing = round.ballots.find(b => b.roomId === room.id && b.judgeId === judgeId);
      assert(!existing || existing.status === 'draft', 'This ballot is locked. Ask tab to reopen it.');
      assert(Array.isArray(input.rows) && input.rows.length === room.speakers.length && new Set(input.rows.map(r => r.speakerId)).size === room.speakers.length && input.rows.every(r => room.speakers.includes(r.speakerId)), 'A ballot must contain every speaker in this room exactly once.');
      const rows = input.rows.map(row => {
        const elapsed = row.elapsedSeconds == null || row.elapsedSeconds === '' ? null : Number(row.elapsedSeconds);
        assert(elapsed === null || (Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 7200), 'Elapsed time must be between 0 and 7200 seconds.');
        scoreRow(event, { ...row, elapsedSeconds: elapsed ?? undefined });
        return { speakerId: row.speakerId, scores: [...row.scores], rank: integer(row.rank, 1, room.speakers.length), elapsedSeconds: elapsed,
          feedback: text(row.feedback, 5000), worked: text(row.worked, 3000), improve: text(row.improve, 3000), nextStep: text(row.nextStep, 3000) };
      });
      assert(new Set(rows.map(r => r.rank)).size === rows.length, 'Each speaker needs a unique rank within this ballot.');
      assert(['draft', 'submitted'].includes(input.status), 'Invalid ballot status.');
      const ballot = { id: existing?.id || randomUUID(), roomId: room.id, judgeId, rows, status: input.status, updatedAt: now, enteredBy: actor.id, version: (existing?.version || 0) + 1 };
      round.ballots = [...round.ballots.filter(b => b.id !== ballot.id), ballot];
    } else if (action === 'approve-ballot' || action === 'reopen-ballot') {
      assert(round.status === 'open', 'Only an open round can have its ballots changed.');
      const ballot = find(round.ballots, input.ballotId, 'Ballot');
      if (action === 'approve-ballot') { assert(ballot.status === 'submitted', 'Submit the ballot before approving.'); ballot.status = 'approved'; }
      else { assert(text(input.reason, 1000), 'Record a correction reason.'); ballot.status = 'draft'; }
      ballot.version = (ballot.version || 1) + 1; ballot.updatedAt = now;
    } else if (action === 'complete-round') {
      assert(round.status === 'open', 'Only an open round can be completed.');
      assert(roundResults(event, round).length === round.speakerIds.length, 'Every assigned judge must have an approved ballot before completing the round.');
      round.status = 'completed';
    } else if (action === 'publish') {
      assert(round.status === 'completed', 'Complete the round before publishing results or feedback.');
      round.resultsPublished = Boolean(input.resultsPublished);
      round.feedbackPublished = Boolean(input.feedbackPublished);
    } else if (action === 'judge-feedback') {
      assert(round.status !== 'draft', 'Feedback opens after the draw is published.');
      assert(['speaker', 'judge'].includes(actor.role), 'Use your participant portal to submit feedback.');
      const room = find(round.rooms, input.roomId, 'Room');
      assert((actor.role === 'speaker' ? room.speakers : room.judges).includes(actor.id) && room.judges.includes(input.judgeId) && input.judgeId !== actor.id, 'Feedback must be for another judge in your assigned room.');
      const feedback = { fromRole: actor.role, fromId: actor.id, toId: input.judgeId, roomId: room.id, rating: integer(input.rating, 1, 5), comment: text(input.comment, 3000), updatedAt: now };
      round.judgeFeedback = [...round.judgeFeedback.filter(f => !(f.fromRole === actor.role && f.fromId === actor.id && f.toId === input.judgeId && f.roomId === room.id)), feedback];
    } else throw new Error('Unknown public speaking action.');
  }
  return event;
}

// Explicit projection: never send the private aggregate to public or portal clients.
export function projectEvent(event, actor = { role: 'public' }) {
  if (actor.role === 'admin') return { ...event, standings: standings(event), roundStandings: Object.fromEntries(event.rounds.map(r => [r.id, standings(event, [r])])), warnings: Object.fromEntries(event.rounds.map(r => [r.id, allocationWarnings(event, r)])) };
  const person = actor.role === 'speaker' ? event.speakers.find(p => p.id === actor.id) : event.judges.find(p => p.id === actor.id);
  const published = event.rounds.filter(r => r.drawPublished);
  const visibleResults = published.filter(r => r.resultsPublished && r.status === 'completed');
  return {
    name: event.name, type: event.type, rubric: rulesOf(event).rubric, scoring: event.scoring, durationSeconds: rulesOf(event).durationSeconds, penalty: rulesOf(event).penalty,
    participant: person ? { id: person.id, name: person.name, checkedIn: person.checkedIn, role: actor.role } : null,
    speakers: event.speakers.filter(s => published.some(r => r.rooms.some(room => room.speakers.includes(s.id)))).map(s => ({ id: s.id, name: s.name, institution: s.institution, category: s.category })),
    judges: event.judges.filter(j => published.some(r => r.rooms.some(room => room.judges.includes(j.id)))).map(j => ({ id: j.id, name: j.name })),
    standings: standings(event, visibleResults.filter(r => r.stage === 'preliminary')),
    rounds: published.map(r => ({
      id: r.id, name: r.name, stage: r.stage, status: r.status, rooms: r.rooms,
      resultsPublished: r.resultsPublished, feedbackPublished: r.feedbackPublished,
      results: r.resultsPublished && r.status === 'completed' ? roundResults(event, r) : [],
      standings: r.resultsPublished && r.status === 'completed' ? standings(event, [r]) : [],
      ballots: actor.role === 'judge' ? r.ballots.filter(b => b.judgeId === actor.id) : [],
      feedback: actor.role === 'speaker' && r.feedbackPublished && r.status === 'completed'
        ? r.ballots.filter(b => b.status === 'approved').flatMap(b => b.rows.filter(row => row.speakerId === actor.id).map(row => ({ feedback: row.feedback, worked: row.worked || '', improve: row.improve || '', nextStep: row.nextStep || '', scores: row.scores }))) : [],
      judgeFeedback: r.judgeFeedback.filter(f => f.fromRole === actor.role && f.fromId === actor.id)
    }))
  };
}
