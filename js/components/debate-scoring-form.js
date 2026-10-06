// Debate speaker-scoring editor, shared by the tournament wizard and the Settings page.
import { escapeHtml } from '../lib/html.js';
import { validateDebateScoring, describeDebateScoring, DEBATE_CRITERIA_EXAMPLE, LEGACY_DEBATE_SCORING } from '../../api-shared/debate-scoring.js';

const criterionRow = (c = {}) => `<div class="tc-debate-criterion" style="display:grid; grid-template-columns:1fr 120px auto; gap:8px; align-items:center;"><input class="form-input" name="debateCriterionName" placeholder="e.g. Matter" value="${escapeHtml(c.name || '')}" maxlength="60" aria-label="Criterion name"><input class="form-input" type="number" name="debateCriterionMax" placeholder="Max" value="${c.max ?? ''}" min="1" max="100" step="any" aria-label="Criterion maximum"><button type="button" class="btn btn--outline" data-debate-remove>Remove</button></div>`;

export function debateScoringFieldset(s = LEGACY_DEBATE_SCORING) {
  return `
            <fieldset style="border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px;">
              <legend style="font-weight:600; font-size:14px; padding:0 6px;">How speakers are scored</legend>
              <label style="display:flex; gap:8px; align-items:flex-start; font-size:14px;"><input type="radio" name="debateScoreMode" value="single" ${s.criteria.length ? '' : 'checked'} data-debate-mode> <span><strong>One score per speaker</strong><br><span style="font-size:12px; color:var(--color-text-muted);">Judges give each speaker a single score within a range.</span></span></label>
              <label style="display:flex; gap:8px; align-items:flex-start; font-size:14px;"><input type="radio" name="debateScoreMode" value="criteria" ${s.criteria.length ? 'checked' : ''} data-debate-mode> <span><strong>Score by criteria</strong><br><span style="font-size:12px; color:var(--color-text-muted);">Choose your own criteria (e.g. Matter, Manner, Method). Each speaker's score is the total.</span></span></label>
              <div id="debate-single" style="display:${s.criteria.length ? 'none' : 'grid'}; grid-template-columns:1fr 1fr; gap:16px;">
                <div><label for="tournament-min-points" style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Minimum</label><input type="number" id="tournament-min-points" class="form-input" value="${s.criteria.length ? 60 : s.min}"></div>
                <div><label for="tournament-max-points" style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Maximum</label><input type="number" id="tournament-max-points" class="form-input" value="${s.criteria.length ? 80 : s.max}"></div>
              </div>
              <div id="debate-criteria" style="display:${s.criteria.length ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
                <div id="debate-criteria-rows" style="display:flex; flex-direction:column; gap:8px;">${(s.criteria.length ? s.criteria : DEBATE_CRITERIA_EXAMPLE).map(criterionRow).join('')}</div>
                <div style="display:flex; gap:12px; align-items:end; flex-wrap:wrap;">
                  <button type="button" class="btn btn--outline" data-debate-add>Add criterion</button>
                  <div><label for="tournament-criteria-min" style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Lowest allowed total (optional)</label><input type="number" id="tournament-criteria-min" class="form-input" value="${s.criteria.length ? s.min : 0}" min="0" style="width:140px;"></div>
                </div>
              </div>
              <div><label for="tournament-point-step" style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Increments</label>
                <select id="tournament-point-step" class="form-input form-select" style="max-width:200px;"><option value="1" ${s.step === 1 ? 'selected' : ''}>Whole points (1)</option><option value="0.5" ${s.step === 0.5 ? 'selected' : ''}>Half points (0.5)</option></select></div>
              <div id="debate-scoring-summary" aria-live="polite" style="font-size:13px; padding:10px 12px; border-radius:8px; background:#F1F5F9;"></div>
            </fieldset>`;
}

export function readDebateScoring(root) {
  const mode = root.querySelector('input[name="debateScoreMode"]:checked')?.value || 'single';
  const step = Number(root.querySelector('#tournament-point-step').value);
  if (mode === 'single') return validateDebateScoring({ min: Number(root.querySelector('#tournament-min-points').value), max: Number(root.querySelector('#tournament-max-points').value), step, criteria: [] });
  const names = [...root.querySelectorAll('[name="debateCriterionName"]')].map(el => el.value), maxes = [...root.querySelectorAll('[name="debateCriterionMax"]')].map(el => Number(el.value));
  const criteria = names.map((name, i) => ({ name, max: maxes[i] })).filter(c => c.name.trim());
  if (!criteria.length) throw new Error('Add at least one debate scoring criterion, or choose a single score per speaker.');
  return validateDebateScoring({ min: Number(root.querySelector('#tournament-criteria-min').value || 0), step, criteria });
}

export function wireDebateScoring(root) {
  const summary = () => {
    const box = root.querySelector('#debate-scoring-summary');
    try { box.textContent = describeDebateScoring(readDebateScoring(root)); box.style.color = ''; }
    catch (error) { box.textContent = error.message; box.style.color = 'var(--color-danger)'; }
  };
  root.addEventListener('click', e => {
    if (e.target.closest('[data-debate-remove]')) { e.target.closest('.tc-debate-criterion').remove(); summary(); }
    if (e.target.closest('[data-debate-add]')) { root.querySelector('#debate-criteria-rows').insertAdjacentHTML('beforeend', criterionRow()); summary(); }
  });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-debate-mode]')) {
      const criteria = e.target.value === 'criteria';
      root.querySelector('#debate-single').style.display = criteria ? 'none' : 'grid';
      root.querySelector('#debate-criteria').style.display = criteria ? 'flex' : 'none';
    }
    summary();
  });
  root.addEventListener('input', summary);
  summary();
}
