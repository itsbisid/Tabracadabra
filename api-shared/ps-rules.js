import Decimal from 'decimal.js';
export const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const int = (v, min, max, name) => { ensure(Number.isInteger(v) && v >= min && v <= max, `${name} must be ${min}–${max}.`); return v; };
export const EXAMPLE_PRESETS = {
  prepared: [{ id: 'content', name: 'Content', max: 40, weight: 40 }, { id: 'delivery', name: 'Delivery', max: 35, weight: 35 }, { id: 'language', name: 'Language', max: 25, weight: 25 }],
  impromptu: [{ id: 'ideas', name: 'Ideas', max: 30, weight: 30 }, { id: 'organisation', name: 'Organisation', max: 30, weight: 30 }, { id: 'delivery', name: 'Delivery', max: 40, weight: 40 }],
  interpretation: [{ id: 'interpretation', name: 'Interpretation', max: 40, weight: 40 }, { id: 'performance', name: 'Performance', max: 40, weight: 40 }, { id: 'selection', name: 'Selection', max: 20, weight: 20 }]
};
// Rank-points ("we rank, we do not score"), e.g. GUDC 2026: judges submit an order only;
// 1st earns `pointsTop`, each place below one point less (anchored at the top, never below 0).
export const TIE_BREAKS = {
  judgeFirsts: 'Judge firsts',
  headToHead: 'Head to head',
  bandProfile: 'Band profile',
  totalMinusWeakest: 'Total minus weakest round',
  chairBallot: "Chair's ballot"
};
export const DEFAULT_TIE_BREAKS = Object.keys(TIE_BREAKS);
export const GUDC_GUIDANCE = {
  prepared: [{ id: 'response', name: 'Response to topic' }, { id: 'content', name: 'Content and argument' }, { id: 'structure', name: 'Structure' }, { id: 'delivery', name: 'Delivery' }],
  impromptu: [{ id: 'response', name: 'Response to topic' }, { id: 'structure', name: 'Structure under pressure' }, { id: 'delivery', name: 'Delivery' }],
  poi: [{ id: 'cohesion', name: 'Thematic cohesion' }, { id: 'merit', name: 'Literary merit' }, { id: 'delivery', name: 'Interpretive delivery', description: 'Vocal variety, physical expression, emotional engagement' }]
};
export const rankPoints = (rules, rank) => Math.max(0, rules.pointsTop + 1 - rank);

// Criteria in rank-points mode guide judges; they carry no marks or weights.
function guidance(criteria) {
  ensure(Array.isArray(criteria) && criteria.length > 0 && criteria.length <= 12, 'Use 1–12 judging criteria.');
  const list = criteria.map((c, i) => {
    ensure(typeof c.name === 'string' && c.name.trim() && c.name.length <= 160, 'Each criterion needs a name.');
    const id = c.id || `criterion_${i}`;
    ensure(/^[a-zA-Z0-9_-]{1,80}$/.test(id), 'Invalid criterion ID.');
    return { id, name: c.name.trim(), description: String(c.description || '').slice(0, 1000) };
  });
  ensure(new Set(list.map(c => c.name.toLowerCase())).size === list.length, 'Criterion names must be unique.');
  return list;
}

export function validateRules(input) {
  if ((input.scoring || 'score') === 'points') return validatePointsRules(input);
  const criteria = input.rubric || EXAMPLE_PRESETS.prepared;
  ensure(Array.isArray(criteria) && criteria.length > 0 && criteria.length <= 12, 'Use 1–12 criteria.');
  const rubric = criteria.map((c, i) => {
    ensure(typeof c.name === 'string' && c.name.trim() && c.name.length <= 160, 'Each criterion needs a name.');
    const max = Number(c.max), weight = Number(c.weight), min = Number(c.min ?? 0), step = Number(c.step ?? 1);
    ensure([max, weight, min, step].every(Number.isFinite) && max > min && min >= 0 && max <= 1000 && weight > 0 && weight <= 100 && step > 0 && step <= max && new Decimal(max).minus(min).mod(step).isZero(), 'Check criterion ranges, weights and increments.');
    ensure(/^[a-zA-Z0-9_-]{1,80}$/.test(c.id || `criterion_${i}`), 'Invalid criterion ID.');
    return { id: c.id || `criterion_${i}`, name: c.name.trim(), description: String(c.description || '').slice(0, 1000), min, max, weight, step };
  });
  ensure(new Set(rubric.map(c => c.id)).size === rubric.length && new Set(rubric.map(c => c.name.toLowerCase())).size === rubric.length, 'Criterion IDs and names must be unique.');
  ensure(rubric.reduce((s, c) => s.plus(c.weight), new Decimal(0)).eq(100), 'Criterion weights must total 100%.');
  const scoring = input.scoring || 'score', aggregation = input.aggregation || 'mean';
  ensure(['score', 'rank'].includes(scoring) && ['mean', 'sum'].includes(aggregation), 'Choose a supported scoring and panel aggregation rule.');
  const minHeat = int(input.minHeat ?? 2, 1, 50, 'Minimum speakers per heat'), maxHeat = int(input.maxHeat ?? 6, minHeat, 50, 'Maximum speakers per heat');
  const panelSize = int(input.panelSize ?? 2, 1, 10, 'Preliminary panel'), finalPanelSize = int(input.finalPanelSize ?? 2, 1, 10, 'Final panel');
  const rankPolicy = input.rankPolicy || 'equal-heats';
  ensure(rankPolicy === 'equal-heats' || rankPolicy === 'within-heat', 'Choose equal heats or within-heat progression for ranks.');
  const feedbackPolicy = input.feedbackPolicy || 'together'; ensure(['together', 'scores-first'].includes(feedbackPolicy), 'Invalid feedback policy.');
  const penalty = input.penalty || { method: 'none', pointsPerStep: 0, stepSeconds: 10, cap: 0 };
  ensure(['none', 'overtime'].includes(penalty.method), 'Unsupported penalty method.');
  for (const k of ['pointsPerStep', 'cap']) ensure(Number.isFinite(Number(penalty[k] ?? 0)) && Number(penalty[k] ?? 0) >= 0, 'Penalties cannot be negative.');
  return { rubric, scoring, aggregation, minHeat, maxHeat, panelSize, finalPanelSize, rankPolicy, feedbackPolicy,
    timezone: input.timezone || 'Africa/Accra', ruleVersion: input.ruleVersion || 1,
    preliminaryRounds: int(input.preliminaryRounds ?? 3, 1, 20, 'Preliminary rounds'), breakSize: int(input.breakSize ?? 12, 1, 2000, 'Break size'),
    durationSeconds: int(input.durationSeconds ?? 180, 30, 3600, 'Speech duration'), preparationSeconds: int(input.preparationSeconds ?? 0, 0, 7200, 'Preparation'),
    graceSeconds: int(input.graceSeconds ?? 15, 0, 600, 'Grace period'), changeoverSeconds: int(input.changeoverSeconds ?? 30, 0, 600, 'Changeover'),
    deliberationSeconds: int(input.deliberationSeconds ?? 300, 0, 3600, 'Deliberation'), travelSeconds: int(input.travelSeconds ?? 120, 0, 3600, 'Travel buffer'),
    roomCount: int(input.roomCount ?? 8, 1, 100, 'Physical rooms'), precision: int(input.precision ?? 2, 0, 4, 'Displayed precision'),
    feedbackDeadline: input.feedbackDeadline || null, penalty: { ...penalty, stepSeconds: int(Number(penalty.stepSeconds || 10), 1, 600, 'Penalty interval') }
  };
}
function validatePointsRules(input) {
  // Validate the shared settings (heats, panels, timing, rounds) through the standard path, then
  // replace the scoring parts. Timing penalties do not apply: there are no marks to deduct from.
  const base = validateRules({ ...input, scoring: 'score', rubric: [{ id: 'overall', name: 'Overall', max: 100, weight: 100 }], penalty: { method: 'none', pointsPerStep: 0, stepSeconds: 10, cap: 0 } });
  const tieBreaks = input.tieBreaks == null ? DEFAULT_TIE_BREAKS : input.tieBreaks;
  ensure(Array.isArray(tieBreaks) && tieBreaks.every(t => t in TIE_BREAKS) && new Set(tieBreaks).size === tieBreaks.length, 'Choose tie-breaks from the supported list, each at most once.');
  return { ...base, scoring: 'points', aggregation: 'mean', rubric: guidance(input.rubric || GUDC_GUIDANCE.prepared),
    pointsTop: int(Number(input.pointsTop ?? 10), 1, 100, 'Points for first place'), tieBreaks: [...tieBreaks] };
}

export function calculatePerformance(rules, row) {
  ensure(Array.isArray(row.scores) && row.scores.length === rules.rubric.length, 'Every criterion needs a score.');
  const breakdown = rules.rubric.map((c, i) => {
    const value = row.scores[i]; ensure(typeof value === 'number' && Number.isFinite(value) && value >= (c.min || 0) && value <= c.max, `${c.name}: score is outside its range.`);
    ensure(new Decimal(value).minus(c.min || 0).mod(c.step || 1).isZero(), `${c.name}: use increments of ${c.step || 1}.`);
    return { criterionId: c.id, mark: value, maximum: c.max, weight: c.weight, contribution: new Decimal(value).div(c.max).mul(c.weight).toString() };
  });
  let penalty = new Decimal(0);
  if (rules.penalty?.method === 'overtime') {
    ensure(Number.isFinite(row.elapsedSeconds) && row.elapsedSeconds >= 0, 'Record the elapsed speech time for timing penalties.');
    const overtime = Math.max(0, row.elapsedSeconds - rules.durationSeconds - rules.graceSeconds);
    penalty = Decimal.min(new Decimal(Math.ceil(overtime / rules.penalty.stepSeconds)).mul(rules.penalty.pointsPerStep), rules.penalty.cap);
  }
  const beforePenalty = breakdown.reduce((s, c) => s.plus(c.contribution), new Decimal(0));
  return { breakdown, beforePenalty: beforePenalty.toString(), penalty: penalty.toString(), total: Decimal.max(0, beforePenalty.minus(penalty)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() };
}
export function capacityPlan({ entrants, rooms, judges, rules }) {
  int(entrants, 0, 2000, 'Entrants'); int(rooms, 0, 100, 'Available rooms'); int(judges, 0, 2000, 'Available judges');
  const heats = Math.ceil(entrants / rules.maxHeat), minPossible = heats ? Math.floor(entrants / heats) : 0;
  const concurrency = Math.min(heats, rooms, Math.floor(judges / rules.panelSize));
  const waves = concurrency ? Math.ceil(heats / concurrency) : 0;
  const heatSeconds = rules.preparationSeconds + rules.maxHeat * (rules.durationSeconds + rules.changeoverSeconds) + rules.deliberationSeconds + rules.travelSeconds;
  const problems = [];
  if (entrants && minPossible < rules.minHeat) problems.push('Redistribution cannot satisfy the minimum heat size. Revise the section limits.');
  if (entrants && !concurrency) problems.push('Add an available room and a full judging panel.');
  if (rules.scoring === 'rank' && rules.rankPolicy === 'equal-heats' && heats && entrants % heats) problems.push('Rank-sum standings require equal heat sizes. Choose within-heat progression or revise the field/limits.');
  return { heats, concurrency, waves, heatSeconds, estimatedSeconds: heatSeconds * waves, standbyJudges: judges - concurrency * rules.panelSize, feasible: problems.length === 0, problems, note: 'Capacity estimate before personal conflicts, room accessibility and availability are applied.' };
}
export function scheduleConflicts(heats, bookings = [], bufferSeconds = 0) {
  const issues = [];
  for (let i = 0; i < heats.length; i++) {
    const a = heats[i]; if (!a.startsAt || !a.endsAt) continue;
    const start = Date.parse(a.startsAt), end = Date.parse(a.endsAt);
    ensure(Number.isFinite(start) && Number.isFinite(end) && end > start, 'A schedule needs valid start and end times.');
    for (const b of [...heats.slice(0, i), ...bookings]) {
      if (a.id === b.id) continue;
      const overlap = start < Date.parse(b.endsAt) + bufferSeconds * 1000 && end + bufferSeconds * 1000 > Date.parse(b.startsAt);
      if (!overlap) continue;
      if (a.roomId && a.roomId === b.roomId) issues.push(`Room clash: ${a.name} and ${b.name}.`);
      const shared = [...(a.speakers || []), ...(a.judges || [])].filter(id => [...(b.speakers || []), ...(b.judges || [])].includes(id));
      if (shared.length) issues.push(`Participant/judge clash between ${a.name} and ${b.name}.`);
    }
  }
  return [...new Set(issues)];
}
