import { icon } from './icons.js';
import { supabase } from '../lib/supabase.js';
import { escapeHtml } from '../lib/html.js';
import { teamLabelFromMap } from '../lib/team-display.js';
import { debateScoringFor, speakerScore, describeDebateScoring } from '../../api-shared/debate-scoring.js';

async function loadScoring(tournamentId) {
  try {
    const { data } = await supabase.from('tournaments').select('settings').eq('id', tournamentId).single();
    return debateScoringFor(data?.settings);
  } catch { return debateScoringFor(null); }
}

// One speaker's score cell: a single box, or one box per criterion with a live total.
function scoreCell(scoring, key, value) {
  const attrs = `step="${scoring.step}" inputmode="decimal" required`;
  const valueAttr = value !== undefined && value !== null && value !== '' ? ` value="${escapeHtml(value)}"` : '';
  if (!scoring.criteria.length) return `<input type="number" name="${key}" class="form-input" style="width:80px; padding:6px;" min="${scoring.min}" max="${scoring.max}"${valueAttr} ${attrs} aria-label="${key}">`;
  return `<div style="display:flex; flex-direction:column; gap:4px;">${scoring.criteria.map((c, j) => `<label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748b;"><span style="width:58px;">${escapeHtml(c.name)}</span><input type="number" name="${key}_m${j}" data-total="${key}" class="form-input" style="width:64px; padding:4px;" min="0" max="${c.max}" ${attrs}><span>/${c.max}</span></label>`).join('')}<div style="font-size:12px; font-weight:700;">Total: <span data-total-for="${key}">–</span> / ${scoring.max}</div></div>`;
}

export async function showBallotModal(pairing, onSave, options = {}) {
  const scoring = options.scoring || await loadScoring(pairing.tournament_id);
  const modalRoot = document.getElementById('modal-root');
  const teamMap = options.teamMap || new Map();
  const hideTeamIdentities = Boolean(options.hideTeamIdentities);
  const teams = [
    { pos: 'OG', id: pairing.og_team_id },
    { pos: 'OO', id: pairing.oo_team_id },
    { pos: 'CG', id: pairing.cg_team_id },
    { pos: 'CO', id: pairing.co_team_id }
  ];
  const existingByTeam = new Map((pairing.ballots || []).map(ballot => [ballot.team_id, ballot]));

  modalRoot.innerHTML = `
    <div id="ballot-modal-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999;">
      <div style="background:white; width:min(760px, calc(100vw - 24px)); max-height:calc(100vh - 24px); border-radius:16px; overflow:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <h3 style="font-weight:800; font-size:18px;">Enter Ballot: ${escapeHtml(pairing.room_label || 'Room TBD')}</h3>
            <div style="font-size:12px; color:#64748b;">${escapeHtml(options.judgeRole || 'Adjudicator')} · ${escapeHtml(pairing.rounds?.name || 'Round')} · Enter ranks and speaker points for all teams · ${escapeHtml(describeDebateScoring(scoring))}</div>
          </div>
          <button id="close-ballot" style="border:none; background:none; cursor:pointer; color:#94a3b8;">${icon('x', 24)}</button>
        </div>

        <form id="ballot-form" style="padding:24px;">
          ${pairing.rounds?.motion_text ? `<div style="padding:12px 14px; margin-bottom:16px; border:1px solid #bfdbfe; background:#eff6ff; border-radius:10px;"><div style="font-size:10px; text-transform:uppercase; font-weight:900; color:#1d4ed8; margin-bottom:4px;">Motion</div><strong style="font-size:13px; line-height:1.45;">${escapeHtml(pairing.rounds.motion_text)}</strong></div>` : ''}
          <div style="overflow-x:auto;">
          <table style="width:100%; min-width:560px; border-collapse:collapse; margin-bottom:24px;">
            <thead style="font-size:11px; text-transform:uppercase; color:#64748b; text-align:left;">
              <tr>
                <th style="padding-bottom:12px;">Position / Team</th>
                <th style="padding-bottom:12px;">Rank (1-4)</th>
                <th style="padding-bottom:12px;">S1 Points</th>
                <th style="padding-bottom:12px;">S2 Points</th>
                <th style="padding-bottom:12px; text-align:center;">Partners</th>
              </tr>
            </thead>
            <tbody>
              ${teams.map((t, idx) => {
                const existing = existingByTeam.get(t.id);
                return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:12px 0;">
                    <div style="font-weight:700; font-size:13px;">${t.pos}</div>
                    <div style="font-size:11px; color:#64748b;">${hideTeamIdentities ? `Blind team ${escapeHtml(t.pos)}` : teamLabelFromMap(teamMap, t.id)}</div>
                    <input type="hidden" name="team_${idx}" value="${t.id}">
                  </td>
                  <td style="padding:12px 0;">
                    <select name="rank_${idx}" class="form-input" style="width:80px; padding:6px;" required>
                      <option value="">-</option>
                      <option value="1" ${Number(existing?.rank) === 1 ? 'selected' : ''}>1st</option>
                      <option value="2" ${Number(existing?.rank) === 2 ? 'selected' : ''}>2nd</option>
                      <option value="3" ${Number(existing?.rank) === 3 ? 'selected' : ''}>3rd</option>
                      <option value="4" ${Number(existing?.rank) === 4 ? 'selected' : ''}>4th</option>
                    </select>
                  </td>
                  <td style="padding:12px 0;">${scoreCell(scoring, `s1_${idx}`, existing?.s1_points)}</td>
                  <td style="padding:12px 0;">${scoreCell(scoring, `s2_${idx}`, existing?.s2_points)}</td>
                  <td style="padding:12px 0; text-align:center;">
                    <button type="button" class="btn btn--outline btn--sm" data-swap-speaker-scores="${idx}" title="Switch the two partners' scores" aria-label="Switch Speaker 1 and Speaker 2 scores for ${escapeHtml(t.pos)}">Switch</button>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table></div>

          <div style="font-size:12px; line-height:1.45; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; margin-bottom:16px;">Submitting confirms the official room ballot. Check all four ranks and speaker scores carefully; the tab room must unlock a confirmed ballot before it can be replaced.</div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button type="button" id="cancel-ballot" class="btn btn--outline">Cancel</button>
            <button type="submit" id="save-ballot" class="btn btn--primary">Confirm Ballot</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('ballot-form');
  const marksFor = (fd, key) => scoring.criteria.map((_, j) => fd.get(`${key}_m${j}`));
  form.addEventListener('input', e => {
    const key = e.target.dataset.total; if (!key) return;
    const marks = scoring.criteria.map((_, j) => Number(form.elements[`${key}_m${j}`].value));
    form.querySelector(`[data-total-for="${key}"]`).textContent = marks.every(v => form.elements[`${key}_m0`].value !== '' && Number.isFinite(v)) ? String(Math.round(marks.reduce((a, b) => a + b, 0) * 100) / 100) : '–';
  });
  const closeBtns = [document.getElementById('close-ballot'), document.getElementById('cancel-ballot')];
  
  closeBtns.forEach(btn => btn.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

  form.querySelectorAll('[data-swap-speaker-scores]').forEach(button => {
    button.addEventListener('click', () => {
      const index = button.dataset.swapSpeakerScores;
      const suffixes = scoring.criteria.length ? scoring.criteria.map((_, j) => `_m${j}`) : [''];
      suffixes.forEach(suffix => {
        const speakerOneInput = form.elements.namedItem(`s1_${index}${suffix}`);
        const speakerTwoInput = form.elements.namedItem(`s2_${index}${suffix}`);
        if (!speakerOneInput || !speakerTwoInput) return;
        const speakerOneScore = speakerOneInput.value;
        speakerOneInput.value = speakerTwoInput.value;
        speakerTwoInput.value = speakerOneScore;
      });
      if (scoring.criteria.length) form.querySelector(`[name="s1_${index}_m0"]`)?.dispatchEvent(new Event('input', { bubbles: true }));
      if (scoring.criteria.length) form.querySelector(`[name="s2_${index}_m0"]`)?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const ranks = [formData.get('rank_0'), formData.get('rank_1'), formData.get('rank_2'), formData.get('rank_3')];
    
    // Validation: Unique ranks
    if (new Set(ranks).size !== 4) {
      alert('Error: Each team must have a unique rank (1st to 4th).');
      return;
    }

    if (!confirm('Submit this as the official ballot for the room? Please confirm the ranks and speaker scores are final.')) return;

    const saveBtn = document.getElementById('save-ballot');
    saveBtn.innerHTML = 'Saving...';
    saveBtn.disabled = true;

    try {
      const ballots = teams.map((t, idx) => {
        const rank = parseInt(formData.get(`rank_${idx}`));
        const s1Marks = scoring.criteria.length ? marksFor(formData, `s1_${idx}`) : undefined;
        const s2Marks = scoring.criteria.length ? marksFor(formData, `s2_${idx}`) : undefined;
        const s1 = speakerScore(scoring, { total: s1Marks ? undefined : formData.get(`s1_${idx}`), marks: s1Marks }, `${t.pos} speaker 1`);
        const s2 = speakerScore(scoring, { total: s2Marks ? undefined : formData.get(`s2_${idx}`), marks: s2Marks }, `${t.pos} speaker 2`);
        // BP Points: 1st=3, 2nd=2, 3rd=1, 4th=0
        const points = 4 - rank; 
        
        return {
          tournament_id: pairing.tournament_id,
          pairing_id: pairing.id,
          team_id: t.id,
          rank: rank,
          points: points,
          s1_points: s1,
          s2_points: s2,
          speaker_points: s1 + s2,
          status: 'LOCKED',
          ...(s1Marks ? { s1_marks: s1Marks.map(Number), s2_marks: s2Marks.map(Number) } : {})
        };
      });

      if (options.onSubmit) {
        await options.onSubmit(ballots);
      } else {
        // The ballots table stores speaker totals; criterion marks are validated above, not stored.
        const { error } = await supabase.from('ballots').upsert(ballots.map(({ s1_marks, s2_marks, ...row }) => row), {
          onConflict: 'pairing_id,team_id'
        });
        if (error) throw error;
      }

      modalRoot.innerHTML = '';
      if (onSave) onSave();
    } catch (err) {
      alert(err.message);
      saveBtn.innerHTML = 'Confirm Ballot';
      saveBtn.disabled = false;
    }
  });
}
