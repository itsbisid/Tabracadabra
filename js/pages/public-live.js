import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';
import { escapeHtml, escapeJsString } from '../lib/html.js';
import { teamLabelHtml } from '../lib/team-display.js';
import { filterVisibleStandingsBallots } from '../lib/visible-results-filter.js';

function computeStandings(teams, ballots, roundByPairing) {
  return teams.map(team => {
    const teamBallots = ballots.filter(ballot => ballot.team_id === team.id);
    const points = teamBallots.reduce((sum, ballot) => sum + (Number(ballot.points) || 0), 0);
    const speaks = teamBallots.reduce((sum, ballot) => sum + (Number(ballot.speaker_points) || 0), 0);
    const byRound = new Map(teamBallots.map(ballot => [roundByPairing.get(ballot.pairing_id), ballot]));
    return { ...team, points, speaks, rounds: teamBallots.length, byRound };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.speaks - a.speaks;
  });
}

function computeSpeakerStandings(teams, ballots, roundByPairing) {
  const speakers = [];
  teams.forEach(team => {
    const teamBallots = ballots.filter(ballot => ballot.team_id === team.id);
    [['speaker1_name', 's1_points', 'speaker1_proam_role'], ['speaker2_name', 's2_points', 'speaker2_proam_role']].forEach(([nameKey, scoreKey, roleKey]) => {
      if (!team[nameKey]) return;
      const byRound = new Map(teamBallots.map(ballot => [roundByPairing.get(ballot.pairing_id), Number(ballot[scoreKey] || 0)]));
      const scores = [...byRound.values()];
      const total = scores.reduce((sum, score) => sum + score, 0);
      speakers.push({ name: team[nameKey], team, proAmRole: team[roleKey] || 'UNCLASSIFIED', byRound, total, average: scores.length ? total / scores.length : 0 });
    });
  });
  return speakers.sort((a, b) => b.total - a.total || b.average - a.average || a.name.localeCompare(b.name));
}

function renderTopSpeakerGroups(speakers) {
  const groups = [
    ['Top 5 Pros', speakers.filter(speaker => speaker.proAmRole === 'PRO' && !speaker.team?.exclude_from_speaker_awards).slice(0, 5), '#1d4ed8', '#eff6ff'],
    ['Top 5 Novices / Amateurs', speakers.filter(speaker => speaker.proAmRole === 'AMATEUR' && !speaker.team?.exclude_from_speaker_awards).slice(0, 5), '#b45309', '#fffbeb']
  ];
  return `<div style="padding:18px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
    ${groups.map(([title, ranked, color, background]) => `<div style="border:1px solid #e2e8f0;background:white;border-radius:12px;overflow:hidden;"><div style="padding:11px 13px;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.06em;color:${color};background:${background};">${title}</div><div>${ranked.map((speaker, index) => `<div style="padding:10px 13px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:12px;"><span style="font-size:13px;"><b style="color:${color};margin-right:7px;">#${index + 1}</b>${escapeHtml(speaker.name)}</span><strong>${speaker.total.toFixed(1)}</strong></div>`).join('') || '<div style="padding:12px;color:#64748b;font-size:12px;">No classified speakers.</div>'}</div></div>`).join('')}
  </div>`;
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
    { data: ballots },
    { data: adjudicators }
  ] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('teams').select('*').eq('tournament_id', tournamentId),
    supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('round_num', { ascending: true }),
    supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId),
    supabase.from('ballots').select('*').eq('tournament_id', tournamentId),
    supabase.from('adjudicators').select('id,name,institution').eq('tournament_id', tournamentId)
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
  const roundByPairing = new Map((pairings || []).map(pairing => [pairing.id, pairing.round_id]));
  const visibleRoundIds = new Set(visibleBallots.map(ballot => roundByPairing.get(ballot.pairing_id)).filter(Boolean));
  const visibleRounds = (rounds || []).filter(round => visibleRoundIds.has(round.id));
  const standings = computeStandings(teams || [], visibleBallots, roundByPairing);
  const speakerStandings = computeSpeakerStandings(teams || [], visibleBallots, roundByPairing);
  const showSpeakerScores = tournament.settings?.public_show_speaker_scores !== false;
  const motions = (rounds || []).filter(round => round.motion_text);
  const teamById = new Map((teams || []).map(team => [team.id, team]));
  const judgeById = new Map((adjudicators || []).map(judge => [judge.id, judge]));
  const finalWinners = (rounds || []).filter(round => round.winner_team_id || round.winning_adjudicator_id);
  const completedRounds = (rounds || []).filter(round => String(round.status || '').toLowerCase() === 'completed').length;

  window.tcShowPublicSpeakerStats = (teamId, slot) => {
    const team = (teams || []).find(item => item.id === teamId);
    const name = slot === '1' ? team?.speaker1_name : team?.speaker2_name;
    const speaker = speakerStandings.find(item => item.team.id === teamId && item.name === name);
    if (!speaker) return;
    const rank = speakerStandings.indexOf(speaker) + 1;
    document.getElementById('modal-root').innerHTML = `
      <div onclick="if(event.target===this)this.innerHTML=''" style="position:fixed;inset:0;z-index:10000;background:rgba(7,27,63,.68);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div role="dialog" aria-modal="true" aria-label="${escapeHtml(speaker.name)} statistics" style="width:min(620px,100%);max-height:calc(100vh - 40px);overflow:auto;background:white;border-radius:20px;box-shadow:0 28px 80px rgba(2,8,23,.38);">
          <div style="padding:22px 24px;background:linear-gradient(125deg,#071b3f,#1746a2);color:white;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;"><div><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.15);font-size:10px;font-weight:900;letter-spacing:.08em;margin-bottom:9px;">${escapeHtml(speaker.proAmRole)}</span><h2 style="margin:0 0 5px;font-size:23px;font-weight:950;">${escapeHtml(speaker.name)}</h2><div style="font-size:13px;color:#bfdbfe;">${teamLabelHtml(speaker.team)}</div></div><button onclick="document.getElementById('modal-root').innerHTML=''" aria-label="Close" style="border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:white;width:34px;height:34px;border-radius:10px;cursor:pointer;">${icon('x',18)}</button></div>
          <div style="padding:22px 24px;"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;"><div style="padding:13px;background:#eff6ff;border-radius:12px;"><small style="display:block;color:#64748b;margin-bottom:3px;">Overall rank</small><strong style="font-size:21px;color:#1d4ed8;">#${rank}</strong></div><div style="padding:13px;background:#f8fafc;border-radius:12px;"><small style="display:block;color:#64748b;margin-bottom:3px;">Average</small><strong style="font-size:21px;">${speaker.average.toFixed(2)}</strong></div><div style="padding:13px;background:#fffbeb;border-radius:12px;"><small style="display:block;color:#64748b;margin-bottom:3px;">Total speaks</small><strong style="font-size:21px;color:#b45309;">${speaker.total.toFixed(1)}</strong></div></div><div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px;">Round-by-round</div><div style="display:grid;gap:8px;">${visibleRounds.map(round => `<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:11px 13px;"><span style="font-weight:800;">${escapeHtml(roundTitle(round))}</span><strong>${speaker.byRound.has(round.id) ? speaker.byRound.get(round.id).toFixed(1) : '—'}</strong></div>`).join('')}</div></div>
        </div>
      </div>`;
  };

  container.innerHTML = `
    <style>
      .tc-live-shell{min-height:100vh;background:radial-gradient(circle at 10% 0%,#dbeafe 0,transparent 32%),radial-gradient(circle at 92% 12%,#ede9fe 0,transparent 28%),#f8fafc;color:#111827;font-family:Inter,system-ui,sans-serif}
      .tc-live-hero{position:relative;overflow:hidden;background:linear-gradient(120deg,#071b3f 0%,#0b3b8f 58%,#5b21b6 120%);color:white}.tc-live-hero:after{content:'';position:absolute;width:420px;height:420px;border:90px solid rgba(255,255,255,.07);border-radius:50%;right:-120px;top:-230px}
      .tc-live-grid{max-width:1240px;margin:0 auto;padding:28px 20px 64px;display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:24px;align-items:start}.tc-live-grid>section[style*="background:linear-gradient(135deg,#fffbeb"]{grid-column:1/-1!important;grid-row:1}.tc-live-team{grid-column:1;grid-row:2;border-radius:20px!important;box-shadow:0 18px 55px rgba(15,23,42,.09)}.tc-live-aside{grid-column:2;grid-row:2}.tc-live-speakers,.tc-live-speaker-groups,.tc-live-grid>section[style*="grid-column:1/-1"]{grid-column:1/-1!important;border-radius:20px!important;box-shadow:0 18px 55px rgba(15,23,42,.08)}
      .tc-live-table tbody tr{transition:background .18s ease}.tc-live-table tbody tr:hover{background:#eff6ff!important}.tc-live-motion{background:linear-gradient(145deg,#0f172a,#172554)!important;color:white;border:0!important;box-shadow:0 18px 45px rgba(15,23,42,.18)}
      .tc-team-picker{position:relative;display:inline-block}.tc-team-trigger{border:0;background:transparent;padding:0;color:#172033;font:inherit;font-weight:850;cursor:pointer;text-align:left}.tc-team-trigger:hover{color:#1d4ed8}.tc-team-members{position:absolute;left:0;top:calc(100% + 8px);z-index:50;width:245px;padding:8px;background:white;border:1px solid #bfdbfe;border-radius:12px;box-shadow:0 18px 45px rgba(15,23,42,.18);opacity:0;visibility:hidden;transform:translateY(-5px);transition:.16s ease}.tc-team-picker:hover .tc-team-members,.tc-team-picker:focus-within .tc-team-members{opacity:1;visibility:visible;transform:translateY(0)}.tc-speaker-link{width:100%;border:0;background:transparent;border-radius:8px;padding:9px 10px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;text-align:left;color:#172033}.tc-speaker-link:hover,.tc-speaker-link:focus{background:#eff6ff;outline:none}
      @media(max-width:900px){.tc-live-grid{grid-template-columns:1fr}.tc-live-team,.tc-live-aside,.tc-live-speakers{grid-column:1!important;grid-row:auto}.tc-live-aside{order:2}.tc-live-speakers{order:3}}@media(max-width:600px){.tc-live-grid{padding:16px 10px 40px}.tc-live-hero-inner{padding:26px 16px!important}.tc-live-title{font-size:30px!important}}
    </style>
    <div class="tc-live-shell">
      <header class="tc-live-hero">
        <div class="tc-live-hero-inner" style="position:relative;z-index:1;max-width:1240px;margin:0 auto;padding:38px 20px 42px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end;flex-wrap:wrap;">
          <div>
            <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:7px 11px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;margin-bottom:13px;">
              <span style="width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 5px rgba(74,222,128,.16);"></span> Live tournament hub
            </div>
            <h1 class="tc-live-title" style="font-size:42px;letter-spacing:-.045em;line-height:1.02;margin:0 0 10px;font-weight:950;">${escapeHtml(tournament.short_name || tournament.name || 'Tournament')}</h1>
            <p style="margin:0;color:#bfdbfe;font-size:15px;">${escapeHtml(tournament.name || 'Published standings and motions')}</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <span style="background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);color:white;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:900;">${icon('checkCircle',14)} Published</span>
            <span style="background:white;color:#1d4ed8;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:900;box-shadow:0 8px 24px rgba(0,0,0,.15);">${completedRounds}/${(rounds || []).length} rounds complete</span>
          </div>
        </div>
      </header>

      <main class="tc-live-grid">
        <section class="tc-live-team" style="background:white; border:1px solid #e2e8f0; overflow:hidden;">
          <div style="padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
            <div>
              <h2 style="font-size:18px; font-weight:900; margin:0 0 4px;">Team standings</h2>
              <p style="font-size:13px; color:#64748b; margin:0;">Unreleased blind-round results are excluded.</p>
            </div>
            <span style="font-size:12px; color:#64748b;">${visibleBallots.length} ballots</span>
          </div>
          ${standings.length ? `
            <div style="overflow:auto;">
              <table class="tc-live-table" style="width:100%; min-width:${600 + visibleRounds.length * 95}px; border-collapse:collapse; font-size:14px;">
                <thead style="background:#f8fafc;">
                  <tr>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Rank</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Team</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Institution</th>
                    ${visibleRounds.map(round => `<th style="padding:12px; text-align:center; font-size:11px; color:#64748b; text-transform:uppercase;">R${escapeHtml(round.round_num)}</th>`).join('')}
                    <th style="padding:12px 16px; text-align:center; font-size:11px; color:#64748b; text-transform:uppercase;">Pts</th>
                    ${showSpeakerScores ? '<th style="padding:12px 16px; text-align:right; font-size:11px; color:#64748b; text-transform:uppercase;">Speaks</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${standings.map((team, index) => `
                    <tr style="border-top:1px solid #f1f5f9;background:${index === 0 ? '#fffbeb' : index < 4 ? '#f8fbff' : 'white'};">
                      <td style="padding:14px 16px;"><span style="display:inline-flex;width:31px;height:31px;align-items:center;justify-content:center;border-radius:10px;font-weight:950;background:${index === 0 ? 'linear-gradient(135deg,#f59e0b,#f97316)' : index < 4 ? '#dbeafe' : '#f1f5f9'};color:${index === 0 ? 'white' : index < 4 ? '#1d4ed8' : '#64748b'};">${index + 1}</span></td>
                      <td style="padding:14px 16px;font-weight:800;"><div class="tc-team-picker"><button class="tc-team-trigger" aria-haspopup="true">${teamLabelHtml(team)} <span style="font-size:10px;color:#94a3b8;">▾</span></button><div class="tc-team-members"><div style="font-size:10px;font-weight:900;text-transform:uppercase;color:#64748b;padding:4px 10px 7px;">Select a speaker</div>${[['1', team.speaker1_name, team.speaker1_proam_role], ['2', team.speaker2_name, team.speaker2_proam_role]].filter(([,name]) => name).map(([slot,name,role]) => `<button class="tc-speaker-link" onclick="window.tcShowPublicSpeakerStats('${escapeJsString(team.id)}','${slot}')"><span><strong style="display:block;font-size:13px;">${escapeHtml(name)}</strong><small style="color:#64748b;">${escapeHtml(role || 'Speaker')}</small></span><span style="color:#2563eb;">${icon('chevronRight',15)}</span></button>`).join('')}</div></div></td>
                      <td style="padding:14px 16px; color:#64748b;">${escapeHtml(team.institution || '-')}</td>
                      ${visibleRounds.map(round => { const ballot = team.byRound.get(round.id); return `<td style="padding:10px; text-align:center; white-space:nowrap;">${ballot ? `<strong>${Number(ballot.points || 0)} pts</strong>${showSpeakerScores ? `<small style="display:block;color:#64748b;">${Number(ballot.speaker_points || 0).toFixed(1)}</small>` : ''}` : 'â€”'}</td>`; }).join('')}
                      <td style="padding:14px 16px; text-align:center; font-weight:900;">${team.points}</td>
                      ${showSpeakerScores ? `<td style="padding:14px 16px; text-align:right; font-weight:800;">${team.speaks.toFixed(1)}</td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div style="padding:40px; text-align:center; color:#64748b; font-size:14px;">No visible results yet.</div>`}
        </section>

        ${finalWinners.length ? `<section style="grid-column:1/-1;background:linear-gradient(135deg,#fffbeb,#fff7ed);border:1px solid #fbbf24;border-radius:18px;padding:22px;box-shadow:0 18px 45px rgba(146,64,14,.10);"><div style="display:flex;align-items:center;gap:9px;color:#92400e;font-size:19px;font-weight:950;margin-bottom:15px;">${icon('award',20)} Pro-Am Winners</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">${finalWinners.map(round => { const winnerTeam = teamById.get(round.winner_team_id); const winnerJudge = judgeById.get(round.winning_adjudicator_id); return `<div style="background:rgba(255,255,255,.86);border:1px solid #fde68a;border-radius:12px;padding:15px;"><div style="font-size:11px;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:9px;">${escapeHtml(round.name || 'Grand Final')}</div>${winnerTeam ? `<div style="font-size:13px;color:#64748b;margin-bottom:3px;">Winning team</div><div style="font-size:16px;font-weight:950;color:#172033;">${teamLabelHtml(winnerTeam)}</div>` : ''}${winnerJudge ? `<div style="font-size:13px;color:#64748b;margin-top:12px;margin-bottom:3px;">Winning judge</div><div style="font-size:16px;font-weight:950;color:#172033;">${escapeHtml(winnerJudge.name || 'Adjudicator')}</div>` : ''}</div>`; }).join('')}</div></section>` : ''}

        ${showSpeakerScores ? `<section class="tc-live-speaker-groups" style="background:white;border:1px solid #e2e8f0;overflow:hidden;"><div style="padding:18px 20px 4px;"><h2 style="font-size:18px;font-weight:900;margin:0 0 4px;">Pro-Am speaker leaders</h2><p style="font-size:13px;color:#64748b;margin:0;">Top five Pros and top five Novices/Amateurs, ranked separately.</p></div>${renderTopSpeakerGroups(speakerStandings)}</section>` : ''}

        ${showSpeakerScores ? `<section style="grid-column:1/-1; background:white; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;"><div style="padding:18px 20px; border-bottom:1px solid #e2e8f0;"><h2 style="font-size:18px;font-weight:900;margin:0 0 4px;">Individual standings</h2><p style="font-size:13px;color:#64748b;margin:0;">Round-by-round speaker scores.</p></div><div style="overflow:auto;"><table style="width:100%;min-width:${520 + visibleRounds.length * 72}px;border-collapse:collapse;font-size:14px;"><thead style="background:#f8fafc;"><tr><th style="padding:12px;text-align:left;">Rank</th><th style="padding:12px;text-align:left;">Speaker</th><th style="padding:12px;text-align:left;">Team</th>${visibleRounds.map(round => `<th style="padding:12px;text-align:center;">R${escapeHtml(round.round_num)}</th>`).join('')}<th style="padding:12px;text-align:center;">Avg</th><th style="padding:12px;text-align:right;">Total</th></tr></thead><tbody>${speakerStandings.map((speaker,index)=>`<tr style="border-top:1px solid #f1f5f9;"><td style="padding:12px;font-weight:900;">#${index+1}</td><td style="padding:12px;font-weight:800;">${escapeHtml(speaker.name)}</td><td style="padding:12px;">${teamLabelHtml(speaker.team)}</td>${visibleRounds.map(round=>`<td style="padding:12px;text-align:center;">${speaker.byRound.has(round.id)?speaker.byRound.get(round.id).toFixed(1):'â€”'}</td>`).join('')}<td style="padding:12px;text-align:center;">${speaker.average.toFixed(2)}</td><td style="padding:12px;text-align:right;font-weight:800;">${speaker.total.toFixed(1)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}

        <aside class="tc-live-aside" style="display:grid; gap:18px;">
          <section class="tc-live-motion" style="border-radius:18px; padding:20px;">
            <h2 style="font-size:16px; font-weight:900; margin:0 0 12px;">Motions</h2>
            <div style="display:grid; gap:10px;">
              ${motions.length ? motions.map(round => `
                <div style="border:1px solid #edf2f7; border-radius:8px; padding:12px;">
                  <div style="font-size:12px; color:#2563eb; font-weight:900; margin-bottom:5px;">${escapeHtml(roundTitle(round))}</div>
                  <div style="font-size:13px; line-height:1.55; color:#e2e8f0;">${escapeHtml(round.motion_text)}</div>
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
