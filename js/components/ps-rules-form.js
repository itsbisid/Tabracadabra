// Public speaking rules form, shared by the PS workspace and the tournament creation wizard.
import { h, button, field, input, select, table } from './ps-ui.js';

export const PS_DEFAULT_RUBRIC = [{ name: 'Content', max: 40, weight: 40 }, { name: 'Delivery', max: 40, weight: 40 }, { name: 'Structure', max: 20, weight: 20 }];
// Editable starting points only. They are not official rules for any competition.
export const PS_PRESETS = {
  prepared: { label: 'Prepared speech (example)', type: 'Prepared speech', rubric: [{ id: 'content', name: 'Content', max: 40, weight: 40 }, { id: 'delivery', name: 'Delivery', max: 35, weight: 35 }, { id: 'language', name: 'Language', max: 25, weight: 25 }], durationSeconds: 300, preparationSeconds: 0 },
  impromptu: { label: 'Impromptu (example)', type: 'Impromptu speech', rubric: [{ id: 'ideas', name: 'Ideas', max: 30, weight: 30 }, { id: 'organisation', name: 'Organisation', max: 30, weight: 30 }, { id: 'delivery', name: 'Delivery', max: 40, weight: 40 }], durationSeconds: 180, preparationSeconds: 120 },
  interpretation: { label: 'Programme of Oral Interpretation (example)', type: 'Programme of Oral Interpretation', rubric: [{ id: 'interpretation', name: 'Interpretation', max: 40, weight: 40 }, { id: 'performance', name: 'Performance', max: 40, weight: 40 }, { id: 'selection', name: 'Selection', max: 20, weight: 20 }], durationSeconds: 600, preparationSeconds: 0 }
};
const num = (fd, name) => Number(fd.get(name));
export function readPSRules(fd) {
  const all = name => fd.getAll(name);
  return {
    name: fd.get('name'), type: fd.get('type'), scoring: fd.get('scoring'), aggregation: fd.get('aggregation'), rankPolicy: fd.get('rankPolicy'), precision: num(fd, 'precision'),
    rubric: all('criterionName').map((name, i) => ({ id: all('criterionId')[i] || undefined, name, description: all('criterionDescription')[i] || '', max: Number(all('criterionMax')[i]), weight: Number(all('criterionWeight')[i]), step: Number(all('criterionStep')[i] || 1) })),
    minHeat: num(fd, 'minHeat'), maxHeat: num(fd, 'maxHeat'), panelSize: num(fd, 'panelSize'), finalPanelSize: num(fd, 'finalPanelSize'), roomCount: num(fd, 'roomCount'),
    preliminaryRounds: num(fd, 'preliminaryRounds'), breakSize: num(fd, 'breakSize'), feedbackPolicy: fd.get('feedbackPolicy'),
    durationSeconds: num(fd, 'durationSeconds'), preparationSeconds: num(fd, 'preparationSeconds'), graceSeconds: num(fd, 'graceSeconds'), changeoverSeconds: num(fd, 'changeoverSeconds'),
    deliberationSeconds: num(fd, 'deliberationSeconds'), travelSeconds: num(fd, 'travelSeconds'),
    penalty: { method: fd.get('penaltyMethod'), pointsPerStep: num(fd, 'penaltyPoints'), stepSeconds: num(fd, 'penaltyStep') || 10, cap: num(fd, 'penaltyCap') }
  };
}
const n = (name, value, attrs) => input(name, value, `type="number" ${attrs}`);

export function psRulesFields(state = null, creating = !state) {
    const r = state || {}, rubric = r.rubric || PS_DEFAULT_RUBRIC, pen = r.penalty || { method: 'none', pointsPerStep: 1, stepSeconds: 10, cap: 5 };
    return `
      ${!creating ? '' : `<div class="ps-actions">${field('Start from an example template', select('preset', [['', 'Choose a template (optional)'], ...Object.entries(PS_PRESETS).map(([id, p]) => [id, p.label])]))}</div><p class="ps-help">Templates are editable examples, not official competition rules.</p>`}
      ${field('Event name', input('name', r.name || '', 'placeholder="e.g. GUDC Prepared Speech" required maxlength="160"'))}
      <div class="ps-grid">${field('Event type', select('type', ['Prepared speech', 'Impromptu speech', 'Programme of Oral Interpretation', 'Other'].map(x => [x, x]), r.type))}${field('Tabulation', select('scoring', [['score', 'Weighted score (highest wins)'], ['rank', 'Rank-based (lowest mean rank wins)']], r.scoring))}${field('Panel scores', select('aggregation', [['mean', 'Average the judges'], ['sum', 'Add the judges together']], r.aggregation))}</div>
      <fieldset><legend>Scoring rubric</legend><p class="ps-help">Each criterion counts as (mark ÷ maximum) × weight, so a judge's total is out of 100. Weights must total 100. Rules freeze when the first round is created.</p><div id="ps-criteria">${rubric.map((c, i) => psRubricRow(c, i)).join('')}</div>${button('Add criterion', 'type="button" data-action="criterion"', true)}</fieldset>
      <fieldset><legend>Heats and judging panels</legend><div class="ps-grid">${field('Physical rooms available', n('roomCount', r.roomCount ?? 8, 'min="1" max="100" required'))}${field('Min speakers per heat', n('minHeat', r.minHeat ?? 2, 'min="1" max="50" required'))}${field('Max speakers per heat', n('maxHeat', r.maxHeat ?? 6, 'min="1" max="50" required'))}${field('Judges per heat (preliminaries)', n('panelSize', r.panelSize ?? 2, 'min="1" max="10" required'))}${field('Judges per heat (finals)', n('finalPanelSize', r.finalPanelSize ?? 3, 'min="1" max="10" required'))}</div></fieldset>
      <fieldset><legend>Timing</legend><div class="ps-grid">${field('Speech length (seconds)', n('durationSeconds', r.durationSeconds ?? 180, 'min="30" max="3600" required'))}${field('Grace period (seconds)', n('graceSeconds', r.graceSeconds ?? 15, 'min="0" max="600" required'))}${field('Overtime penalty', select('penaltyMethod', [['none', 'No automatic penalty'], ['overtime', 'Deduct points for overtime']], pen.method))}</div>
        <div class="ps-grid" data-penalty ${pen.method === 'overtime' ? '' : 'hidden'}>${field('Points deducted per step', n('penaltyPoints', pen.pointsPerStep ?? 1, 'min="0" max="100" step="any"'))}${field('Step length (seconds over)', n('penaltyStep', pen.stepSeconds ?? 10, 'min="1" max="600"'))}${field('Maximum deduction', n('penaltyCap', pen.cap ?? 5, 'min="0" max="100" step="any"'))}</div>
        <p class="ps-help">With a penalty, judges or timekeepers record each speaker's elapsed time on the ballot. A browser timer is never treated as the official time.</p></fieldset>
      <details class="ps-advanced"><summary>Advanced settings</summary>
        <div class="ps-grid">${field('Rank progression', select('rankPolicy', [['equal-heats', 'Compare rank totals (equal heat sizes required)'], ['within-heat', 'Compare relative position within each heat']], r.rankPolicy))}${field('Decimal places shown', n('precision', r.precision ?? 2, 'min="0" max="4" required'))}${field('Preliminary rounds', n('preliminaryRounds', r.preliminaryRounds ?? 3, 'min="1" max="20" required'))}${field('Break size', n('breakSize', r.breakSize ?? 12, 'min="1" max="2000" required'))}${field('Feedback', select('feedbackPolicy', [['together', 'Submitted with scores'], ['scores-first', 'Scores first, feedback by a later deadline']], r.feedbackPolicy))}</div>
        <div class="ps-grid">${field('Preparation time (seconds)', n('preparationSeconds', r.preparationSeconds ?? 0, 'min="0" max="7200" required'))}${field('Changeover between speakers (s)', n('changeoverSeconds', r.changeoverSeconds ?? 30, 'min="0" max="600" required'))}${field('Judge deliberation (s)', n('deliberationSeconds', r.deliberationSeconds ?? 300, 'min="0" max="3600" required'))}${field('Travel buffer between rooms (s)', n('travelSeconds', r.travelSeconds ?? 120, 'min="0" max="3600" required'))}</div>
      </details>
      <section class="ps-preview" aria-live="polite"><h3>Calculation preview</h3><div id="ps-rule-preview"><p class="ps-help">Change any setting to see a sample ballot worked through.</p></div></section>
`;
  }
export function psRubricRow(c, i) { return `<div class="ps-grid ps-criterion"><input type="hidden" name="criterionId" value="${h(c.id || '')}">${field(`Criterion ${i + 1}`, input('criterionName', c.name, 'required maxlength="160"'))}${field('Max marks', n('criterionMax', c.max, 'min="1" max="1000" step="any" required'))}${field('Weight (%)', n('criterionWeight', c.weight, 'min="0.01" max="100" step="any" required'))}${field('Mark increments', n('criterionStep', c.step || 1, 'min="0.01" step="any" required'))}${field('Description (optional)', input('criterionDescription', c.description || '', 'maxlength="1000"'))}${button('Remove', 'type="button" data-action="remove-criterion"', true)}</div>`; }
export function psPreviewHtml({ rules, sample }) {
    const rows = rules.rubric.map((c, i) => [h(c.name), `${sample.scores[i]} / ${c.max}`, `${c.weight}%`, `${sample.scores[i]} ÷ ${c.max} × ${c.weight} = ${Number(sample.result.breakdown[i].contribution).toFixed(rules.precision)}`]);
    const penalty = Number(sample.result.penalty);
    return `${table(['Criterion', 'Sample mark', 'Weight', 'Contribution'], rows)}<p>${penalty ? `Before penalty ${Number(sample.result.beforePenalty).toFixed(rules.precision)}; overtime of ${sample.elapsedSeconds - rules.durationSeconds - rules.graceSeconds}s past the grace period deducts ${penalty}. ` : ''}<strong>Judge total: ${sample.result.total.toFixed(rules.precision)} / 100.</strong> ${rules.aggregation === 'mean' ? 'The room score is the average of the judges’ totals.' : 'The room score is the sum of the judges’ totals.'} ${rules.scoring === 'rank' ? 'Standings use ranks first; scores break ties.' : 'Standings use scores first; mean ranks break ties.'}</p>`;
  }

// Live behaviour: calculation preview, template picker, penalty toggle, add/remove criteria.
// `request` performs the preview call; `onPreset` lets the host re-render with a template.
export function wirePSRules(root, { request, creating = () => true }) {
  let timer;
  const formOf = el => el.closest('[data-ps-rules]');
  const preview = holder => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const target = holder.querySelector('#ps-rule-preview'); if (!target) return;
      try { target.innerHTML = psPreviewHtml(await request(readPSRules(formDataOf(holder)))); }
      catch (error) { target.innerHTML = `<p class="ps-error" role="alert">${h(error.message)}</p>`; }
    }, 400);
  };
  root.addEventListener('input', e => { const holder = formOf(e.target); if (holder) preview(holder); });
  root.addEventListener('change', e => {
    const holder = formOf(e.target); if (!holder) return;
    if (e.target.name === 'penaltyMethod') holder.querySelector('[data-penalty]').hidden = e.target.value !== 'overtime';
    if (e.target.name === 'preset' && PS_PRESETS[e.target.value]) {
      const name = holder.querySelector('[name="name"]').value;
      holder.innerHTML = psRulesFields({ ...PS_PRESETS[e.target.value], name }, creating());
    }
    preview(holder);
  });
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn || !formOf(btn)) return;
    if (btn.dataset.action === 'criterion') { const target = formOf(btn).querySelector('#ps-criteria'); target.insertAdjacentHTML('beforeend', psRubricRow({ name: '', max: 20, weight: 20, step: 1 }, target.children.length)); }
    if (btn.dataset.action === 'remove-criterion') btn.closest('.ps-criterion').remove();
  });
}

// FormData for the rules inside a holder element (works whether or not it is a <form>).
export function formDataOf(holder) {
  const fd = new FormData();
  holder.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => fd.append(el.name, el.value));
  return fd;
}
