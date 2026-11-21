import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';
import { isAdmin } from '../../lib/auth-helpers.js';

const keyFor = (pairingId, submitterId, targetId) => `${pairingId}:${submitterId}:${targetId}`;

export async function renderFeedback(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  const adminAllowed = await isAdmin(tournamentId);
  if (!adminAllowed) {
    renderAppLayout(container, '/tournament/feedback', 'Adjudicator feedback', 'Administrator access required.', '<div class="card" style="padding:24px;">Only tournament administrators can view feedback completion.</div>');
    return;
  }

  const [roundResult, pairingResult, teamResult, judgeResult, feedbackResult] = await Promise.all([
    supabase.from('rounds').select('id,name,round_num,status').eq('tournament_id', tournamentId).order('round_num'),
    supabase.from('draw_pairings').select('id,round_id,room_label,og_team_id,oo_team_id,cg_team_id,co_team_id,chair_id,ballots(id)').eq('tournament_id', tournamentId),
    supabase.from('teams').select('id,name,institution').eq('tournament_id', tournamentId),
    supabase.from('adjudicators').select('id,name,email').eq('tournament_id', tournamentId),
    supabase.from('judge_feedback').select('id,pairing_id,submitted_by_id,submitted_role,target_judge_id,score,comments,is_anonymous').eq('tournament_id', tournamentId)
  ]);

  const pairingIds = (pairingResult.data || []).map(pairing => pairing.id);
  const allocationResult = pairingIds.length
    ? await supabase.from('adjudicator_allocations').select('pairing_id,adjudicator_id,role').in('pairing_id', pairingIds)
    : { data: [], error: null };

  const firstError = [roundResult, pairingResult, allocationResult, teamResult, judgeResult, feedbackResult].find(result => result.error)?.error;
  if (firstError) {
    renderAppLayout(container, '/tournament/feedback', 'Adjudicator feedback', 'Feedback completion tracker', `<div class="card" style="padding:24px;color:#b91c1c;">${escapeHtml(firstError.message)}</div>`);
    return;
  }

  const rounds = roundResult.data || [];
  const completedRoundIds = new Set(rounds.filter(round => String(round.status || '').toLowerCase() === 'completed').map(round => round.id));
  const roundMap = new Map(rounds.map(round => [round.id, round]));
  const teamMap = new Map((teamResult.data || []).map(team => [team.id, team]));
  const judgeMap = new Map((judgeResult.data || []).map(judge => [judge.id, judge]));
  const allocationsByPairing = new Map();
  (allocationResult.data || []).forEach(allocation => {
    const rows = allocationsByPairing.get(allocation.pairing_id) || [];
    rows.push(allocation);
    allocationsByPairing.set(allocation.pairing_id, rows);
  });
  const submittedKeys = new Set((feedbackResult.data || []).map(item => keyFor(item.pairing_id, item.submitted_by_id, item.target_judge_id)));
  const expected = [];

  (pairingResult.data || []).forEach(pairing => {
    if (!completedRoundIds.has(pairing.round_id) && !(pairing.ballots || []).length) return;
    const round = roundMap.get(pairing.round_id);
    const panel = [
      ...(pairing.chair_id ? [{ id: pairing.chair_id, role: 'Chair' }] : []),
      ...(allocationsByPairing.get(pairing.id) || [])
        .filter(item => ['WING', 'TRAINEE'].includes(item.role))
        .map(item => ({ id: item.adjudicator_id, role: item.role === 'TRAINEE' ? 'Trainee' : 'Wing' }))
    ];
    const context = { pairingId: pairing.id, round: round?.name || `Round ${round?.round_num || ''}`, roundNum: round?.round_num || 0, room: pairing.room_label || 'Room TBD' };

    [pairing.og_team_id, pairing.oo_team_id, pairing.cg_team_id, pairing.co_team_id].filter(Boolean).forEach(teamId => {
      panel.forEach(target => expected.push({
        ...context,
        type: 'Team',
        submitterId: teamId,
        submitter: teamMap.get(teamId)?.name || 'Unknown team',
        targetId: target.id,
        target: judgeMap.get(target.id)?.name || 'Unknown judge',
        targetRole: target.role
      }));
    });

    if (pairing.chair_id) {
      panel.filter(target => target.id !== pairing.chair_id).forEach(target => expected.push({
        ...context,
        type: 'Judge',
        submitterId: pairing.chair_id,
        submitter: judgeMap.get(pairing.chair_id)?.name || 'Unknown judge',
        targetId: target.id,
        target: judgeMap.get(target.id)?.name || 'Unknown judge',
        targetRole: target.role
      }));
      panel.filter(target => target.id !== pairing.chair_id).forEach(judge => expected.push({
        ...context,
        type: 'Judge',
        submitterId: judge.id,
        submitter: judgeMap.get(judge.id)?.name || 'Unknown judge',
        targetId: pairing.chair_id,
        target: judgeMap.get(pairing.chair_id)?.name || 'Unknown judge',
        targetRole: 'Chair'
      }));
    }
  });

  const itemRows = expected.map(item => ({ ...item, submitted: submittedKeys.has(keyFor(item.pairingId, item.submitterId, item.targetId)) }));
  const participantGroups = new Map();
  itemRows.forEach(item => {
    const groupKey = `${item.pairingId}:${item.type}:${item.submitterId}`;
    const group = participantGroups.get(groupKey) || { ...item, targets: [], completedTargets: 0 };
    group.targets.push(`${item.target} (${item.targetRole})`);
    if (item.submitted) group.completedTargets += 1;
    participantGroups.set(groupKey, group);
  });
  const rows = [...participantGroups.values()].map(row => ({
    ...row,
    status: row.completedTargets === row.targets.length ? 'submitted' : row.completedTargets > 0 ? 'partial' : 'missing'
  }));
  const submittedCount = rows.filter(row => row.status === 'submitted').length;
  const partialCount = rows.filter(row => row.status === 'partial').length;
  const missingCount = rows.filter(row => row.status === 'missing').length;
  const completion = rows.length ? Math.round(submittedCount / rows.length * 100) : 0;
  const scores = (feedbackResult.data || []).map(item => Number(item.score)).filter(Number.isFinite);
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2) : '—';

  window.tcFilterFeedbackCompletion = () => {
    const query = String(document.getElementById('feedback-completion-search')?.value || '').toLowerCase();
    const status = document.getElementById('feedback-completion-status')?.value || 'all';
    document.querySelectorAll('[data-feedback-completion-row]').forEach(row => {
      const matchesQuery = row.dataset.search.includes(query);
      const matchesStatus = status === 'all' || row.dataset.status === status;
      row.style.display = matchesQuery && matchesStatus ? '' : 'none';
    });
  };

  const content = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;"><a href="#/tournament/feedback-sandbox" class="btn btn--outline" style="border-color:#f97316;color:#c2410c;">${icon('messageSquare', 16)} Open TEST ONLY feedback sandbox</a></div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px;">
      ${[['Expected participants', rows.length], ['Completed', submittedCount], ['Not started', missingCount], ['Completion', `${completion}%`]].map(([label, value]) => `<div class="card" style="padding:18px;"><div style="font-size:12px;color:#64748b;">${label}</div><div style="font-size:26px;font-weight:900;margin-top:6px;">${value}</div>${label === 'Completed' && partialCount ? `<div style="font-size:11px;color:#d97706;margin-top:4px;">${partialCount} partially completed</div>` : ''}</div>`).join('')}
    </div>
    <section class="card" style="padding:20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px;"><div><h2 style="font-size:18px;font-weight:900;margin:0 0 4px;">Who has submitted feedback?</h2><p style="font-size:13px;color:#64748b;margin:0;">Feedback is optional; this tracker never locks participant access.</p></div><div style="font-size:13px;color:#64748b;">Average submitted score: <strong>${average}</strong></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;"><input id="feedback-completion-search" class="form-input" style="max-width:360px;" type="search" placeholder="Search person, round, room or judge..." oninput="window.tcFilterFeedbackCompletion()"><select id="feedback-completion-status" class="form-input" style="max-width:200px;" onchange="window.tcFilterFeedbackCompletion()"><option value="all">All statuses</option><option value="missing">Not started</option><option value="partial">Partially completed</option><option value="submitted">Completed</option></select></div>
      <div style="overflow:auto;"><table style="width:100%;min-width:840px;border-collapse:collapse;font-size:13px;"><thead style="background:#f8fafc;"><tr><th style="padding:11px;text-align:left;">Participant</th><th style="padding:11px;text-align:left;">Type</th><th style="padding:11px;text-align:left;">Round / Room</th><th style="padding:11px;text-align:left;">Judges to rate</th><th style="padding:11px;text-align:left;">Status</th></tr></thead><tbody>${rows.sort((a,b)=>a.roundNum-b.roundNum || a.submitter.localeCompare(b.submitter)).map(row => { const complete = row.status === 'submitted'; const partial = row.status === 'partial'; return `<tr data-feedback-completion-row data-status="${row.status}" data-search="${escapeHtml(`${row.submitter} ${row.type} ${row.round} ${row.room} ${row.targets.join(' ')}`.toLowerCase())}" style="border-top:1px solid #eef2f7;"><td style="padding:11px;font-weight:800;">${escapeHtml(row.submitter)}</td><td style="padding:11px;">${row.type}</td><td style="padding:11px;">${escapeHtml(row.round)} · ${escapeHtml(row.room)}</td><td style="padding:11px;">${escapeHtml(row.targets.join(', '))}</td><td style="padding:11px;"><span style="padding:4px 8px;border-radius:999px;font-weight:800;background:${complete ? '#ecfdf5' : partial ? '#fffbeb' : '#fff7ed'};color:${complete ? '#047857' : partial ? '#b45309' : '#c2410c'};">${complete ? 'Completed' : partial ? `${row.completedTargets}/${row.targets.length} rated` : 'Not started'}</span></td></tr>`; }).join('') || '<tr><td colspan="5" style="padding:24px;text-align:center;color:#64748b;">No completed-round feedback is expected yet.</td></tr>'}</tbody></table></div>
    </section>
    <section class="card" style="padding:20px;"><h2 style="font-size:16px;font-weight:900;margin:0 0 12px;">Submitted feedback (${feedbackResult.data.length})</h2><div style="display:grid;gap:10px;">${(feedbackResult.data || []).map(item => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong>${escapeHtml(judgeMap.get(item.target_judge_id)?.name || 'Judge')}</strong> · ${escapeHtml(String(item.score))}/10${item.is_anonymous ? ' · Anonymous to judge' : ''}${item.comments ? `<div style="margin-top:5px;color:#475569;">${escapeHtml(item.comments)}</div>` : ''}</div>`).join('') || '<div style="color:#64748b;">No feedback has been submitted yet.</div>'}</div></section>
  `;

  renderAppLayout(container, '/tournament/feedback', 'Adjudicator feedback', 'Track submitted and outstanding feedback by participant.', content);
}
