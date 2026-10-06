import { escapeHtml as h } from '../lib/html.js';
export { h };
export const button = (label, attrs = '', secondary = false) => `<button class="btn ${secondary ? 'btn--outline' : 'btn--primary'}" ${attrs}>${h(label)}</button>`;
export const field = (label, input) => `<label class="ps-field"><span>${h(label)}</span>${input}</label>`;
export const input = (name, value = '', attrs = '') => `<input class="form-input" name="${h(name)}" value="${h(value)}" ${attrs}>`;
export const select = (name, options, value = '') => `<select class="form-input form-select" name="${h(name)}">${options.map(([id, label]) => `<option value="${h(id)}" ${String(id) === String(value) ? 'selected' : ''}>${h(label)}</option>`).join('')}</select>`;
export const card = (title, body) => `<section class="card ps-card"><h2>${h(title)}</h2>${body}</section>`;
export const empty = message => `<p class="ps-empty">${h(message)}</p>`;
export const nameOf = (people, id) => people.find(p => p.id === id)?.name || 'Unknown participant';
export const table = (headers, rows) => `<div class="ps-table-wrap"><table class="ps-table"><thead><tr>${headers.map(v => `<th scope="col">${h(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function standingsTable(rows, scoring) {
  if (!rows.length) return empty('Standings appear after a round is completed and its ballots are approved.');
  return table(['Place', 'Speaker', 'Institution', 'Rounds', 'Total score', 'Average score', 'Rank total'], rows.map(r => [h(r.place), h(r.name), h(r.institution || '—'), h(r.rounds), `<strong>${r.score.toFixed(2)}</strong>`, r.average.toFixed(2), r.rankTotal.toFixed(2)])) + `<p class="ps-help">${scoring === 'rank' ? 'Lowest cumulative mean rank wins; total score breaks ties.' : 'Highest total score wins; cumulative mean rank breaks ties.'} Scores are out of 100 per round. Equal judge and round weight. Exact ties share a place.</p>`;
}
export function csvDownload(name, headers, rows) {
  const cell = value => { const s = String(value ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\ufeff' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function showDialog(title, html, onSubmit) {
  document.getElementById('ps-dialog')?.remove();
  const dialog = document.createElement('dialog'); dialog.id = 'ps-dialog'; dialog.className = 'ps-dialog ps';
  dialog.innerHTML = `<div class="ps-dialog-heading"><h2>${h(title)}</h2>${button('Close', 'type="button" data-close', true)}</div><p class="ps-error" role="alert" hidden></p>${html}`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.querySelector('form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const submitter = e.submitter;
    dialog.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = true);
    try { const result = await onSubmit(new FormData(e.target), submitter?.value); if (result !== 'keep-open') dialog.close(); }
    catch (error) { const el = dialog.querySelector('[role="alert"]'); el.textContent = error.message; el.hidden = false; }
    finally { dialog.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = false); }
  });
  return dialog;
}

const fmt = (x, places = 2) => (Math.round(x * 10 ** places) / 10 ** places).toFixed(places);
// Display-only total for the review screen. The server recalculates and is authoritative.
function previewTotal(event, row) {
  const raw = event.rubric.reduce((t, c, j) => t + row.scores[j] / c.max * c.weight, 0);
  const p = event.penalty, limit = event.durationSeconds + (event.graceSeconds ?? 15);
  const penalty = p?.method === 'overtime' && Number.isFinite(row.elapsedSeconds) ? Math.min(Math.ceil(Math.max(0, row.elapsedSeconds - limit) / p.stepSeconds) * p.pointsPerStep, p.cap) : 0;
  return { raw, penalty, total: Math.max(0, raw - penalty) };
}

export function ballotView(event, ballot) {
  const timed = ballot.rows.some(r => r.elapsedSeconds != null);
  const rows = [...ballot.rows].sort((a, b) => a.rank - b.rank);
  const notes = rows.map(r => [['What worked', r.worked], ['What to improve', r.improve], ['What to try next', r.nextStep], ['Other comments', r.feedback]].filter(([, v]) => v).map(([k, v]) => `<p class="ps-feedback-text"><strong>${h(nameOf(event.speakers, r.speakerId))} — ${k}:</strong> ${h(v)}</p>`).join('')).join('');
  return table(['Speaker', 'Rank', ...event.rubric.map(c => c.name), ...(timed ? ['Time (s)'] : [])], rows.map(r => [h(nameOf(event.speakers, r.speakerId)), r.rank, ...r.scores, ...(timed ? [r.elapsedSeconds ?? '—'] : [])])) + (notes || '<p class="ps-help">No written feedback.</p>');
}

export function ballotDialog(event, round, room, judgeId, admin, submit) {
  const ballot = round.ballots.find(b => b.roomId === room.id && b.judgeId === judgeId);
  const timed = event.penalty?.method === 'overtime';
  const area = (name, label, value, hint) => field(label, `<textarea class="form-input" name="${name}" maxlength="3000" rows="2" placeholder="${h(hint)}">${h(value || '')}</textarea>`);
  const html = `<form><p class="ps-help">${h(round.name)} · ${h(room.name)} · ${h(nameOf(event.judges, judgeId))}. Speakers are listed in speaking order. Rank every speaker from 1 (best) to ${room.speakers.length}, without ties. Each criterion counts as (mark ÷ maximum) × weight, for a total out of 100.</p>
    ${room.speakers.map((speakerId, i) => {
      const row = ballot?.rows.find(r => r.speakerId === speakerId);
      return `<fieldset class="ps-ballot-speaker"><legend>${i + 1}. ${h(nameOf(event.speakers, speakerId))}</legend><div class="ps-grid">${event.rubric.map((c, j) => field(`${c.name} / ${c.max} (${c.weight}%)`, input(`score-${i}-${j}`, row?.scores[j] ?? '', `type="number" inputmode="decimal" min="${c.min || 0}" max="${c.max}" step="${c.step || 1}" required`) + (c.description ? `<small class="ps-help">${h(c.description)}</small>` : ''))).join('')}${field('Rank', input(`rank-${i}`, row?.rank ?? '', `type="number" inputmode="numeric" min="1" max="${room.speakers.length}" required`))}${timed ? field('Elapsed time (seconds)', input(`elapsed-${i}`, row?.elapsedSeconds ?? '', 'type="number" inputmode="numeric" min="0" max="7200" required')) : ''}</div>
        ${area(`worked-${i}`, 'What worked', row?.worked, 'Specific strengths in this speech')}${area(`improve-${i}`, 'What to improve', row?.improve, 'The most important thing to change')}${area(`next-${i}`, 'What to try next', row?.nextStep, 'A concrete exercise or goal')}
        ${field('Other comments (optional)', `<textarea class="form-input" name="feedback-${i}" maxlength="5000" rows="2">${h(row?.feedback || '')}</textarea>`)}</fieldset>`;
    }).join('')}
    ${admin ? field('Reason for entering on behalf of this judge', input('reason', '', 'required maxlength="1000"')) : ''}
    <section class="ps-review" data-review hidden aria-live="polite"></section>
    <div class="ps-actions">${button('Save draft', 'type="submit" value="draft"', true)}${button('Review before submitting', 'type="submit" value="review" data-review-button')}${button('Confirm and submit', 'type="submit" value="submitted" data-confirm hidden')}</div><p class="ps-help">Drafts need complete scores and ranks. A ballot only counts as submitted once the server confirms it; submitted ballots are locked until tab reopens them.</p></form>`;
  const rowsFrom = fd => room.speakers.map((speakerId, i) => ({
    speakerId, scores: event.rubric.map((_, j) => Number(fd.get(`score-${i}-${j}`))), rank: Number(fd.get(`rank-${i}`)),
    elapsedSeconds: timed ? Number(fd.get(`elapsed-${i}`)) : null,
    worked: fd.get(`worked-${i}`), improve: fd.get(`improve-${i}`), nextStep: fd.get(`next-${i}`), feedback: fd.get(`feedback-${i}`)
  }));
  const dialog = showDialog('Public speaking ballot', html, async (fd, status) => {
    const rows = rowsFrom(fd);
    if (status === 'review') {
      const review = dialog.querySelector('[data-review]');
      review.innerHTML = `<h3>Check this ballot</h3>${table(['Speaker', 'Rank', 'Total', ...(timed ? ['Penalty'] : [])], [...rows].sort((a, b) => a.rank - b.rank).map(r => { const t = previewTotal(event, r); return [h(nameOf(event.speakers, r.speakerId)), r.rank, fmt(t.total), ...(timed ? [t.penalty ? `−${t.penalty}` : '0'] : [])]; }))}<p class="ps-help">Totals shown here are a preview; the server recalculates them. Edit anything above, or confirm.</p>`;
      review.hidden = false; dialog.querySelector('[data-confirm]').hidden = false; review.scrollIntoView({ block: 'nearest' });
      return 'keep-open';
    }
    return submit({ roundId: round.id, roomId: room.id, judgeId, status, reason: fd.get('reason'), rows });
  });
  dialog.querySelector('form').addEventListener('input', () => { dialog.querySelector('[data-review]').hidden = true; dialog.querySelector('[data-confirm]').hidden = true; });
}
