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
    try { await onSubmit(new FormData(e.target), submitter?.value); dialog.close(); }
    catch (error) { const el = dialog.querySelector('[role="alert"]'); el.textContent = error.message; el.hidden = false; }
    finally { dialog.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = false); }
  });
  return dialog;
}

export function ballotDialog(event, round, room, judgeId, admin, submit) {
  const ballot = round.ballots.find(b => b.roomId === room.id && b.judgeId === judgeId);
  const html = `<form><p class="ps-help">${h(round.name)} · ${h(room.name)} · ${h(nameOf(event.judges, judgeId))}. Rank every speaker from 1 (best) to ${room.speakers.length}, without ties. Each criterion contributes its weight to a score out of 100.</p>
    ${room.speakers.map((speakerId, i) => {
      const row = ballot?.rows.find(r => r.speakerId === speakerId);
      return `<fieldset class="ps-ballot-speaker"><legend>${i + 1}. ${h(nameOf(event.speakers, speakerId))}</legend><div class="ps-grid">${event.rubric.map((c, j) => field(`${c.name} / ${c.max} (${c.weight}%)`, input(`score-${i}-${j}`, row?.scores[j] ?? '', `type="number" min="0" max="${c.max}" step="0.01" required`))).join('')}${field('Rank', input(`rank-${i}`, row?.rank ?? '', `type="number" min="1" max="${room.speakers.length}" required`))}</div>${field('Feedback for this speaker', `<textarea class="form-input" name="feedback-${i}" maxlength="5000" rows="3">${h(row?.feedback || '')}</textarea>`)}</fieldset>`;
    }).join('')}
    ${admin ? field('Reason for entering on behalf of this judge', input('reason', '', 'required maxlength="1000"')) : ''}
    <div class="ps-actions">${button('Save draft', 'type="submit" value="draft"', true)}${button('Submit ballot', 'type="submit" value="submitted"')}</div><p class="ps-help">Drafts need complete scores and ranks. Submitted ballots are locked until tab reopens them.</p></form>`;
  showDialog('Public speaking ballot', html, async (fd, status) => submit({ roundId: round.id, roomId: room.id, judgeId, status, reason: fd.get('reason'), rows: room.speakers.map((speakerId, i) => ({ speakerId, scores: event.rubric.map((_, j) => Number(fd.get(`score-${i}-${j}`))), rank: Number(fd.get(`rank-${i}`)), feedback: fd.get(`feedback-${i}`) })) }));
}
