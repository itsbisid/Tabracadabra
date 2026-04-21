import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderMotions(container) {
  const tournamentId = localStorage.getItem('active_tournament_id');

  const fetchAndRender = async () => {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_num', { ascending: true });

    renderUI(rounds || []);
  };

  window.tcSaveMotion = async (roundId) => {
    const text = document.getElementById(`motion-text-${roundId}`).value;
    const info = document.getElementById(`motion-info-${roundId}`).value;
    
    const { error } = await supabase
      .from('rounds')
      .update({ motion_text: text, motion_info: info })
      .eq('id', roundId);

    if (error) alert(error.message);
    else fetchAndRender();
  };

  const renderUI = (rounds) => {
    const motionsHtml = rounds.map(r => `
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; margin-bottom:24px; overflow:hidden;">
        <div style="background:#f8fafc; padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
           <div style="font-weight:700; color:var(--color-text);">Round ${r.round_num}: ${r.name}</div>
           <span class="badge ${r.motion_text ? 'badge--active' : 'badge--draft'}">${r.motion_text ? 'SET' : 'PENDING'}</span>
        </div>
        <div style="padding:20px;">
           <div style="display:flex; flex-direction:column; gap:16px;">
             <div>
               <label style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:8px;">Motion InfoSlide (Context)</label>
               <textarea id="motion-info-${r.id}" rows="2" class="form-input" placeholder="Optional context...">${r.motion_info || ''}</textarea>
             </div>
             <div>
               <label style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:8px;">Motion Text (THBT...)</label>
               <textarea id="motion-text-${r.id}" rows="3" class="form-input" placeholder="The motion for this round...">${r.motion_text || ''}</textarea>
             </div>
             <div style="display:flex; justify-content:flex-end;">
               <button onclick="window.tcSaveMotion('${r.id}')" class="btn btn--primary btn--sm" style="gap:8px;">${icon('check', 14)} Save Motion for Round ${r.round_num}</button>
             </div>
           </div>
        </div>
      </div>
    `).join('');

    const content = `
      <div style="margin-bottom:32px;">
        <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px;">Motions</h1>
        <div style="font-size:16px; color:var(--color-text-muted);">Set and release debate topics for each round</div>
      </div>

      ${rounds.length === 0 ? `
        <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:64px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">📜</div>
          <h3 style="font-weight:700; margin-bottom:8px;">No rounds created yet</h3>
          <p style="color:#64748b; font-size:14px;">Motions are tied to tournament rounds. Create a round in the "Debate Rounds" section first.</p>
          <button onclick="window.tcNavigate('/tournament/debate-rounds')" class="btn btn--primary mt-lg">Go to Rounds</button>
        </div>
      ` : motionsHtml}
    `;

    renderAppLayout(container, '/tournament/motions', 'Motions', 'Manage debate topics', content);
  };

  fetchAndRender();
}
