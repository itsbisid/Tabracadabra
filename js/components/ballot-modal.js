import { icon } from './icons.js';
import { supabase } from '../lib/supabase.js';

export function showBallotModal(pairing, onSave) {
  const modalRoot = document.getElementById('modal-root');
  const teams = [
    { pos: 'OG', id: pairing.og_team_id },
    { pos: 'OO', id: pairing.oo_team_id },
    { pos: 'CG', id: pairing.cg_team_id },
    { pos: 'CO', id: pairing.co_team_id }
  ];

  modalRoot.innerHTML = `
    <div id="ballot-modal-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999;">
      <div style="background:white; width:650px; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="font-weight:800; font-size:18px;">Enter Ballot: ${pairing.room_label}</h3>
            <div style="font-size:12px; color:#64748b;">Enter ranks and speaker points for all teams</div>
          </div>
          <button id="close-ballot" style="border:none; background:none; cursor:pointer; color:#94a3b8;">${icon('x', 24)}</button>
        </div>

        <form id="ballot-form" style="padding:24px;">
          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
            <thead style="font-size:11px; text-transform:uppercase; color:#64748b; text-align:left;">
              <tr>
                <th style="padding-bottom:12px;">Position / Team</th>
                <th style="padding-bottom:12px;">Rank (1-4)</th>
                <th style="padding-bottom:12px;">S1 Points</th>
                <th style="padding-bottom:12px;">S2 Points</th>
              </tr>
            </thead>
            <tbody>
              ${teams.map((t, idx) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:12px 0;">
                    <div style="font-weight:700; font-size:13px;">${t.pos}</div>
                    <div style="font-size:11px; color:#64748b;">${t.id}</div>
                    <input type="hidden" name="team_${idx}" value="${t.id}">
                  </td>
                  <td style="padding:12px 0;">
                    <select name="rank_${idx}" class="form-input" style="width:80px; padding:6px;" required>
                      <option value="">-</option>
                      <option value="1">1st</option>
                      <option value="2">2nd</option>
                      <option value="3">3rd</option>
                      <option value="4">4th</option>
                    </select>
                  </td>
                  <td style="padding:12px 0;">
                    <input type="number" name="s1_${idx}" class="form-input" style="width:80px; padding:6px;" min="60" max="80" value="75" required>
                  </td>
                  <td style="padding:12px 0;">
                    <input type="number" name="s2_${idx}" class="form-input" style="width:80px; padding:6px;" min="60" max="80" value="75" required>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button type="button" id="cancel-ballot" class="btn btn--outline">Cancel</button>
            <button type="submit" id="save-ballot" class="btn btn--primary">Confirm Ballot</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('ballot-form');
  const closeBtns = [document.getElementById('close-ballot'), document.getElementById('cancel-ballot')];
  
  closeBtns.forEach(btn => btn.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const ranks = [formData.get('rank_0'), formData.get('rank_1'), formData.get('rank_2'), formData.get('rank_3')];
    
    // Validation: Unique ranks
    if (new Set(ranks).size !== 4) {
      alert('Error: Each team must have a unique rank (1st to 4th).');
      return;
    }

    const saveBtn = document.getElementById('save-ballot');
    saveBtn.innerHTML = 'Saving...';
    saveBtn.disabled = true;

    try {
      const ballots = teams.map((t, idx) => {
        const rank = parseInt(formData.get(`rank_${idx}`));
        const s1 = parseFloat(formData.get(`s1_${idx}`));
        const s2 = parseFloat(formData.get(`s2_${idx}`));
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
          speaker_points: s1 + s2
        };
      });

      const { error } = await supabase.from('ballots').upsert(ballots);
      if (error) throw error;

      modalRoot.innerHTML = '';
      if (onSave) onSave();
    } catch (err) {
      alert(err.message);
      saveBtn.innerHTML = 'Confirm Ballot';
      saveBtn.disabled = false;
    }
  });
}
