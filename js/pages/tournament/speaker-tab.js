import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { isTabVisible, isAdmin } from '../../lib/auth-helpers.js';

export async function renderSpeakerTab(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';
  let activeFilter = 'OPEN'; // OPEN, NOVICE, ESL, EFL

  const fetchAndRender = async () => {
    const visible = await isTabVisible(tournamentId);
    if (!visible) {
      renderBlindUI();
      return;
    }

    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: ballots } = await supabase.from('ballots').select('*').eq('tournament_id', tournamentId);
    
    // Map ballots to individual speakers
    const speakerMap = {};

    (teams || []).forEach(team => {
      // Initialize speakers
      const s1Key = `${team.id}_s1`;
      const s2Key = `${team.id}_s2`;
      
      speakerMap[s1Key] = { name: team.speaker1_name, team: team.name, eligibility: team.speaker1_eligibility || 'OPEN', points: [], total: 0 };
      speakerMap[s2Key] = { name: team.speaker2_name, team: team.name, eligibility: team.speaker2_eligibility || 'OPEN', points: [], total: 0 };
      
      const teamBallots = ballots?.filter(b => b.team_id === team.id) || [];
      teamBallots.forEach(b => {
        speakerMap[s1Key].points.push(b.s1_points || 0);
        speakerMap[s2Key].points.push(b.s2_points || 0);
      });

      // Calculate totals
      speakerMap[s1Key].total = speakerMap[s1Key].points.reduce((a, b) => a + b, 0);
      speakerMap[s2Key].total = speakerMap[s2Key].points.reduce((a, b) => a + b, 0);
      speakerMap[s1Key].avg = speakerMap[s1Key].points.length ? (speakerMap[s1Key].total / speakerMap[s1Key].points.length).toFixed(2) : '0.00';
      speakerMap[s2Key].avg = speakerMap[s2Key].points.length ? (speakerMap[s2Key].total / speakerMap[s2Key].points.length).toFixed(2) : '0.00';
    });

    const speakers = Object.values(speakerMap)
      .filter(s => activeFilter === 'OPEN' || s.eligibility === activeFilter)
      .sort((a, b) => b.total - a.total || b.avg - a.avg);

    renderUI(speakers);
  };

  const renderBlindUI = () => {
    const content = `
      <div style="min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:32px;">
        <div style="font-size:48px; margin-bottom:16px;">🎤</div>
        <h2 style="font-weight:800; font-size:20px; color:var(--color-text); margin-bottom:8px;">Speaker Tab is blind</h2>
        <p style="color:#64748b; max-width:400px; line-height:1.6;">Individual rankings are hidden until the final break announcement to ensure a fair and focused environment.</p>
      </div>
    `;
    renderAppLayout(container, '/tournament/speaker-tab', 'Speaker Tab', '', content);
  };

  window.tcSetSpeakerFilter = (filter) => {
    activeFilter = filter;
    fetchAndRender();
  };

  const renderUI = (speakers) => {
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Speaker Tab</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Individual rankings by total points</div>
        </div>
        <div style="display:flex; background:#f1f5f9; padding:4px; border-radius:8px; gap:4px;">
          ${['OPEN', 'NOVICE', 'ESL', 'EFL'].map(f => `
            <button onclick="window.tcSetSpeakerFilter('${f}')" style="border:none; background:${activeFilter === f ? 'white' : 'transparent'}; color:${activeFilter === f ? 'var(--color-primary)' : '#64748b'}; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:${activeFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">
              ${f}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; width:60px;">Rank</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Speaker</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Team</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:center;">Avg</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:right;">Total Points</th>
            </tr>
          </thead>
          <tbody>
            ${speakers.map((s, i) => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:16px; font-weight:800; color:${i < 10 ? 'var(--color-primary)' : '#64748b'};">#${i + 1}</td>
                <td style="padding:16px;">
                  <div style="font-weight:700;">${s.name}</div>
                  <div style="font-size:10px; color:var(--color-primary); font-weight:700; text-transform:uppercase;">${s.eligibility}</div>
                </td>
                <td style="padding:16px; color:#64748b;">${s.team}</td>
                <td style="padding:16px; text-align:center; color:#64748b;">${s.avg}</td>
                <td style="padding:16px; text-align:right; font-weight:700; color:#1e293b;">${s.total.toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${speakers.length === 0 ? `
          <div style="padding:64px; text-align:center; color:#64748b;">
            <p>No debaters matching the <strong>${activeFilter}</strong> category yet.</p>
          </div>
        ` : ''}
      </div>
    `;

    renderAppLayout(container, '/tournament/speaker-tab', 'Speaker Tab', '', content);
  };

  fetchAndRender();
}
