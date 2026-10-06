import { psRequest } from '../lib/ps-service.js';
import { ballotView, h, button, field, select, card, empty, table, nameOf, standingsTable, showDialog, ballotDialog } from '../components/ps-ui.js';

// The private link is exchanged for a short session kept in this tab only, and the link is
// removed from the address bar so it does not linger in history or screenshots.
const SESSION_KEY = 'tabracadabra-ps-session';
const savedSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } };
const saveSession = value => { try { value ? sessionStorage.setItem(SESSION_KEY, value) : sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } };

export async function renderPSPortal(container, linkToken, eventId = null) {
  let current, busy = false, session = null;
  const participant = linkToken !== null && !eventId;
  if (participant) {
    try {
      if (linkToken) {
        const redeemed = await psRequest({ action: 'redeem', token: linkToken }, false);
        session = redeemed.session; saveSession(session);
        history.replaceState(null, '', `${location.pathname}${location.search}#/ps/portal`);
      } else session = savedSession();
      if (!session) throw new Error('Open your private link again to continue. For your security, sessions end when you close this tab.');
    } catch (error) {
      container.innerHTML = `<main class="ps ps-portal"><section class="card ps-card"><h1>Private portal</h1><p class="ps-error" role="alert">${h(error.message)}</p><p class="ps-help">If your link has expired or was replaced, ask the tab team for a new one.</p></section></main>`;
      return;
    }
  }
  const request = (action, input = {}) => psRequest({ action, input, ...(participant ? { session } : { eventId }), version: current?.version }, false);
  const load = async () => {
    try { current = await request(participant ? 'read' : 'public'); }
    catch (error) { if (participant && error.status === 401) saveSession(null); throw error; }
  };
  const mutate = async (action, data) => {
    try { current = await request(action, data); render(); }
    catch (error) {
      if (error.status === 409) { await load(); render(); error.message = 'Another submission changed the event. Your form is preserved. Review and submit again.'; }
      throw error;
    }
  };

  // The first thing each person sees is what they need to do next.
  function nextAction(event, person) {
    if (!person) return '';
    const mine = event.rounds.flatMap(round => round.rooms.filter(room => (person.role === 'judge' ? room.judges : room.speakers).includes(person.id)).map(room => ({ round, room })));
    if (person.role === 'judge') {
      const todo = mine.filter(({ round, room }) => round.status === 'open' && !['submitted', 'approved'].includes(round.ballots.find(b => b.roomId === room.id && b.judgeId === person.id)?.status));
      if (!todo.length) return card('Next', `<p><strong>No ballots outstanding.</strong> ${mine.length ? 'Thank you, your ballots are in.' : 'You have not been assigned to a room yet.'}</p>`);
      return card('Next', todo.map(({ round, room }) => { const b = round.ballots.find(x => x.roomId === room.id && x.judgeId === person.id); return `<p><strong>${h(round.name)} ballot ${b ? 'in progress (draft saved)' : 'outstanding'}</strong> · ${h(room.name)} · ${room.speakers.length} speakers</p>${button(b ? 'Continue ballot' : 'Open ballot', `data-action="ballot" data-round="${round.id}" data-room="${room.id}"`)}`; }).join(''));
    }
    const upcoming = mine.filter(({ round }) => round.status !== 'completed').at(-1);
    if (!upcoming) return card('Next', `<p>${mine.length ? 'Your rounds so far are complete. Results and feedback appear here when tab releases them.' : 'Your room will appear here when the draw is published.'}</p>`);
    const position = upcoming.room.speakers.indexOf(person.id) + 1;
    return card('Next', `<p><strong>${h(upcoming.round.name)}: ${h(upcoming.room.name)}</strong></p><p>You speak <strong>${position}${['th', 'st', 'nd', 'rd'][position % 10 > 3 || Math.floor(position / 10) === 1 ? 0 : position % 10]}</strong> of ${upcoming.room.speakers.length}.</p>`);
  }

  function render() {
    const event = current.state, person = event.participant;
    container.innerHTML = `<main class="ps ps-portal"><header class="ps-top"><div><span class="ps-eyebrow">TABRACADABRA · PUBLIC SPEAKING</span><h1>${h(event.name)}</h1><p>${person ? `Welcome, ${h(person.name)} · ${h(person.role)}` : 'Published draws and results'}</p></div><div class="ps-actions">${button('Refresh', 'data-action="refresh"', true)}${participant ? button('Leave portal', 'data-action="leave"', true) : ''}</div></header>${participant ? '<p class="ps-help">This is your private portal. Anyone who has your link can open it, so do not share or post it.</p>' : ''}<p class="ps-error" id="ps-portal-error" role="alert" hidden></p>
      ${nextAction(event, person)}
      ${person?.role === 'speaker' ? card('Your event', `<p>${h(event.type)} · Speech length: ${event.durationSeconds} seconds${event.penalty?.method === 'overtime' ? ' · overtime penalties apply' : ''}</p>${person.checkedIn ? '<strong>✓ You are checked in</strong>' : button('Check in', 'data-action="check-in"')}<p class="ps-help">Find your room below. Scores and feedback appear when released by tab.</p>`) : ''}
      ${person?.role === 'judge' ? card('Your judging tasks', `<p>Open your assigned ballot below. Score every criterion and rank each speaker, then submit. Tab will approve the ballot.</p>${table(['Criterion', 'Maximum', 'Weight'], event.rubric.map(c => [h(c.name), c.max, `${c.weight}%`]))}`) : ''}
      ${event.rounds.length ? event.rounds.map(round => card(round.name, `<div class="ps-actions"><span class="badge">${h(round.stage)} · ${h(round.status)}</span></div>${[...round.rooms].sort((a, b) => Number((person && (person.role === 'speaker' ? b.speakers : b.judges).includes(person.id)) || 0) - Number((person && (person.role === 'speaker' ? a.speakers : a.judges).includes(person.id)) || 0)).map(room => {
        const assigned = person && (person.role === 'speaker' ? room.speakers : room.judges).includes(person.id);
        const ballot = person?.role === 'judge' ? round.ballots.find(b => b.roomId === room.id && b.judgeId === person.id) : null;
        return `<div class="ps-room ${assigned ? 'ps-room--yours' : ''}"><h3>${h(room.name)} ${assigned ? '· Your room' : ''}</h3><ol>${room.speakers.map(id => `<li>${h(nameOf(event.speakers, id))}</li>`).join('')}</ol><p class="ps-help">Judges: ${room.judges.map(id => h(nameOf(event.judges, id))).join(', ')}</p>${assigned && person.role === 'judge' ? `<p>Ballot: <strong>${h(ballot?.status || 'Not started')}</strong>${ballot ? ` · Last saved ${h(new Date(ballot.updatedAt).toLocaleString())}` : ''}</p>${round.status === 'open' && (!ballot || ballot.status === 'draft') ? button(ballot ? 'Continue ballot' : 'Open ballot', `data-action="ballot" data-round="${round.id}" data-room="${room.id}"`) : ''}${ballot ? button('View saved ballot', `data-action="view-ballot" data-round="${round.id}" data-room="${room.id}"`, true) : ''}` : ''}
        ${assigned ? `<div class="ps-actions">${room.judges.filter(id => id !== person.id).map(id => button(`Feedback for ${nameOf(event.judges, id)}`, `data-action="feedback" data-round="${round.id}" data-room="${room.id}" data-judge="${id}"`, true)).join('')}</div>` : ''}</div>`;
      }).join('')}${round.resultsPublished ? `<h3>Round results</h3>${standingsTable(round.standings, event.scoring)}` : empty('Results have not been released.')}${person?.role === 'speaker' && round.feedback.length ? `<h3>Your private feedback</h3>${round.feedback.map((f, i) => `<div class="ps-room"><h4>Judge ${i + 1}</h4>${[['What worked', f.worked], ['What to improve', f.improve], ['What to try next', f.nextStep], ['Other comments', f.feedback]].filter(([, v]) => v).map(([k, v]) => `<p class="ps-feedback-text"><strong>${k}:</strong> ${h(v)}</p>`).join('') || '<p class="ps-feedback-text">No written feedback submitted.</p>'}${table(['Criterion', 'Score'], event.rubric.map((c, j) => [h(c.name), `${f.scores[j]} / ${c.max}`]))}</div>`).join('')}` : ''}`)).join('') : card('Waiting for the draw', empty('Tab has not published a round yet. Refresh when your draw is announced.'))}
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
          showDialog('Your saved ballot', ballotView(event, ballot));
        }
        return;
      }
      if (action === 'feedback') {
        const round = event.rounds.find(r => r.id === btn.dataset.round);
        const prior = round.judgeFeedback.find(f => f.roomId === btn.dataset.room && f.toId === btn.dataset.judge);
        showDialog('Confidential judge feedback', `<form class="ps-stack"><p>Your evaluation goes to the tournament's administrators only. It is <strong>not anonymous</strong> to them: they can see your name with it. The judge you are evaluating cannot see it, and it never appears in results or public pages.</p>${field('Rating', select('rating', [[1, '1 — Needs improvement'], [2, '2'], [3, '3 — Satisfactory'], [4, '4'], [5, '5 — Excellent']], prior?.rating || 3))}${field('Comments', `<textarea class="form-input" name="comment" rows="5" maxlength="3000">${h(prior?.comment || '')}</textarea>`)}${button('Save feedback', 'type="submit"')}</form>`, async fd => mutate('judge-feedback', { roundId: round.id, roomId: btn.dataset.room, judgeId: btn.dataset.judge, rating: Number(fd.get('rating')), comment: fd.get('comment') })); return;
      }
      busy = true; btn.disabled = true;
      if (action === 'refresh') { await load(); render(); }
      if (action === 'leave') { saveSession(null); container.innerHTML = '<main class="ps ps-portal"><section class="card ps-card"><h1>You have left the portal</h1><p>Open your private link again whenever you need it.</p></section></main>'; return; }
      else if (action === 'check-in') await mutate('check-in', {});
    } catch (error) { const el = container.querySelector('#ps-portal-error'); el.textContent = error.message; el.hidden = false; }
    finally { busy = false; btn.disabled = false; }
  };
  container.innerHTML = '<main class="ps ps-portal"><p role="status">Loading public speaking…</p></main>';
  try { await load(); render(); }
  catch (error) { container.innerHTML = `<main class="ps ps-portal">${card('Unable to open this event', `<p role="alert">${h(error.message)}</p><p>Check the link or ask the tournament tab team for help.</p>`)}</main>`; }
}
