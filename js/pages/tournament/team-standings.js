import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { BPEngine } from '../../lib/bp-engine.js';
import { isTabVisible, isAdmin } from '../../lib/auth-helpers.js';

export async function renderTeamStandings(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  const fetchAndRender = async () => {
    const visible = await isTabVisible(tournamentId);
    
    if (!visible) {
      renderBlindUI();
      return;
    }

    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: ballots } = await supabase.from('ballots').select('*').eq('tournament_id', tournamentId);
    
    const standings = (teams || []).map(team => {
      const teamBallots = ballots?.filter(b => b.team_id === team.id) || [];
      const points = teamBallots.reduce((acc, b) => acc + (b.points || 0), 0);
      const speaks = teamBallots.reduce((acc, b) => acc + (b.speaker_points || 0), 0);
      return { ...team, points, speaks };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.speaks - a.speaks;
    });

    renderUI(standings, await isAdmin(tournamentId));
  };

  const renderBlindUI = () => {
    const content = `
      <div style="min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:32px;">
        <div style="font-size:48px; margin-bottom:16px;">🔒</div>
        <h2 style="font-weight:800; font-size:20px; color:var(--color-text); margin-bottom:8px;">Tab is currently blind</h2>
        <p style="color:#64748b; max-width:400px; line-height:1.6;">Standings are hidden during the preliminary rounds to maintain tournament integrity. Results will be published after the break announcement.</p>
      </div>
    `;
    renderAppLayout(container, '/tournament/team-standings', 'Team Standings', '', content);
  };

  window.tcPublishTab = async () => {
    if (confirm('CRITICAL: Are you sure you want to PUBLISH the tab? This will make all rankings and speaker points public to everyone instantly.')) {
      const { error } = await supabase.from('tournaments').update({ is_tab_released: true }).eq('id', tournamentId);
      if (error) alert(error.message);
      else {
        alert('Tournament results have been published!');
        fetchAndRender();
      }
    }
  };

  const renderUI = (standings, isUserAdmin) => {
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Team Standings</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Ranked by Points, then total Speaker Points</div>
        </div>
        ${isUserAdmin ? `
          <button onclick="window.tcPublishTab()" class="btn btn--sm" style="background:#0044b3; color:white;">${icon('send', 14)} Publish Tab</button>
        ` : ''}
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; width:60px;">Rank</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Team</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Institution</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:center;">Points</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:right;">Speaks</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;">
                <td style="padding:16px; font-weight:800; color:${i < 4 ? 'var(--color-primary)' : '#64748b'};">#${i + 1}</td>
                <td style="padding:16px;">
                  <div style="font-weight:700;">${s.name}</div>
                </td>
                <td style="padding:16px; color:#64748b;">${s.institution || '-'}</td>
                <td style="padding:16px; text-align:center;">
                  <span class="badge" style="background:var(--color-primary); color:white; font-weight:700; min-width:32px; display:inline-block;">${s.points}</span>
                </td>
                <td style="padding:16px; text-align:right; font-weight:600; color:#1e293b;">${s.speaks.toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${standings.length === 0 ? `
          <div style="padding:64px; text-align:center; color:#64748b;">
            <p>No confirmed results found in the system yet.</p>
          </div>
        ` : ''}
      </div>
    `;

    renderAppLayout(container, '/tournament/team-standings', 'Standings', '', content);
  };

  fetchAndRender();
}
