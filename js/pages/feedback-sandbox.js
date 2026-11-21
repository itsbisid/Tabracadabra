import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { escapeHtml, escapeJsString } from '../lib/html.js';
import { requireActiveTournamentId } from '../lib/tournament-context.js';
import { supabase } from '../lib/supabase.js';
import {
  calculateSandboxBreak,
  createFeedbackSandbox,
  deleteFeedbackSandbox,
  feedbackSandboxUrl,
  loadFeedbackSandbox,
  saveFeedbackSandbox
} from '../lib/feedback-sandbox.js';

const testBanner = `
  <div style="background:#fff7ed; border:2px solid #f97316; color:#9a3412; border-radius:10px; padding:12px 16px; font-weight:900; letter-spacing:.04em; margin-bottom:18px;">
    TEST ONLY · ISOLATED SANDBOX · DOES NOT AFFECT LIVE TOURNAMENT DATA
  </div>`;

function notice(container, title, message) {
  container.innerHTML = `<main style="min-height:100vh; display:grid; place-items:center; background:#f8fafc; padding:24px;"><section style="width:min(520px,100%); background:white; border:1px solid #e2e8f0; border-radius:12px; padding:32px; text-align:center;"><div style="color:#f97316; margin-bottom:12px;">${icon('alertCircle', 30)}</div><h1 style="font-size:22px; margin-bottom:8px;">${escapeHtml(title)}</h1><p style="color:#64748b;">${escapeHtml(message)}</p></section></main>`;
}

async function purgeIfTournamentEnded(sandbox) {
  if (!sandbox?.tournamentId) return false;
  const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', sandbox.tournamentId).maybeSingle();
  const settings = tournament?.settings || {};
  const endValue = tournament?.end_date || tournament?.ends_at || settings.end_date || settings.ends_at || settings.tournament_end_at;
  const endedByStatus = ['completed', 'ended', 'archived'].includes(String(tournament?.status || '').toLowerCase());
  const endedByTime = endValue && Number.isFinite(new Date(endValue).getTime()) && new Date(endValue).getTime() <= Date.now();
  if (endedByStatus || endedByTime) {
    deleteFeedbackSandbox();
    return true;
  }
  return false;
}

function renderBreakRows(sandbox) {
  return sandbox.judges.map(judge => {
    const before = calculateSandboxBreak(judge, []);
    const after = calculateSandboxBreak(judge, sandbox.feedback);
    const delta = after.score - before.score;
    return `<tr>
      <td><strong>${escapeHtml(judge.name)}</strong><small>${escapeHtml(judge.role)}</small></td>
      <td>${after.count ? after.average.toFixed(2) : '—'}</td><td>${after.adjustedAverage.toFixed(2)}</td>
      <td>${after.volumeScore.toFixed(1)}</td><td>${after.experienceScore.toFixed(1)}</td><td>${judge.adminEvaluation.toFixed(1)}</td>
      <td><strong>${after.score.toFixed(2)}</strong><small style="color:${delta >= 0 ? '#047857' : '#b91c1c'};">${delta >= 0 ? '+' : ''}${delta.toFixed(2)} test change</small></td>
    </tr>`;
  }).join('');
}

export async function renderFeedbackSandboxAdmin(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  window.tcCreateFeedbackSandbox = () => {
    const existing = loadFeedbackSandbox();
    if (existing && !confirm('Replace the current TEST ONLY sandbox and delete its test feedback?')) return;
    createFeedbackSandbox(tournamentId);
    renderFeedbackSandboxAdmin(container);
  };
  window.tcDeleteFeedbackSandbox = () => {
    deleteFeedbackSandbox();
    renderFeedbackSandboxAdmin(container);
  };
  window.tcCopySandboxUrl = url => navigator.clipboard.writeText(url).then(() => alert('TEST ONLY private URL copied.'));

  const sandbox = loadFeedbackSandbox();
  if (sandbox && await purgeIfTournamentEnded(sandbox)) {
    renderFeedbackSandboxAdmin(container);
    return;
  }
  const url = sandbox ? feedbackSandboxUrl(sandbox) : '';
  const feedbackCards = sandbox?.feedback.map(item => {
    const judge = sandbox.judges.find(entry => entry.id === item.judgeId);
    return `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px;"><div style="display:flex; justify-content:space-between; gap:12px;"><strong>${escapeHtml(judge?.name || 'Test judge')} · ${escapeHtml(judge?.role || '')}</strong><span style="font-weight:900; color:#0f766e;">${item.rating}/10</span></div><p style="margin:8px 0 0; color:#475569;">${escapeHtml(item.comments)}</p></div>`;
  }).join('') || '<p style="color:#64748b;">No TEST ONLY feedback submitted yet.</p>';

  const content = `${testBanner}
    ${!sandbox ? `<section class="card" style="padding:30px; text-align:center;"><h2 style="margin-bottom:8px;">Speaker-to-judge feedback sandbox</h2><p style="color:#64748b; margin-bottom:18px;">Creates browser-local mock data only. Nothing is written to Supabase.</p><button class="btn btn--primary" onclick="window.tcCreateFeedbackSandbox()">${icon('plus',16)} Create TEST ONLY environment</button></section>` : `
      <section class="card" style="padding:20px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;"><div><h2>${escapeHtml(sandbox.speaker.name)}</h2><p style="color:#64748b;">${escapeHtml(sandbox.round.name)} · expires ${escapeHtml(new Date(sandbox.expiresAt).toLocaleString())}</p></div><button class="btn btn--outline" style="color:#b91c1c;" onclick="window.tcDeleteFeedbackSandbox()">${icon('trash',16)} Delete test now</button></div>
        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;"><a class="btn btn--primary" href="${escapeHtml(url)}" target="_blank">${icon('link',16)} Open speaker URL</a><button class="btn btn--outline" onclick="window.tcCopySandboxUrl('${escapeJsString(url)}')">${icon('copy',16)} Copy URL</button></div>
        <div style="margin-top:12px; padding:10px; background:#f8fafc; word-break:break-all; font-size:12px;">${escapeHtml(url)}</div>
      </section>
      <section class="card" style="padding:20px; margin-bottom:16px;"><h3 style="margin-bottom:12px;">Submitted TEST ONLY feedback (${sandbox.feedback.length}/${sandbox.judges.length})</h3><div style="display:grid; gap:10px;">${feedbackCards}</div></section>
      <section class="card" style="padding:20px; overflow:auto;"><h3>Judge-break impact preview</h3><p style="color:#64748b; font-size:13px; margin:4px 0 14px;">Uses the real weighting formula for illustration, but never changes live rankings.</p><table class="sandbox-table" style="width:100%; min-width:820px;"><thead><tr><th>Judge</th><th>Raw feedback</th><th>Robust adjusted</th><th>Rounds</th><th>Experience</th><th>Admin</th><th>Preview score</th></tr></thead><tbody>${renderBreakRows(sandbox)}</tbody></table></section>`}
    <style>.sandbox-table{border-collapse:collapse;font-size:13px}.sandbox-table th,.sandbox-table td{padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:left}.sandbox-table th{background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase}.sandbox-table small{display:block;color:#64748b}</style>`;
  renderAppLayout(container, '/tournament/feedback', 'TEST ONLY feedback sandbox', 'Isolated speaker-to-judge feedback preview', content);
}

export async function renderFeedbackSandboxSpeaker(container, sandboxId) {
  const initialSandbox = loadFeedbackSandbox();
  if (initialSandbox && await purgeIfTournamentEnded(initialSandbox)) {
    notice(container, 'TEST link expired', 'This TEST ONLY private URL expired when the tournament ended. No previous data is available.');
    return;
  }
  const render = (message = '', error = '') => {
    const sandbox = loadFeedbackSandbox();
    if (!sandbox || sandbox.id !== sandboxId) {
      notice(container, 'TEST link expired', 'This TEST ONLY private URL has expired or its administrator deleted the sandbox. No previous data is available.');
      return;
    }
    const completed = new Set(sandbox.feedback.map(item => item.judgeId));
    container.innerHTML = `<main style="min-height:100vh; background:#f4f7fb; padding:24px;"><div style="max-width:900px; margin:auto;">${testBanner}
      <section style="background:#0f2b5b; color:white; border-radius:12px; padding:24px; margin-bottom:16px;"><div style="color:#fdba74; font-size:11px; font-weight:900;">TEST ONLY PRIVATE SPEAKER URL</div><h1 style="margin:6px 0;">${escapeHtml(sandbox.speaker.name)}</h1><p>${escapeHtml(sandbox.speaker.team)} · ${escapeHtml(sandbox.speaker.institution)}</p></section>
      ${message ? `<div style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:12px; border-radius:8px; margin-bottom:14px;">${escapeHtml(message)}</div>` : ''}
      ${error ? `<div style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:12px; border-radius:8px; margin-bottom:14px;">${escapeHtml(error)}</div>` : ''}
      <section class="card" style="padding:20px; margin-bottom:16px;"><h2>${escapeHtml(sandbox.round.name)}</h2><div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:12px;"><div><small>Room</small><strong>${escapeHtml(sandbox.round.room)}</strong></div><div><small>Position</small><strong>${escapeHtml(sandbox.round.position)}</strong></div><div><small>Opponents</small><strong>${escapeHtml(sandbox.round.opponents.join(', '))}</strong></div></div><div style="margin-top:14px; padding:12px; background:#eff6ff; border-radius:8px;"><small>Motion</small><strong>${escapeHtml(sandbox.round.motion)}</strong></div></section>
      <section class="card" style="padding:20px;"><h2 style="margin-bottom:4px;">Rate each assigned judge</h2><p style="color:#64748b; margin-bottom:16px;">Submit a separate form for every judge. Duplicate submissions are blocked.</p><div style="display:grid; gap:14px;">${sandbox.judges.map(judge => completed.has(judge.id) ? `<div style="padding:16px; border:1px solid #a7f3d0; background:#ecfdf5; border-radius:10px;"><strong>${escapeHtml(judge.name)} · ${escapeHtml(judge.role)}</strong><div style="color:#047857;">Feedback submitted successfully.</div><button type="button" data-test-duplicate="${escapeHtml(judge.id)}" class="btn btn--outline btn--sm" style="margin-top:8px;">Test duplicate protection</button></div>` : `<form data-test-feedback-form novalidate style="padding:16px; border:1px solid #e2e8f0; border-radius:10px; display:grid; gap:10px;"><input type="hidden" name="judge_id" value="${escapeHtml(judge.id)}"><strong>${escapeHtml(judge.name)} · ${escapeHtml(judge.role)}</strong><label>Rating (1–10)<input name="rating" type="number" min="1" max="10" class="form-input"></label><label>Written comments<textarea name="comments" rows="3" class="form-input"></textarea></label><button class="btn btn--primary" type="submit">Submit feedback for ${escapeHtml(judge.name)}</button></form>`).join('')}</div></section>
    </div></main>`;
    container.querySelectorAll('[data-test-feedback-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      const latest = loadFeedbackSandbox();
      if (!latest || latest.id !== sandboxId) { render('', 'This TEST ONLY link has expired.'); return; }
      const data = new FormData(form);
      const judgeId = String(data.get('judge_id'));
      const rating = Number(data.get('rating'));
      const comments = String(data.get('comments') || '').trim();
      if (!latest.judges.some(judge => judge.id === judgeId)) { render('', 'That judge is not assigned to this TEST ONLY round.'); return; }
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) { render('', 'Rating must be a whole number from 1 to 10.'); return; }
      if (!comments) { render('', 'Written comments are required for this test.'); return; }
      if (latest.feedback.some(item => item.judgeId === judgeId)) { render('', 'Duplicate feedback is not allowed for this judge.'); return; }
      latest.feedback.push({ judgeId, rating, comments, submittedAt: new Date().toISOString(), testOnly: true });
      saveFeedbackSandbox(latest);
      render(`TEST ONLY feedback saved for ${latest.judges.find(judge => judge.id === judgeId)?.name}.`);
    }));
    container.querySelectorAll('[data-test-duplicate]').forEach(button => button.addEventListener('click', () => {
      render('', 'Duplicate feedback is not allowed for this judge.');
    }));
  };
  render();
}
