// Debate (BP) speaker-score rules, shared by the browser ballot and the server validator.
// No Node-only imports: this file is also bundled into the frontend.
//
// Tournaments created before configurable scoring keep the historical 60–80 range in steps of 1.
// With criteria (e.g. Matter / Manner / Method), each speaker's score is the sum of the criteria
// marks, and the speaker-score range is 0 to the sum of the criterion maximums.

export const LEGACY_DEBATE_SCORING = Object.freeze({ min: 60, max: 80, step: 1, criteria: [] });
export const DEBATE_CRITERIA_EXAMPLE = [
  { name: 'Matter', max: 40 }, { name: 'Manner', max: 40 }, { name: 'Method', max: 20 }
];

const fail = message => { throw new Error(message); };
const isMultiple = (value, base, step) => Math.abs((value - base) / step - Math.round((value - base) / step)) < 1e-9;

export function validateDebateScoring(input = {}) {
  const step = Number(input.step ?? 1);
  if (!(step > 0 && step <= 10)) fail('Speaker-point increments must be between 0.01 and 10.');
  const criteria = Array.isArray(input.criteria) ? input.criteria.filter(c => c && String(c.name ?? '').trim()) : [];
  if (criteria.length > 10) fail('Use at most 10 debate scoring criteria.');
  const clean = criteria.map(c => {
    const name = String(c.name).trim().slice(0, 60), max = Number(c.max);
    if (!(max > 0 && max <= 100)) fail(`${name}: the maximum must be between 1 and 100.`);
    if (!isMultiple(max, 0, step)) fail(`${name}: the maximum must be a multiple of the ${step}-point increment.`);
    return { name, max };
  });
  if (new Set(clean.map(c => c.name.toLowerCase())).size !== clean.length) fail('Debate criterion names must be unique.');
  if (clean.length) {
    const total = clean.reduce((sum, c) => sum + c.max, 0);
    const min = Number(input.min ?? 0);
    if (!(min >= 0 && min < total)) fail('The minimum speaker score must be below the total of the criterion maximums.');
    return { min, max: total, step, criteria: clean };
  }
  const min = Number(input.min ?? LEGACY_DEBATE_SCORING.min), max = Number(input.max ?? LEGACY_DEBATE_SCORING.max);
  if (!(Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max > min && max <= 1000)) fail('Speaker points need a minimum below the maximum (up to 1000).');
  if (!isMultiple(max, min, step)) fail('The speaker-point range must divide evenly into the chosen increment.');
  return { min, max, step, criteria: [] };
}

// Rules for a tournament row's settings, falling back to the legacy range.
export function debateScoringFor(settings) {
  return settings && settings.debate_scoring ? validateDebateScoring(settings.debate_scoring) : LEGACY_DEBATE_SCORING;
}

// Validates one speaker's score. `marks` is required when criteria are configured.
export function speakerScore(scoring, { total, marks } = {}, label = 'Speaker') {
  if (scoring.criteria.length) {
    if (!Array.isArray(marks) || marks.length !== scoring.criteria.length) fail(`${label}: give a mark for every criterion.`);
    marks.forEach((value, i) => {
      const c = scoring.criteria[i], mark = Number(value);
      if (!(Number.isFinite(mark) && mark >= 0 && mark <= c.max)) fail(`${label} ${c.name}: enter 0 to ${c.max}.`);
      if (!isMultiple(mark, 0, scoring.step)) fail(`${label} ${c.name}: use increments of ${scoring.step}.`);
    });
    const sum = Math.round(marks.reduce((t, v) => t + Number(v), 0) * 1000) / 1000;
    if (sum < scoring.min) fail(`${label}: the total ${sum} is below the minimum of ${scoring.min}.`);
    if (total != null && Math.abs(Number(total) - sum) > 1e-9) fail(`${label}: the total does not match the criterion marks.`);
    return sum;
  }
  const value = Number(total);
  if (!(Number.isFinite(value) && value >= scoring.min && value <= scoring.max)) fail(`${label} points must be between ${scoring.min} and ${scoring.max}.`);
  if (!isMultiple(value, scoring.min, scoring.step)) fail(`${label} points must use increments of ${scoring.step}.`);
  return value;
}

export function describeDebateScoring(scoring) {
  return scoring.criteria.length
    ? `${scoring.criteria.map(c => `${c.name} /${c.max}`).join(' + ')} = speaker score out of ${scoring.max}${scoring.min ? ` (minimum ${scoring.min})` : ''}, increments of ${scoring.step}`
    : `Speaker points ${scoring.min}–${scoring.max}, increments of ${scoring.step}`;
}
