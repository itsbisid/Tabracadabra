import { psRequest } from '../lib/ps-service.js';
import { h, button, field, select, card, empty, table, nameOf, standingsTable, showDialog, ballotDialog } from '../components/ps-ui.js';

export async function renderPSPortal(container, token, eventId = null) {
  let current, busy = false;
  const request = (action, input = {}) => psRequest({ action, input, ...(token ? { token } : { eventId }), version: current?.version }, false);
  const load = async () => { current = await request(token ? 'read' : 'public'); };
  const mutate = async (action, data) => {
    try { current = await request(action, data); render(); }
    catch (error) {
      if (error.status === 409) { await load(); render(); error.message = 'Another submission changed the event. Your form is preserved. Review and submit again.'; }
      throw error;
    }
  };

  function render() {
    const event = current.state, person = event.participant;
    container.innerHTML = `<main class="ps ps-portal"><header class="ps-top"><div><span class="ps-eyebrow">TABRACADABRA · PUBLIC SPEAKING</span><h1>${h(event.name)}</h1><p>${person ? `Welcome, ${h(person.name)} · ${h(person.role)}` : 'Published draws and results'}</p></div>${button('Refresh', 'data-action="refresh"', true)}</header><p class="ps-error" id="ps-portal-error" role="alert" hidden></p>
      ${person?.role === 'speaker' ? card('Your event', `<p>${h(event.type)} · Speech length: ${event.durationSeconds} seconds</p>${person.checkedIn ? '<strong>✓ You are checked in</strong>' : button('Check in', 'data-action="check-in"')}<p class="ps-help">Find your room below. Scores and feedback appear when released by tab.</p>`) : ''}
      ${person?.role === 'judge' ? card('Your judging tasks', `<p>Open your assigned ballot below. Score every criterion and rank each speaker, then submit. Tab will approve the ballot.</p>${table(['Criterion', 'Maximum', 'Weight'], event.rubric.map(c => [h(c.name), c.max, `${c.weight}%`]))}`) : ''}
      ${event.rounds.length ? event.rounds.map(round => card(round.name, `<div class="ps-actions"><span class="badge">${h(round.stage)} · ${h(round.status)}</span></div>${round.rooms.map(room => {
        const assigned = person && (person.role === 'speaker' ? room.speakers : room.judges).includes(person.id);
        const ballot = person?.role === 'judge' ? round.ballots.find(b => b.roomId === room.id && b.judgeId === person.id) : null;
        return `<div class="ps-room ${assigned ? 'ps-room--yours' : ''}"><h3>${h(room.name)} ${assigned ? '· Your room' : ''}</h3><ol>${room.speakers.map(id => `<li>${h(nameOf(event.speakers, id))}</li>`).join('')}</ol><p class="ps-help">Judges: ${room.judges.map(id => h(nameOf(event.judges, id))).join(', ')}</p>${assigned && person.role === 'judge' ? `<p>Ballot: <strong>${h(ballot?.status || 'Not started')}</strong>${ballot ? ` · Last saved ${h(new Date(ballot.updatedAt).toLocaleString())}` : ''}</p>${round.status === 'open' && (!ballot || ballot.status === 'draft') ? button(ballot ? 'Continue ballot' : 'Open ballot', `data-action="ballot" data-round="${round.id}" data-room="${room.id}"`) : ''}${ballot ? button('View saved ballot', `data-action="view-ballot" data-round="${round.id}" data-room="${room.id}"`, true) : ''}` : ''}
        ${assigned ? `<div class="ps-actions">${room.judges.filter(id => id !== person.id).map(id => button(`Feedback for ${nameOf(event.judges, id)}`, `data-action="feedback" data-round="${round.id}" data-room="${room.id}" data-judge="${id}"`, true)).join('')}</div>` : ''}</div>`;
      }).join('')}${round.resultsPublished ? `<h3>Round results</h3>${standingsTable(round.standings, event.scoring)}` : empty('Results have not been released.')}${person?.role === 'speaker' && round.feedback.length ? `<h3>Your private feedback</h3>${round.feedback.map((f, i) => `<div class="ps-room"><h4>Judge ${i + 1}</h4><p class="ps-feedback-text">${h(f.feedback || 'No written feedback submitted.')}</p>${table(['Criterion', 'Score'], event.rubric.map((c, j) => [h(c.name), `${f.scores[j]} / ${c.max}`]))}</div>`).join('')}` : ''}`)).join('') : card('Waiting for the draw', empty('Tab has not published a round yet. Refresh when your draw is announced.'))}
      ${card('Published preliminary standings', standingsTable(event.standings, event.scoring))}
      <footer class="ps-help">${person ? 'Keep your private link to yourself. It gives access to your assignments and submissions.' : 'Feedback and unpublished results are private.'}</footer></main>`;
  }
  container.onclick = async e => {
    const btn = e.target.closest('[data-action]'); if (!btn || busy || !current) return;
    const { action } = btn.dataset, event = current.state;
    try {
      if (action === 'ballot' || action === 'view-ballot') {
        const round = event.rounds.find(r => r.id === btn.dataset.round), room = round.rooms.find(r => r.id === btn.dataset.room);
        if (action === 'ballot') ballotDialog(event, round, room, event.participant.id, false, data => mutate('ballot', data));
        else {
          const ballot = round.ballots.find(b => b.roomId === room.id && b.judgeId === event.participant.id);
          showDialog('Your saved ballot', table(['Speaker', 'Rank', ...event.rubric.map(c => c.name), 'Feedback'], ballot.rows.map(row => [h(nameOf(event.speakers, row.speakerId)), row.rank, ...row.scores, h(row.feedback)])));
        }
        return;
      }
      if (action === 'feedback') {
        const round = event.rounds.find(r => r.id === btn.dataset.round);
        const prior = round.judgeFeedback.find(f => f.roomId === btn.dataset.room && f.toId === btn.dataset.judge);
        showDialog('Confidential judge feedback', `<form class="ps-stack"><p>Only tournament administrators can read this evaluation.</p>${field('Rating', select('rating', [[1, '1 — Needs improvement'], [2, '2'], [3, '3 — Satisfactory'], [4, '4'], [5, '5 — Excellent']], prior?.rating || 3))}${field('Comments', `<textarea class="form-input" name="comment" rows="5" maxlength="3000">${h(prior?.comment || '')}</textarea>`)}${button('Save feedback', 'type="submit"')}</form>`, async fd => mutate('judge-feedback', { roundId: round.id, roomId: btn.dataset.room, judgeId: btn.dataset.judge, rating: Number(fd.get('rating')), comment: fd.get('comment') })); return;
      }
      busy = true; btn.disabled = true;
      if (action === 'refresh') { await load(); render(); }
      else if (action === 'check-in') await mutate('check-in', {});
    } catch (error) { const el = container.querySelector('#ps-portal-error'); el.textContent = error.message; el.hidden = false; }
    finally { busy = false; btn.disabled = false; }
  };
  container.innerHTML = '<main class="ps ps-portal"><p role="status">Loading public speaking…</p></main>';
  try { await load(); render(); }
  catch (error) { container.innerHTML = `<main class="ps ps-portal">${card('Unable to open this event', `<p role="alert">${h(error.message)}</p><p>Check the link or ask the tournament tab team for help.</p>`)}</main>`; }
}
