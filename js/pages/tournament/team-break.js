import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';
import { teamLabelHtml } from '../../lib/team-display.js';
import { fetchVisibleStandingsBallots } from '../../lib/visible-results.js';

export async function renderTeamBreak(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  let breakSize = 16;

  // Standings computed identically to the Team Standings page: total team
  // points, then total speaker points as the tiebreak. Deactivated teams are
  // excluded so a dropped team never occupies a break slot.
  const computeStandings = (teams, ballots) => {
    return (teams || [])
      .filter(team => (team.status || 'Active') !== 'Inactive')
      .map(team => {
        const teamBallots = (ballots || []).filter(b => b.team_id === team.id);
        const points = teamBallots.reduce((acc, b) => acc + (b.points || 0), 0);
        const speaks = teamBallots.reduce((acc, b) => acc + (b.speaker_points || 0), 0);
        return { ...team, points, speaks };
      })
      .sort((a, b) => (b.points - a.points) || (b.speaks - a.speaks) || String(a.name || '').localeCompare(String(b.name || '')));
  };

  const fetchAndRender = async () => {
    const [{ data: tournament }, { data: teams }, ballots] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('teams').select('*').eq('tournament_id', tournamentId),
      fetchVisibleStandingsBallots(tournamentId)
    ]);

    const persistedSize = Number(tournament?.break_size ?? tournament?.settings?.break_size);
    if (Number.isFinite(persistedSize) && persistedSize > 0) breakSize = persistedSize;

    renderUI(tournament || {}, computeStandings(teams, ballots));
  };

  window.tcSaveBreakSize = async () => {
    const input = document.getElementById('break-size-input');
    const value = Math.max(1, parseInt(input.value, 10) || breakSize);
    breakSize = value;
    const { error } = await supabase.from('tournaments').update({ break_size: value }).eq('id', tournamentId);
    // break_size may not exist as a column on older schemas; fall back to settings.
    if (error) {
      const { data: current } = await supabase.from('tournaments').select('settings').eq('id', tournamentId).single();
      const settings = { ...(current?.settings || {}), break_size: value };
      await supabase.from('tournaments').update({ settings }).eq('id', tournamentId);
    }
    fetchAndRender();
  };

  window.tcPublishBreak = async () => {
    if (!confirm(`Publish the break to the top ${breakSize} teams? This makes the break list visible to participants.`)) return;
    const { error } = await supabase.from('tournaments').update({ is_break_released: true }).eq('id', tournamentId);
    if (error) {
      const { data: current } = await supabase.from('tournaments').select('settings').eq('id', tournamentId).single();
      const settings = { ...(current?.settings || {}), is_break_released: true };
      const { error: settingsError } = await supabase.from('tournaments').update({ settings }).eq('id', tournamentId);
      if (settingsError) { alert(settingsError.message); return; }
    }
    alert('Break published.');
    fetchAndRender();
  };

  const renderUI = (tournament, standings) => {
    const released = Boolean(tournament.is_break_released || tournament.settings?.is_break_released);
    const anyResults = standings.some(s => s.points > 0 || s.speaks > 0);

    const rows = standings.map((s, i) => {
      const rank = i + 1;
      const inBreak = rank <= breakSize;
      const isBubble = rank === breakSize; // last team inside the break
      const isFirstOut = rank === breakSize + 1; // first team missing the break
      return `
        <tr style="border-bottom:1px solid #f1f5f9; background:${inBreak ? '#f0fdf4' : 'white'};">
          <td style="padding:14px 16px; font-weight:800; color:${inBreak ? '#059669' : '#64748b'};">#${rank}</td>
          <td style="padding:14px 16px;">
            <div style="font-weight:700;">${teamLabelHtml(s)}</div>
            <div style="font-size:11px; color:#64748b;">${escapeHtml(s.institution || '')}</div>
          </td>
          <td style="padding:14px 16px; text-align:center;"><span style="background:var(--color-primary); color:white; font-weight:700; padding:2px 10px; border-radius:99px; min-width:28px; display:inline-block;">${s.points}</span></td>
          <td style="padding:14px 16px; text-align:right; font-weight:600;">${s.speaks.toFixed(1)}</td>
          <td style="padding:14px 16px; text-align:right;">
            ${inBreak ? `<span style="font-size:10px; font-weight:800; color:#059669; text-transform:uppercase;">${isBubble ? 'Bubble · Breaking' : 'Breaking'}</span>`
              : (isFirstOut ? `<span style="font-size:10px; font-weight:800; color:#dc2626; text-transform:uppercase;">First out</span>` : '')}
          </td>
        </tr>
        ${inBreak && isBubble ? `<tr><td colspan="5" style="padding:0;"><div style="height:2px; background:repeating-linear-gradient(90deg,#dc2626 0 8px,transparent 8px 16px);"></div></td></tr>` : ''}
      `;
    }).join('');

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Team break</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Live team break computed from confirmed ballots (points, then speaker points).</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="badge ${released ? 'badge--active' : 'badge--draft'}">${released ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
          <button onclick="window.tcPublishBreak()" class="btn btn--primary btn--sm" style="gap:8px;">${icon('award', 14)} Publish break</button>
        </div>
      </div>

      <div class="card" style="padding:16px 20px; margin-bottom:16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label style="font-size:13px; font-weight:600; color:var(--color-text);">Break size (Open)</label>
        <input id="break-size-input" type="number" min="1" value="${breakSize}" style="width:90px; border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 10px; font-size:14px;">
        <button onclick="window.tcSaveBreakSize()" class="btn btn--outline btn--sm">Apply</button>
        <span style="font-size:12px; color:var(--color-text-muted);">Teams ranked ${'≤'} the break size advance. Institution caps and category breaks (ESL/EFL/Novice) are not auto-applied — adjust manually if your tournament needs them.</span>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:14px 16px; text-align:left; font-size:11px; text-transform:uppercase; color:#64748b; width:70px;">Rank</th>
              <th style="padding:14px 16px; text-align:left; font-size:11px; text-transform:uppercase; color:#64748b;">Team</th>
              <th style="padding:14px 16px; text-align:center; font-size:11px; text-transform:uppercase; color:#64748b;">Points</th>
              <th style="padding:14px 16px; text-align:right; font-size:11px; text-transform:uppercase; color:#64748b;">Speaks</th>
              <th style="padding:14px 16px; text-align:right; font-size:11px; text-transform:uppercase; color:#64748b;">Break</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${standings.length === 0 ? `<div style="padding:48px; text-align:center; color:#64748b;">No teams in this tournament yet.</div>`
          : (!anyResults ? `<div style="padding:24px; text-align:center; color:#64748b; font-size:13px;">No confirmed ballots yet — the break updates automatically as results come in.</div>` : '')}
      </div>
    `;

    renderAppLayout(container, '/tournament/team-break', 'Team break', '', content);
  };

  fetchAndRender();
}
