import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';
import { isAdmin } from '../../lib/auth-helpers.js';

export async function renderAdjudicatorBreak(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  let breakSize = 8;
  let isUserAdmin = false;
  let currentRankings = [];

  const numberOrZero = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const buildRankings = (adjudicators, feedback) => {
    const feedbackByJudge = new Map();
    for (const item of feedback || []) {
      if (!item.target_judge_id) continue;
      const entry = feedbackByJudge.get(item.target_judge_id) || { total: 0, count: 0 };
      const score = Number(item.score);
      if (Number.isFinite(score)) {
        entry.total += score;
        entry.count += 1;
      }
      feedbackByJudge.set(item.target_judge_id, entry);
    }

    return (adjudicators || [])
      .filter(adjudicator => (adjudicator.status || 'Active') !== 'Inactive')
      .map(adjudicator => {
        const summary = feedbackByJudge.get(adjudicator.id) || { total: 0, count: 0 };
        return {
          ...adjudicator,
          tabScore: numberOrZero(adjudicator.score),
          feedbackCount: summary.count,
          feedbackAverage: summary.count ? summary.total / summary.count : null
        };
      })
      .sort((a, b) => {
        const feedbackOrder = (b.feedbackAverage ?? -1) - (a.feedbackAverage ?? -1);
        return feedbackOrder
          || (b.tabScore - a.tabScore)
          || String(a.name || '').localeCompare(String(b.name || ''));
      });
  };

  const updateSettings = async patch => {
    const { data, error: readError } = await supabase
      .from('tournaments')
      .select('settings')
      .eq('id', tournamentId)
      .single();
    if (readError) return readError;

    const settings = { ...(data?.settings || {}), ...patch };
    const { error } = await supabase.from('tournaments').update({ settings }).eq('id', tournamentId);
    return error;
  };

  window.tcSaveAdjudicatorBreakSize = async () => {
    if (!isUserAdmin) {
      alert('Only tournament admins can change the adjudicator break.');
      return;
    }
    const input = document.getElementById('adjudicator-break-size');
    const value = Math.max(1, parseInt(input?.value, 10) || breakSize);
    const error = await updateSettings({ adjudicator_break_size: value });
    if (error) {
      alert('Could not save the break size: ' + error.message);
      return;
    }
    breakSize = value;
    fetchAndRender();
  };

  window.tcPublishAdjudicatorBreak = async () => {
    if (!isUserAdmin) {
      alert('Only tournament admins can publish the adjudicator break.');
      return;
    }
    if (!confirm(`Publish the top ${breakSize} adjudicators as the adjudicator break?`)) return;

    const error = await updateSettings({
      adjudicator_break_size: breakSize,
      adjudicator_break_ids: currentRankings.slice(0, breakSize).map(adjudicator => adjudicator.id),
      is_adjudicator_break_released: true
    });
    if (error) {
      alert('Could not publish the adjudicator break: ' + error.message);
      return;
    }
    alert('Adjudicator break published.');
    fetchAndRender();
  };

  const fetchAndRender = async () => {
    isUserAdmin = await isAdmin(tournamentId);
    const [tournamentResult, adjudicatorResult, feedbackResult] = await Promise.all([
      supabase.from('tournaments').select('settings').eq('id', tournamentId).single(),
      supabase.from('adjudicators').select('*').eq('tournament_id', tournamentId),
      supabase.from('judge_feedback').select('target_judge_id,score').eq('tournament_id', tournamentId)
    ]);

    if (adjudicatorResult.error) {
      alert('Could not load adjudicators: ' + adjudicatorResult.error.message);
      return;
    }

    const settings = tournamentResult.data?.settings || {};
    const savedSize = Number(settings.adjudicator_break_size);
    if (Number.isFinite(savedSize) && savedSize > 0) breakSize = savedSize;
    currentRankings = buildRankings(adjudicatorResult.data, feedbackResult.data);
    renderUI(settings, currentRankings);
  };

  const renderUI = (settings, rankings) => {
    const released = Boolean(settings.is_adjudicator_break_released);
    const rows = rankings.map((adjudicator, index) => {
      const rank = index + 1;
      const breaking = rank <= breakSize;
      const firstOut = rank === breakSize + 1;
      const feedbackScore = adjudicator.feedbackAverage == null ? '-' : adjudicator.feedbackAverage.toFixed(2);

      return `
        <tr style="border-bottom:1px solid #f1f5f9; background:${breaking ? '#f0fdf4' : 'white'};">
          <td style="padding:14px 16px; font-weight:800; color:${breaking ? '#059669' : '#64748b'};">#${rank}</td>
          <td style="padding:14px 16px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong>${escapeHtml(adjudicator.name || 'Unnamed adjudicator')}</strong>
              <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:#1d4ed8; background:#dbeafe; padding:2px 7px; border-radius:4px;">Adjudicator</span>
              ${adjudicator.is_trainee ? '<span style="font-size:10px; font-weight:800; color:#b45309; background:#fef3c7; padding:2px 7px; border-radius:4px;">Trainee</span>' : ''}
            </div>
            <div style="font-size:11px; color:#64748b; margin-top:3px;">${escapeHtml(adjudicator.institution || 'Independent')}</div>
          </td>
          <td style="padding:14px 16px; text-align:center; font-weight:700;">${feedbackScore}</td>
          <td style="padding:14px 16px; text-align:center; color:#64748b;">${adjudicator.feedbackCount}</td>
          <td style="padding:14px 16px; text-align:center; font-weight:700;">${adjudicator.tabScore.toFixed(1)}</td>
          <td style="padding:14px 16px; text-align:right;">
            ${breaking ? '<span style="font-size:10px; font-weight:800; color:#059669; text-transform:uppercase;">Breaking</span>' : (firstOut ? '<span style="font-size:10px; font-weight:800; color:#dc2626; text-transform:uppercase;">First out</span>' : '')}
          </td>
        </tr>
        ${breaking && rank === breakSize ? '<tr><td colspan="6" style="padding:0;"><div style="height:2px; background:#10b981;"></div></td></tr>' : ''}
      `;
    }).join('');

    const controls = isUserAdmin ? `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <label for="adjudicator-break-size" style="font-size:13px; font-weight:700;">Break size</label>
        <input id="adjudicator-break-size" type="number" min="1" value="${breakSize}" style="width:78px; border:1px solid var(--color-border-strong); border-radius:6px; padding:7px 10px;">
        <button onclick="window.tcSaveAdjudicatorBreakSize()" class="btn btn--outline btn--sm">Apply</button>
        <button onclick="window.tcPublishAdjudicatorBreak()" class="btn btn--primary btn--sm" style="gap:7px;">${icon('gavel', 14)} Publish break</button>
      </div>
    ` : '<span style="font-size:13px; color:#64748b;">Read-only adjudicator break.</span>';

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:20px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; margin-bottom:4px;">Adjudicator break</h1>
          <p style="font-size:14px; color:var(--color-text-muted); margin:0;">Ranked by confirmed feedback average, then tab score.</p>
        </div>
        <span class="badge ${released ? 'badge--active' : 'badge--draft'}">${released ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
      </div>

      <div class="card" style="padding:16px 20px; margin-bottom:16px;">${controls}</div>

      <div class="card" style="padding:0; overflow:auto;">
        <table style="width:100%; min-width:720px; border-collapse:collapse; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:14px 16px; text-align:left; font-size:11px; text-transform:uppercase; color:#64748b; width:70px;">Rank</th>
              <th style="padding:14px 16px; text-align:left; font-size:11px; text-transform:uppercase; color:#64748b;">Adjudicator</th>
              <th style="padding:14px 16px; text-align:center; font-size:11px; text-transform:uppercase; color:#64748b;">Feedback</th>
              <th style="padding:14px 16px; text-align:center; font-size:11px; text-transform:uppercase; color:#64748b;">Responses</th>
              <th style="padding:14px 16px; text-align:center; font-size:11px; text-transform:uppercase; color:#64748b;">Tab score</th>
              <th style="padding:14px 16px; text-align:right; font-size:11px; text-transform:uppercase; color:#64748b;">Break</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${rankings.length === 0 ? '<div style="padding:48px; text-align:center; color:#64748b;">No active adjudicators in this tournament.</div>' : ''}
      </div>
    `;

    renderAppLayout(container, '/tournament/adjudicator-break', 'Adjudicator break', '', content);
  };

  fetchAndRender();
}
