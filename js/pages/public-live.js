import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';
import { escapeHtml } from '../lib/html.js';
import { teamLabelHtml } from '../lib/team-display.js';
import { filterVisibleStandingsBallots } from '../lib/visible-results-filter.js';

function computeStandings(teams, ballots) {
  return teams.map(team => {
    const teamBallots = ballots.filter(ballot => ballot.team_id === team.id);
    const points = teamBallots.reduce((sum, ballot) => sum + (Number(ballot.points) || 0), 0);
    const speaks = teamBallots.reduce((sum, ballot) => sum + (Number(ballot.speaker_points) || 0), 0);
    return { ...team, points, speaks, rounds: teamBallots.length };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.speaks - a.speaks;
  });
}

function roundTitle(round) {
  return round?.name || `Round ${round?.round_num || ''}`.trim() || 'Round';
}

export async function renderPublicLive(container, tournamentId) {
  container.innerHTML = `
    <div style="min-height:100vh; background:#f6f8fb; color:#172033; font-family:Inter, system-ui, sans-serif; display:flex; align-items:center; justify-content:center; padding:32px;">
      <div style="font-size:14px; color:#64748b;">Loading live page...</div>
    </div>
  `;

  const [
    { data: tournament },
    { data: teams },
    { data: rounds },
    { data: pairings },
    { data: ballots }
  ] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('teams').select('*').eq('tournament_id', tournamentId),
    supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('round_num', { ascending: true }),
    supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId),
    supabase.from('ballots').select('*').eq('tournament_id', tournamentId)
  ]);

  if (!tournament) {
    renderMessage(container, 'Live page not found', 'Check the link and try again.');
    return;
  }

  if (!tournament.is_tab_released) {
    renderMessage(container, 'Results are not published yet', 'The tournament admin has not opened the public live page.');
    return;
  }

  const visibleBallots = filterVisibleStandingsBallots(ballots || [], pairings || [], rounds || []);
  const standings = computeStandings(teams || [], visibleBallots);
  const motions = (rounds || []).filter(round => round.motion_text);
  const completedRounds = (rounds || []).filter(round => String(round.status || '').toLowerCase() === 'completed').length;

  container.innerHTML = `
    <div style="min-height:100vh; background:#f6f8fb; color:#172033; font-family:Inter, system-ui, sans-serif;">
      <header style="background:white; border-bottom:1px solid #e2e8f0;">
        <div style="max-width:1120px; margin:0 auto; padding:24px 20px; display:flex; justify-content:space-between; gap:20px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; color:#2563eb; font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:6px;">
              ${icon('monitor', 15)} Live public page
            </div>
            <h1 style="font-size:28px; line-height:1.15; margin:0 0 6px; font-weight:900;">${escapeHtml(tournament.short_name || tournament.name || 'Tournament')}</h1>
            <p style="margin:0; color:#64748b; font-size:14px;">${escapeHtml(tournament.name || 'Published standings and motions')}</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <span style="background:#ecfdf5; color:#047857; border-radius:999px; padding:6px 11px; font-size:12px; font-weight:900;">Published</span>
            <span style="background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:6px 11px; font-size:12px; font-weight:900;">${completedRounds}/${(rounds || []).length} rounds complete</span>
          </div>
        </div>
      </header>

      <main style="max-width:1120px; margin:0 auto; padding:24px 20px 48px; display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:22px; align-items:start;">
        <section style="background:white; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
          <div style="padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
            <div>
              <h2 style="font-size:18px; font-weight:900; margin:0 0 4px;">Team standings</h2>
              <p style="font-size:13px; color:#64748b; margin:0;">Unreleased blind-round results are excluded.</p>
            </div>
            <span style="font-size:12px; color:#64748b;">${visibleBallots.length} ballots</span>
          </div>
          ${standings.length ? `
            <div style="overflow:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead style="background:#f8fafc;">
                  <tr>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Rank</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Team</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Institution</th>
                    <th style="padding:12px 16px; text-align:center; font-size:11px; color:#64748b; text-transform:uppercase;">Pts</th>
                    <th style="padding:12px 16px; text-align:right; font-size:11px; color:#64748b; text-transform:uppercase;">Speaks</th>
                  </tr>
                </thead>
                <tbody>
                  ${standings.map((team, index) => `
                    <tr style="border-top:1px solid #f1f5f9;">
                      <td style="padding:14px 16px; font-weight:900; color:${index < 4 ? '#2563eb' : '#64748b'};">#${index + 1}</td>
                      <td style="padding:14px 16px; font-weight:800;">${teamLabelHtml(team)}</td>
                      <td style="padding:14px 16px; color:#64748b;">${escapeHtml(team.institution || '-')}</td>
                      <td style="padding:14px 16px; text-align:center; font-weight:900;">${team.points}</td>
                      <td style="padding:14px 16px; text-align:right; font-weight:800;">${team.speaks.toFixed(1)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div style="padding:40px; text-align:center; color:#64748b; font-size:14px;">No visible results yet.</div>`}
        </section>

        <aside style="display:grid; gap:18px;">
          <section style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:18px;">
            <h2 style="font-size:16px; font-weight:900; margin:0 0 12px;">Motions</h2>
            <div style="display:grid; gap:10px;">
              ${motions.length ? motions.map(round => `
                <div style="border:1px solid #edf2f7; border-radius:8px; padding:12px;">
                  <div style="font-size:12px; color:#2563eb; font-weight:900; margin-bottom:5px;">${escapeHtml(roundTitle(round))}</div>
                  <div style="font-size:13px; line-height:1.45; color:#172033;">${escapeHtml(round.motion_text)}</div>
                </div>
              `).join('') : '<div style="font-size:13px; color:#64748b;">No motions published yet.</div>'}
            </div>
          </section>

          <section style="background:#f8fbff; border:1px solid #bfdbfe; border-radius:8px; padding:18px;">
            <h2 style="font-size:16px; font-weight:900; margin:0 0 8px;">Tournament snapshot</h2>
            <div style="display:grid; gap:8px; font-size:13px; color:#475569;">
              <div>${icon('users', 14)} ${(teams || []).length} teams</div>
              <div>${icon('list', 14)} ${(rounds || []).length} rounds</div>
              <div>${icon('checkSquare', 14)} ${visibleBallots.length} visible ballots</div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  `;
}

function renderMessage(container, title, body) {
  container.innerHTML = `
    <div style="min-height:100vh; background:#f6f8fb; color:#172033; font-family:Inter, system-ui, sans-serif; display:flex; align-items:center; justify-content:center; padding:32px;">
      <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:32px; max-width:460px; text-align:center;">
        <div style="color:#2563eb; margin-bottom:14px;">${icon('lock', 32)}</div>
        <h1 style="font-size:22px; font-weight:900; margin:0 0 8px;">${escapeHtml(title)}</h1>
        <p style="font-size:14px; color:#64748b; line-height:1.5; margin:0;">${escapeHtml(body)}</p>
      </div>
    </div>
  `;
}
