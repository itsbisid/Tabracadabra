// Public speaking draw generator ("sectioning"/"paneling"). Server-side and deterministic for a
// given seed, so a draw can be reproduced and explained.
//
// Based on published speech-tab practice (NSDA district manual, Tabroom/SpeechWire docs):
//  * Preliminary sections are as even in size as possible, within the event's min/max heat size.
//  * Priority 1: keep speakers from the same institution apart.
//  * Priority 2: avoid speakers meeting each other again.
//  * Speaking order evens out each speaker's average position, and gives everyone an early
//    (first two) and a late (last two) slot during preliminaries where possible.
//  * Elimination rounds are snaked (serpentine) by standings; speakers with identical standing
//    may be swapped to separate institutions. Elim speaking order is the reverse of past
//    speaking positions: the speaker who has spoken latest overall speaks first.
//  * Judges: not from a speaker's institution, not judging a speaker they have already judged,
//    and spread evenly. Shortages and unavoidable clashes are reported, never hidden.
// This is a heuristic search, not an official algorithm of any governing body.
import { rulesOf, standings } from './ps-engine.js';

const COST = { speakingOrder: 10, sameInstitution: 1000, repeatMeeting: 100, judgeInstitution: 1000, judgeRepeat: 100, judgeLoad: 3 };

// Small seeded PRNG (mulberry32) so a seed always reproduces the same draw.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (items, random) => { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const inst = person => (person?.institution || '').trim().toLowerCase();

// What has happened so far in this event (published rounds only, excluding the round being drawn).
export function drawHistory(event, roundId) {
  const met = new Map(), judged = new Map(), positions = new Map(), judgeLoad = new Map();
  for (const round of event.rounds) {
    if (round.id === roundId || round.status === 'draft') continue;
    for (const room of round.rooms) {
      room.speakers.forEach((a, i) => {
        if (!positions.has(a)) positions.set(a, []);
        positions.get(a).push({ position: i + 1, size: room.speakers.length, stage: round.stage });
        for (const b of room.speakers.slice(i + 1)) met.set(key(a, b), (met.get(key(a, b)) || 0) + 1);
        for (const j of room.judges) judged.set(`${j}|${a}`, (judged.get(`${j}|${a}`) || 0) + 1);
      });
      for (const j of room.judges) judgeLoad.set(j, (judgeLoad.get(j) || 0) + 1);
    }
  }
  return { met, judged, positions, judgeLoad };
}

export function sectionSizes(count, rules, sections) {
  const k = sections ?? Math.ceil(count / rules.maxHeat);
  if (!Number.isInteger(k) || k < 1) throw new Error('Choose at least one section.');
  if (k > count) throw new Error(`${count} speakers cannot fill ${k} sections.`);
  const base = Math.floor(count / k), extra = count % k;
  const sizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  if (sizes[0] > rules.maxHeat) throw new Error(`${k} sections would need ${sizes[0]} speakers in a section; the maximum is ${rules.maxHeat}. Add sections.`);
  if (sizes.at(-1) < rules.minHeat) throw new Error(`${count} speakers in ${k} sections leaves sections of ${sizes.at(-1)}; the minimum is ${rules.minHeat}. Use fewer sections or revise the heat limits.`);
  return sizes;
}

function orderNeeds(ids, history) {
  // How many speakers in a section still need an early (or late) slot beyond the two available.
  let needEarly = 0, needLate = 0;
  for (const id of ids) {
    const p = (history.positions.get(id) || []).filter(x => x.stage === 'preliminary');
    if (!p.length) continue;
    if (!p.some(x => x.position <= 2)) needEarly++;
    if (!p.some(x => x.position > x.size - 2)) needLate++;
  }
  return Math.max(0, needEarly - 2) + Math.max(0, needLate - 2);
}

function sectionCost(ids, people, history) {
  let cost = COST.speakingOrder * orderNeeds(ids, history);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = people.get(ids[i]), b = people.get(ids[j]);
    if (inst(a) && inst(a) === inst(b)) cost += COST.sameInstitution;
    cost += COST.repeatMeeting * (history.met.get(key(ids[i], ids[j])) || 0);
  }
  return cost;
}

// Swap-based local search. `canSwap` restricts swaps (used to keep snake seeding intact).
function improve(sections, people, history, random, canSwap = () => true, attempts = 4000) {
  const costs = sections.map(s => sectionCost(s, people, history));
  for (let t = 0; t < attempts; t++) {
    const x = Math.floor(random() * sections.length), y = Math.floor(random() * sections.length);
    if (x === y || !costs[x] && !costs[y]) continue;
    const i = Math.floor(random() * sections[x].length), j = Math.floor(random() * sections[y].length);
    if (!canSwap(sections[x][i], sections[y][j])) continue;
    const nx = [...sections[x]], ny = [...sections[y]];
    [nx[i], ny[j]] = [ny[j], nx[i]];
    const cx = sectionCost(nx, people, history), cy = sectionCost(ny, people, history);
    if (cx + cy < costs[x] + costs[y]) { sections[x] = nx; sections[y] = ny; costs[x] = cx; costs[y] = cy; }
  }
  return costs.reduce((a, b) => a + b, 0);
}

function balancedSections(ids, sizes, people, history, random) {
  let best = null, bestCost = Infinity;
  for (let restart = 0; restart < 6 && bestCost > 0; restart++) {
    const order = shuffle(ids, random);
    let at = 0;
    const sections = sizes.map(size => { const s = order.slice(at, at + size); at += size; return s; });
    const cost = improve(sections, people, history, random, undefined, Math.max(4000, ids.length * 150));
    if (cost < bestCost) { best = sections; bestCost = cost; }
  }
  return best;
}

// Serpentine: 1..k across, k+1..2k back, and so on. Swaps only between identical standings.
function snakeSections(ids, sizes, people, history, random, event) {
  const table = standings(event, event.rounds.filter(r => r.status === 'completed' && r.stage === 'preliminary'));
  const place = new Map(table.map(r => [r.speakerId, r]));
  const ranked = [...ids].sort((a, b) => (place.get(a)?.place ?? Infinity) - (place.get(b)?.place ?? Infinity) || (people.get(a)?.name || '').localeCompare(people.get(b)?.name || ''));
  const sections = sizes.map(() => []);
  let s = 0, dir = 1;
  for (const id of ranked) {
    while (sections[s].length >= sizes[s]) s = (s + dir + sizes.length) % sizes.length;
    sections[s].push(id);
    const next = s + dir;
    if (next < 0 || next >= sizes.length) dir = -dir; else s = next;
  }
  const tieKey = id => place.has(id) ? `${place.get(id).score}|${place.get(id).rankTotal}` : 'unranked';
  improve(sections, people, history, random, (a, b) => tieKey(a) === tieKey(b), ids.length * 100);
  return { sections, seeds: new Map(ranked.map((id, i) => [id, i + 1])) };
}

function orderSpeakers(section, stage, history, random) {
  const past = id => history.positions.get(id) || [];
  if (stage !== 'preliminary') {
    // Reverse of past positions: highest total of past speaking positions speaks first.
    return [...section].sort((a, b) => past(b).reduce((t, p) => t + p.position, 0) - past(a).reduce((t, p) => t + p.position, 0) || random() - 0.5);
  }
  const n = section.length;
  const profile = new Map(section.map(id => {
    const p = past(id).filter(x => x.stage === 'preliminary');
    const mean = p.length ? p.reduce((t, x) => t + (x.size > 1 ? (x.position - 1) / (x.size - 1) : 0.5), 0) / p.length : 0.5;
    return [id, { mean, seen: p.length > 0, early: p.some(x => x.position <= 2), late: p.some(x => x.position > x.size - 2), jitter: random() * 0.01 }];
  }));
  const slotCost = (id, i) => {
    const x = n > 1 ? i / (n - 1) : 0.5, s = profile.get(id);
    let c = (x - (1 - s.mean)) ** 2 + s.jitter * x;
    // Missing an early or late slot so far outweighs fine balancing of the average.
    if (!s.early && i > 1) c += 3;
    if (!s.late && i < n - 2) c += 3;
    // Someone who still needs both ends must not be left in the middle again.
    if (s.seen && !s.early && !s.late && i > 1 && i < n - 2) c += 4;
    return c;
  };
  const order = shuffle(section, random);
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (slotCost(order[j], i) + slotCost(order[i], j) < slotCost(order[i], i) + slotCost(order[j], j) - 1e-9) { [order[i], order[j]] = [order[j], order[i]]; changed = true; }
    }
  }
  return order;
}

function assignJudges(sections, judges, panel, people, history, random) {
  const used = new Set(), panels = sections.map(() => []);
  const load = new Map(judges.map(j => [j.id, history.judgeLoad.get(j.id) || 0]));
  const cost = (judge, section) => {
    let c = COST.judgeLoad * load.get(judge.id) + random() * 0.5;
    for (const id of section) {
      if (inst(judge) && inst(judge) === inst(people.get(id))) c += COST.judgeInstitution;
      c += COST.judgeRepeat * (history.judged.get(`${judge.id}|${id}`) || 0);
    }
    return c;
  };
  // Fill the first seat of every section before any second seat, hardest sections first.
  for (let seat = 0; seat < panel; seat++) {
    const order = sections.map((s, i) => i).sort((a, b) => Math.min(...judges.filter(j => !used.has(j.id)).map(j => cost(j, sections[b])), Infinity) - Math.min(...judges.filter(j => !used.has(j.id)).map(j => cost(j, sections[a])), Infinity));
    for (const i of order) {
      const options = judges.filter(j => !used.has(j.id)).sort((a, b) => cost(a, sections[i]) - cost(b, sections[i]));
      if (!options.length) break;
      used.add(options[0].id); panels[i].push(options[0].id);
    }
  }
  return panels;
}

// Proposes rooms for a draft round. Nothing is saved until tab reviews and saves the draw.
export function proposeDraw(event, round, input = {}) {
  const rules = rulesOf(event);
  const seed = String(input.seed || Math.random().toString(36).slice(2, 10)).slice(0, 40);
  const random = rng(seed);
  const method = input.method || (round.stage === 'preliminary' ? 'balanced' : 'snake');
  if (!['balanced', 'snake'].includes(method)) throw new Error('Choose a balanced or snake draw.');
  const people = new Map([...event.speakers, ...event.judges].map(p => [p.id, p]));
  const ids = round.speakerIds.filter(id => people.get(id)?.active);
  if (!ids.length) throw new Error('This round has no active speakers.');
  const sizes = sectionSizes(ids.length, rules, input.sections == null ? undefined : Number(input.sections));
  const history = drawHistory(event, round.id);
  const judges = event.judges.filter(j => j.active);
  const panel = round.stage === 'preliminary' ? rules.panelSize : rules.finalPanelSize;

  let sections, seeds = null;
  if (method === 'snake') ({ sections, seeds } = snakeSections(ids, sizes, people, history, random, event));
  else sections = balancedSections(ids, sizes, people, history, random);
  sections = sections.map(s => orderSpeakers(s, round.stage, history, random));
  const panels = assignJudges(sections, judges, panel, people, history, random);
  const names = Array.isArray(input.roomNames) ? input.roomNames : [];
  const rooms = sections.map((speakers, i) => ({ name: String(names[i] || `Section ${i + 1}`).slice(0, 160), speakers, judges: panels[i] }));

  const nameOf = id => people.get(id)?.name || 'Unknown';
  const report = { seed, method, sections: sizes.length, sizes, panel, sameInstitution: [], repeatMeetings: [], judgeIssues: [], notes: [] };
  rooms.forEach(room => {
    room.speakers.forEach((a, i) => room.speakers.slice(i + 1).forEach(b => {
      if (inst(people.get(a)) && inst(people.get(a)) === inst(people.get(b))) report.sameInstitution.push(`${room.name}: ${nameOf(a)} and ${nameOf(b)} (${people.get(a).institution})`);
      if (history.met.get(key(a, b))) report.repeatMeetings.push(`${room.name}: ${nameOf(a)} and ${nameOf(b)} have met before`);
    }));
    if (room.judges.length < panel) report.judgeIssues.push(`${room.name}: ${room.judges.length} of ${panel} judges assigned (not enough active judges).`);
    for (const j of room.judges) for (const s of room.speakers) {
      if (inst(people.get(j)) && inst(people.get(j)) === inst(people.get(s))) report.judgeIssues.push(`${room.name}: ${nameOf(j)} shares an institution with ${nameOf(s)}.`);
      if (history.judged.get(`${j}|${s}`)) report.judgeIssues.push(`${room.name}: ${nameOf(j)} has judged ${nameOf(s)} before.`);
    }
  });
  if (method === 'snake') report.notes.push('Speakers are snaked by preliminary standings (1st to Section 1, 2nd to Section 2 … then back). Only speakers with identical standings were swapped to separate institutions.');
  else report.notes.push('Sections were drawn at random, then improved to keep institutions apart and avoid repeat meetings.');
  report.notes.push(round.stage === 'preliminary' ? 'Speaking order balances each speaker’s average position and gives everyone an early and a late slot where possible.' : 'Speaking order is the reverse of past positions: whoever has spoken latest overall speaks first.');
  if (judges.length < sizes.length * panel) report.notes.push(`${judges.length} active judges for ${sizes.length} sections × ${panel}: run sections in waves or add judges.`);
  report.seeds = seeds ? Object.fromEntries(seeds) : undefined;
  return { rooms, report };
}
