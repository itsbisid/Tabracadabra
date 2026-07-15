import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = average(values);
  const variance = average(values.map(value => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function roundName(round) {
  return round?.name || `Round ${round?.round_num || ''}`.trim() || 'Round';
}

function statCard(label, value, iconName, color, helper = '') {
  return `
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:18px; display:grid; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="font-size:13px; color:#64748b;">${escapeHtml(label)}</div>
        <div style="color:${color};">${icon(iconName, 17)}</div>
      </div>
      <div style="font-size:26px; font-weight:900; color:#172033;">${escapeHtml(String(value))}</div>
      ${helper ? `<div style="font-size:12px; color:#64748b; line-height:1.4;">${escapeHtml(helper)}</div>` : ''}
    </div>
  `;
}

function bar(label, value, max, color = '#2563eb', helper = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `
    <div style="display:grid; gap:6px;">
      <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px;">
        <strong style="color:#172033;">${escapeHtml(label)}</strong>
        <span style="color:#64748b;">${escapeHtml(String(value))}${helper ? ` ${escapeHtml(helper)}` : ''}</span>
      </div>
      <div style="height:9px; background:#edf2f7; border-radius:999px; overflow:hidden;">
        <div style="height:100%; width:${pct}%; background:${color}; border-radius:999px;"></div>
      </div>
    </div>
  `;
}

export async function renderAnalytics(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  const fetchAndRender = async () => {
    const [
      { data: teams },
      { data: adjudicators },
      { data: rounds },
      { data: pairings },
      { data: ballots }
    ] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', tournamentId),
      supabase.from('adjudicators').select('*').eq('tournament_id', tournamentId),
      supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('round_num', { ascending: true }),
      supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId),
      supabase.from('ballots').select('*').eq('tournament_id', tournamentId)
    ]);

    renderUI({
      teams: teams || [],
      adjudicators: adjudicators || [],
      rounds: rounds || [],
      pairings: pairings || [],
      ballots: ballots || []
    });
  };

  const renderUI = ({ teams, adjudicators, rounds, pairings, ballots }) => {
    const speakerScores = ballots
      .flatMap(ballot => [Number(ballot.s1_points), Number(ballot.s2_points)])
      .filter(value => Number.isFinite(value) && value > 0);
    const institutions = new Set([...teams, ...adjudicators]
      .map(item => String(item.institution || '').trim())
      .filter(Boolean)
      .map(value => value.toLowerCase()));
    const confirmedPairings = new Set(ballots.map(ballot => ballot.pairing_id).filter(Boolean));
    const expectedTeamBallots = pairings.length * 4;
    const ballotCompletion = expectedTeamBallots ? Math.round((ballots.length / expectedTeamBallots) * 100) : 0;
    const activeTeams = teams.filter(team => (team.status || 'Active') !== 'Inactive');
    const activeJudges = adjudicators.filter(judge => (judge.status || 'Active') === 'Active');
    const avgSpeaker = average(speakerScores);
    const stdDev = standardDeviation(speakerScores);

    const scoreBuckets = [
      ['Under 70', speakerScores.filter(score => score < 70).length],
      ['70-74.9', speakerScores.filter(score => score >= 70 && score < 75).length],
      ['75-79.9', speakerScores.filter(score => score >= 75 && score < 80).length],
      ['80+', speakerScores.filter(score => score >= 80).length]
    ];
    const maxBucket = Math.max(1, ...scoreBuckets.map(([, count]) => count));

    const pairingsByRound = new Map();
    pairings.forEach(pairing => {
      const list = pairingsByRound.get(pairing.round_id) || [];
      list.push(pairing);
      pairingsByRound.set(pairing.round_id, list);
    });

    const ballotsByRound = new Map();
    ballots.forEach(ballot => {
      const pairing = pairings.find(item => item.id === ballot.pairing_id);
      if (!pairing) return;
      const list = ballotsByRound.get(pairing.round_id) || [];
      list.push(ballot);
      ballotsByRound.set(pairing.round_id, list);
    });

    const roundRows = rounds.map(round => {
      const roundPairings = pairingsByRound.get(round.id) || [];
      const roundBallots = ballotsByRound.get(round.id) || [];
      const expected = roundPairings.length * 4;
      return {
        round,
        rooms: roundPairings.length,
        ballots: roundBallots.length,
        pct: expected ? Math.round((roundBallots.length / expected) * 100) : 0
      };
    });

    const content = `
      <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px; margin-bottom:22px;">
        ${statCard('Avg speaker score', speakerScores.length ? avgSpeaker.toFixed(2) : '--', 'trendingUp', '#2563eb', `${speakerScores.length} scores counted`)}
        ${statCard('Score std dev', speakerScores.length ? stdDev.toFixed(2) : '--', 'barChart2', '#059669', 'Lower means tighter judging spread')}
        ${statCard('Institutions', institutions.size, 'building', '#ea580c', 'Across teams and adjudicators')}
        ${statCard('Ballot completion', `${ballotCompletion}%`, 'checkSquare', '#7c3aed', `${ballots.length}/${expectedTeamBallots || 0} team ballots`)}
      </div>

      <div style="display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:20px; align-items:start;">
        <div style="display:grid; gap:20px;">
          <section class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px;">
              <div>
                <h2 style="font-size:17px; font-weight:900; color:#172033; margin:0 0 4px;">Speaker score distribution</h2>
                <p style="font-size:13px; color:#64748b; margin:0;">A quick calibration view for completed ballots.</p>
              </div>
              <span style="background:#f1f5f9; color:#475569; border-radius:999px; padding:5px 10px; font-size:11px; font-weight:900;">${speakerScores.length} scores</span>
            </div>
            <div style="display:grid; gap:14px;">
              ${scoreBuckets.map(([label, count], index) => bar(label, count, maxBucket, ['#60a5fa', '#2563eb', '#059669', '#7c3aed'][index])).join('')}
            </div>
            ${speakerScores.length === 0 ? `<div style="margin-top:18px; padding:18px; border:1px dashed #cbd5e1; border-radius:8px; color:#64748b; font-size:13px; text-align:center;">Analytics will fill in after the first confirmed ballot.</div>` : ''}
          </section>

          <section class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px;">
              <div>
                <h2 style="font-size:17px; font-weight:900; color:#172033; margin:0 0 4px;">Round progress</h2>
                <p style="font-size:13px; color:#64748b; margin:0;">Rooms generated and ballots submitted per round.</p>
              </div>
              <button class="btn btn--outline btn--sm" onclick="window.tcNavigate('/tournament/debate-rounds')">${icon('list', 14)} Manage rounds</button>
            </div>
            <div style="display:grid; gap:14px;">
              ${roundRows.length ? roundRows.map(row => bar(roundName(row.round), row.pct, 100, row.pct === 100 ? '#059669' : '#2563eb', `% complete (${row.ballots}/${row.rooms * 4 || 0})`)).join('') : `<div style="padding:18px; border:1px dashed #cbd5e1; border-radius:8px; color:#64748b; font-size:13px; text-align:center;">Create rounds to see progress here.</div>`}
            </div>
          </section>
        </div>

        <aside style="display:grid; gap:16px;">
          <section class="card" style="padding:20px;">
            <h2 style="font-size:16px; font-weight:900; color:#172033; margin:0 0 14px;">Readiness snapshot</h2>
            <div style="display:grid; gap:12px;">
              ${bar('Active teams', activeTeams.length, Math.max(1, teams.length), '#2563eb', `/ ${teams.length}`)}
              ${bar('Active adjudicators', activeJudges.length, Math.max(1, adjudicators.length), '#059669', `/ ${adjudicators.length}`)}
              ${bar('Debates with ballots', confirmedPairings.size, Math.max(1, pairings.length), '#7c3aed', `/ ${pairings.length}`)}
            </div>
          </section>

          <section class="card" style="padding:20px; border-color:${activeTeams.length % 4 === 0 ? '#bbf7d0' : '#fed7aa'}; background:${activeTeams.length % 4 === 0 ? '#f8fffb' : '#fff7ed'};">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <div style="color:${activeTeams.length % 4 === 0 ? '#059669' : '#d97706'};">${icon(activeTeams.length % 4 === 0 ? 'checkCircle' : 'alertCircle', 18)}</div>
              <div>
                <h3 style="font-size:14px; font-weight:900; color:#172033; margin:0 0 5px;">Draw readiness</h3>
                <p style="font-size:13px; color:#64748b; line-height:1.5; margin:0;">
                  ${activeTeams.length % 4 === 0
                    ? 'Active team count is divisible by four, so BP pairing generation is ready.'
                    : `Active team count is ${activeTeams.length}. Add swing teams or deactivate extras before generating BP pairings.`}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    `;

    renderAppLayout(container, '/tournament/analytics', 'Tournament Analytics', 'Live performance, readiness, and ballot health.', content);
  };

  fetchAndRender();
}
