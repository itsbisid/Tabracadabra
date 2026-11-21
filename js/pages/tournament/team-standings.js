import { renderAppLayout } from '../../components/layout.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';
import { teamLabelHtml } from '../../lib/team-display.js';
import { fetchVisibleStandingsBallots } from '../../lib/visible-results.js';

export async function renderTeamStandings(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  const fetchAndRender = async () => {
    const [{ data: teams }, ballots, { data: pairings }, { data: rounds }] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', tournamentId),
      fetchVisibleStandingsBallots(tournamentId),
      supabase.from('draw_pairings').select('id,round_id').eq('tournament_id', tournamentId),
      supabase.from('rounds').select('id,round_num,name').eq('tournament_id', tournamentId).order('round_num', { ascending: true })
    ]);
    const roundByPairing = new Map((pairings || []).map(pairing => [pairing.id, pairing.round_id]));
    const visibleRoundIds = new Set(ballots.map(ballot => roundByPairing.get(ballot.pairing_id)).filter(Boolean));
    const visibleRounds = (rounds || []).filter(round => visibleRoundIds.has(round.id));
    
    const standings = (teams || []).map(team => {
      const teamBallots = ballots.filter(b => b.team_id === team.id);
      const points = teamBallots.reduce((acc, b) => acc + (b.points || 0), 0);
      const speaks = teamBallots.reduce((acc, b) => acc + (b.speaker_points || 0), 0);
      const byRound = new Map(teamBallots.map(ballot => [roundByPairing.get(ballot.pairing_id), ballot]));
      return { ...team, points, speaks, byRound };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.speaks - a.speaks;
    });

    renderUI(standings, visibleRounds);
  };

  const renderUI = (standings, rounds) => {
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Team Standings</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Ranked by points, then speaker points. Unreleased blind-round results are excluded.</div>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:auto;">
        <table style="width:100%; min-width:${620 + rounds.length * 105}px; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; width:60px;">Rank</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Team</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b;">Institution</th>
              ${rounds.map(round => `<th title="${escapeHtml(round.name || `Round ${round.round_num}`)}" style="padding:12px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:center;">R${escapeHtml(round.round_num)}</th>`).join('')}
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:center;">Points</th>
              <th style="padding:16px; font-size:11px; text-transform:uppercase; color:#64748b; text-align:right;">Speaks</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;">
                <td style="padding:16px; font-weight:800; color:${i < 4 ? 'var(--color-primary)' : '#64748b'};">#${i + 1}</td>
                <td style="padding:16px;">
                  <div style="font-weight:700;">${teamLabelHtml(s)}</div>
                </td>
                <td style="padding:16px; color:#64748b;">${escapeHtml(s.institution || '-')}</td>
                ${rounds.map(round => { const ballot = s.byRound.get(round.id); return `<td style="padding:10px; text-align:center; white-space:nowrap;">${ballot ? `<strong>${Number(ballot.points || 0)} pts</strong><small style="display:block;color:#64748b;">${Number(ballot.speaker_points || 0).toFixed(1)} speaks</small>` : '—'}</td>`; }).join('')}
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
