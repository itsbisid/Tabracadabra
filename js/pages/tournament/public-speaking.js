import { renderAppLayout } from '../../components/layout.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { supabase } from '../../lib/supabase.js';
import { psRequest } from '../../lib/ps-service.js';
import { h, button, field, input, select, card, empty, table, nameOf, standingsTable, csvDownload, showDialog, ballotDialog } from '../../components/ps-ui.js';

const defaults = [{ name: 'Content', max: 40, weight: 40 }, { name: 'Delivery', max: 40, weight: 40 }, { name: 'Structure', max: 20, weight: 20 }];
const labels = { setup: 'Event setup', speakers: 'Speakers', judges: 'Judges', rounds: 'Rounds & ballots', results: 'Results & breaks', feedback: 'Judge feedback', history: 'History' };

export async function renderPublicSpeaking(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;
  let events = [], current = null, tab = 'setup', busy = false, venues = [];
  await renderAppLayout(container, '/tournament/public-speaking', 'Public speaking', 'Manage speaking events within your tournament.', '<div id="ps-workspace" class="ps"><p role="status">Loading public speaking…</p></div>');
  const root = container.querySelector('#ps-workspace');
  const loadEvents = async () => { ({ events } = await psRequest({ action: 'list', tournamentId })); };
  const read = async () => { if (current) current = await psRequest({ action: 'read', eventId: current.id }); };
  const mutate = async (action, data) => {
    try {
      const result = await psRequest({ action, input: data, eventId: current.id, version: current.version });
      current = result; render(); return result;
    } catch (error) {
      if (error.status === 409) { await read(); render(); error.message = 'Another submission changed this event. The latest data is loaded. Your form is preserved; review and submit again.'; }
      throw error;
    }
  };
  const errorMessage = error => { const el = root.querySelector('#ps-error'); el.textContent = error.message; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); };
  const portalBase = () => `${location.origin}${location.pathname}`;

  function settingsForm(state = null) {
    const rubric = state?.rubric || defaults;
    return `<form data-form="settings" class="ps-stack">${field('Event name', input('name', state?.name || '', 'placeholder="e.g. GUDC Prepared Speech" required maxlength="160"'))}<div class="ps-grid">${field('Event type', select('type', ['Prepared speech', 'Impromptu speech', 'Programme of Oral Interpretation', 'Other'].map(s => [s, s]), state?.type))}${field('Tabulation', select('scoring', [['score', 'Highest score'], ['rank', 'Lowest mean rank']], state?.scoring))}${field('Speech length (seconds, for guidance)', input('durationSeconds', state?.durationSeconds || 180, 'type="number" min="30" max="3600" required'))}</div>
      <fieldset><legend>Scoring rubric</legend><p class="ps-help">Set maximum marks and weights. Weights must total 100. Rules freeze when the first round is created.</p><div id="ps-criteria">${rubric.map((c, i) => rubricRow(c, i)).join('')}</div>${button('Add criterion', 'type="button" data-action="criterion"', true)}</fieldset>
      ${button(state ? 'Save event settings' : 'Create event', 'type="submit"')}<p class="ps-help">Each judge submits a complete ballot. Tab approves ballots before the round contributes to standings.</p></form>`;
  }
  function rubricRow(c, i) { return `<div class="ps-grid ps-criterion">${field(`Criterion ${i + 1}`, input('criterionName', c.name, 'required maxlength="160"'))}${field('Max marks', input('criterionMax', c.max, 'type="number" min="1" max="1000" required'))}${field('Weight (%)', input('criterionWeight', c.weight, 'type="number" min="1" max="100" required'))}${button('Remove', 'type="button" data-action="remove-criterion"', true)}</div>`; }

  function roster(role) {
    const people = role === 'speaker' ? current.state.speakers : current.state.judges;
    return card(role === 'speaker' ? 'Individual speakers' : 'Scoring judges', `<p class="ps-help">${role === 'judge' ? 'Import from this tournament’s adjudicator list, or add PS judges here. Each assigned judge has an equally weighted ballot.' : 'Speakers enter this event as individuals. Use separate events for separate disciplines.'}</p><div class="ps-actions">${button('Add people', `data-action="add-people" data-role="${role}"`)}${role === 'judge' ? button('Import existing adjudicators', 'data-action="import-judges"', true) : button('Export speakers', 'data-action="export-speakers"', true)}</div>${people.length ? table(['Name', 'Institution', ...(role === 'speaker' ? ['Category', 'Check-in'] : []), 'Status', 'Actions'], people.map(p => [h(p.name), h(p.institution || '—'), ...(role === 'speaker' ? [h(p.category || 'Open'), p.checkedIn ? 'Checked in' : 'Pending'] : []), p.active ? 'Active' : 'Withdrawn', `<div class="ps-actions">${button('Private link', `data-action="portal" data-role="${role}" data-id="${p.id}"`, true)}${button(p.active ? 'Withdraw' : 'Restore', `data-action="person-status" data-role="${role}" data-id="${p.id}" data-active="${!p.active}"`, true)}</div>`])) : empty('No people registered yet.')}`);
  }

  function roundCards() {
    const event = current.state;
    return `<div class="ps-actions">${button('Create round', 'data-action="new-round"')}</div>${event.rounds.length ? event.rounds.map(round => card(round.name, `<div class="ps-actions"><span class="badge">${h(round.stage)} · ${h(round.status)}</span><span>${round.speakerIds.length} speakers · ${round.ballots.filter(b => b.status === 'approved').length}/${round.rooms.reduce((n, r) => n + r.judges.length, 0)} approved ballots</span></div>
      ${round.status === 'draft' ? `<div class="ps-actions">${button('Generate / edit draw', `data-action="draw" data-id="${round.id}"`)}${round.rooms.length ? button('Publish draw & open ballots', `data-action="open" data-id="${round.id}"`) : ''}</div>` : ''}
      ${(event.warnings[round.id] || []).length ? `<details class="ps-warning"><summary>Allocation warnings (${event.warnings[round.id].length})</summary><ul>${event.warnings[round.id].map(w => `<li>${h(w)}</li>`).join('')}</ul></details>` : ''}
      ${round.rooms.map(room => `<div class="ps-room"><h3>${h(room.name)}</h3><ol>${room.speakers.map(id => `<li>${h(nameOf(event.speakers, id))}</li>`).join('')}</ol>${round.status !== 'draft' ? table(['Judge', 'Ballot', 'Actions'], room.judges.map(id => {
        const ballot = round.ballots.find(b => b.roomId === room.id && b.judgeId === id);
        return [h(nameOf(event.judges, id)), h(ballot?.status || 'Missing'), `<div class="ps-actions">${round.status === 'open' && (!ballot || ballot.status === 'draft') ? button('Enter ballot', `data-action="ballot" data-round="${round.id}" data-room="${room.id}" data-judge="${id}"`, true) : ''}${ballot ? button('View', `data-action="view-ballot" data-round="${round.id}" data-id="${ballot.id}"`, true) : ''}${round.status === 'open' && ballot?.status === 'submitted' ? button('Approve', `data-action="approve" data-round="${round.id}" data-id="${ballot.id}"`) : ''}${round.status === 'open' && ballot && ballot.status !== 'draft' ? button('Reopen', `data-action="reopen" data-round="${round.id}" data-id="${ballot.id}"`, true) : ''}</div>`];
      })) : `<p>Judges: ${room.judges.map(id => h(nameOf(event.judges, id))).join(', ')}</p>`}</div>`).join('')}
      ${round.status === 'open' ? button('Complete round', `data-action="complete" data-id="${round.id}"`) : ''}`)).join('') : card('Start your first round', empty('Add speakers and judges, then create a round.'))}`;
  }

  function resultCards() {
    const event = current.state;
    return card('Preliminary standings', `<div class="ps-actions">${button('Export standings', 'data-action="export-results"', true)}${button('Create final from break', 'data-action="break"')}${button('Open public page', 'data-action="public"', true)}</div>${standingsTable(event.standings, event.scoring)}`) + event.rounds.filter(r => r.status === 'completed').map(round => card(round.name, `${standingsTable(event.roundStandings[round.id], event.scoring)}<form data-form="publish" data-id="${round.id}"><div class="ps-actions"><label><input type="checkbox" name="resultsPublished" ${round.resultsPublished ? 'checked' : ''}> Publish results</label><label><input type="checkbox" name="feedbackPublished" ${round.feedbackPublished ? 'checked' : ''}> Release each speaker’s private feedback</label>${button('Save release settings', 'type="submit"')}</div></form><p class="ps-help">Completed rounds are immutable. Review all ballots before completing a round.</p>`)).join('');
  }

  function feedbackCards() {
    const event = current.state;
    const rows = event.rounds.flatMap(r => r.judgeFeedback.map(f => [h(r.name), h(nameOf(event.judges, f.toId)), h(nameOf(f.fromRole === 'speaker' ? event.speakers : event.judges, f.fromId)), `${f.rating}/5`, h(f.comment)]));
    return card('Confidential judge feedback', `<p class="ps-help">Visible only to tournament administrators. Participant portals never receive other people’s judge evaluations.</p>${rows.length ? table(['Round', 'Judge', 'From', 'Rating', 'Comment'], rows) : empty('Speaker and peer judge feedback will appear here.')}`);
  }

  function render() {
    const event = current?.state;
    root.innerHTML = `<div class="ps-top"><div><span class="ps-eyebrow">TOURNAMENT WORKSPACE</span><h1>Public speaking</h1><p>Events, rounds and individual performances.</p></div><div class="ps-actions">${events.length ? field('Speaking event', select('eventId', [...(!current ? [['', 'Choose an existing event']] : []), ...events.map(e => [e.id, e.name])], current?.id)) : ''}${button('New event', 'data-action="new-event"', true)}${button('Refresh', 'data-action="refresh"', true)}</div></div><p id="ps-error" class="ps-error" role="alert" hidden></p>
      ${event ? `<div class="ps-stats"><div><strong>${h(event.name)}</strong><span>${h(event.type)}</span></div><div><strong>${event.speakers.filter(s => s.active).length}</strong><span>Active speakers</span></div><div><strong>${event.judges.filter(j => j.active).length}</strong><span>Judges</span></div><div><strong>${event.rounds.filter(r => r.status === 'completed').length} / ${event.rounds.length}</strong><span>Rounds completed</span></div></div><nav class="ps-tabs" aria-label="Public speaking sections">${Object.entries(labels).map(([id, name]) => `<button data-action="tab" data-tab="${id}" class="${tab === id ? 'active' : ''}" aria-current="${tab === id ? 'page' : 'false'}">${name}</button>`).join('')}</nav>` : ''}
      ${!event ? card('Add a speaking event', settingsForm()) : tab === 'setup' ? card('Event settings', event.rounds.length ? `<p>Rules are locked for this event.</p>${table(['Criterion', 'Maximum', 'Weight'], event.rubric.map(c => [h(c.name), c.max, `${c.weight}%`]))}<p>Tabulation: ${h(event.scoring)}. Speech length: ${event.durationSeconds} seconds.</p>` : settingsForm(event)) : tab === 'speakers' ? roster('speaker') : tab === 'judges' ? roster('judge') : tab === 'rounds' ? roundCards() : tab === 'results' ? resultCards() : tab === 'feedback' ? feedbackCards() : card('Change history', `${button('Load history', 'data-action="history"', true)}<div id="ps-history"></div>`)}`;
  }

  root.addEventListener('change', async e => {
    if (e.target.name !== 'eventId' || !e.target.value) return;
    try { current = await psRequest({ action: 'read', eventId: e.target.value }); tab = 'setup'; render(); } catch (error) { errorMessage(error); }
  });
  root.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return; busy = true;
    const fd = new FormData(e.target); const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      if (e.target.dataset.form === 'settings') {
        const data = { name: fd.get('name'), type: fd.get('type'), scoring: fd.get('scoring'), durationSeconds: Number(fd.get('durationSeconds')), rubric: fd.getAll('criterionName').map((name, i) => ({ name, max: Number(fd.getAll('criterionMax')[i]), weight: Number(fd.getAll('criterionWeight')[i]) })) };
        if (current) await mutate('settings', data);
        else current = await psRequest({ action: 'create', tournamentId, input: data });
        await loadEvents(); tab = 'speakers'; render();
      } else if (e.target.dataset.form === 'publish') await mutate('publish', { roundId: e.target.dataset.id, resultsPublished: fd.has('resultsPublished'), feedbackPublished: fd.has('feedbackPublished') });
    } catch (error) { errorMessage(error); } finally { busy = false; if (btn) btn.disabled = false; }
  });

  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]'); if (!btn || busy) return;
    const { action, id, role } = btn.dataset;
    try {
      if (action === 'criterion') { const target = root.querySelector('#ps-criteria'); target.insertAdjacentHTML('beforeend', rubricRow({ name: '', max: 20, weight: 20 }, target.children.length)); return; }
      if (action === 'remove-criterion') { btn.closest('.ps-criterion').remove(); return; }
      if (action === 'tab') { tab = btn.dataset.tab; render(); return; }
      if (action === 'new-event') { current = null; tab = 'setup'; render(); return; }
      if (action === 'refresh') { await loadEvents(); await read(); render(); return; }
      if (action === 'add-people') {
        showDialog(`Add ${role === 'speaker' ? 'speakers' : 'judges'}`, `<form>${field('Paste names (one per line; optional institution and category separated by tabs)', '<textarea name="people" class="form-input" rows="10" required placeholder="Name&#9;Institution&#9;Category"></textarea>')}<p class="ps-help">You can paste columns directly from a spreadsheet. Duplicate name/institution combinations are rejected.</p>${button('Add people', 'type="submit"')}</form>`, async fd => { await mutate(role === 'speaker' ? 'add-speakers' : 'add-judges', { people: String(fd.get('people')).split(/\r?\n/).filter(s => s.trim()).map(line => { const [name, institution = '', category = ''] = line.split('\t'); return { name, institution, category }; }) }); }); return;
      }
      if (action === 'portal') {
        const result = await mutate('portal-link', { role, personId: id });
        const url = `${portalBase()}#/ps/portal/${result.token}`;
        showDialog('Private participant link', `<p>This link expires in 14 days. Creating a new link revokes the previous one. Share it only with this participant.</p>${field('Private link', input('url', url, 'readonly'))}<a class="btn btn--primary" href="${h(url)}" target="_blank" rel="noopener noreferrer">Open portal</a>`);
        return;
      }
      if (action === 'public') { showDialog('Public speaking results page', `${field('Public URL', input('url', `${portalBase()}#/ps/live/${current.id}`, 'readonly'))}<a class="btn btn--primary" href="#/ps/live/${current.id}" target="_blank" rel="noopener">Open public page</a><p>Only published draws and released results appear here. Speaker feedback stays private.</p>`); return; }
      if (action === 'new-round') { newRoundDialog(); return; }
      if (action === 'draw') { drawDialog(current.state.rounds.find(r => r.id === id)); return; }
      if (action === 'ballot') { const round = current.state.rounds.find(r => r.id === btn.dataset.round); ballotDialog(current.state, round, round.rooms.find(r => r.id === btn.dataset.room), btn.dataset.judge, true, data => mutate('ballot', data)); return; }
      if (action === 'view-ballot') { const round = current.state.rounds.find(r => r.id === btn.dataset.round); const ballot = round.ballots.find(b => b.id === id); showDialog('Submitted ballot', table(['Speaker', 'Rank', ...current.state.rubric.map(c => c.name), 'Feedback'], ballot.rows.map(row => [h(nameOf(current.state.speakers, row.speakerId)), row.rank, ...row.scores, h(row.feedback)]))); return; }
      if (action === 'break') { breakDialog(); return; }
      if (action === 'export-speakers') { csvDownload('ps-speakers.csv', ['Name', 'Institution', 'Category', 'Active', 'Checked in'], current.state.speakers.map(p => [p.name, p.institution, p.category, p.active, p.checkedIn])); return; }
      if (action === 'export-results') { csvDownload('ps-standings.csv', ['Place', 'Name', 'Institution', 'Rounds', 'Score', 'Mean rank total'], current.state.standings.map(p => [p.place, p.name, p.institution, p.rounds, p.score, p.rankTotal])); return; }
      busy = true; btn.disabled = true;
      if (action === 'import-judges') {
        const { data, error } = await supabase.from('adjudicators').select('name,institution').eq('tournament_id', tournamentId); if (error) throw error;
        const people = data.filter(p => !current.state.judges.some(j => j.name.toLowerCase() === p.name.trim().toLowerCase() && j.institution.toLowerCase() === (p.institution || '').trim().toLowerCase()));
        if (!people.length) throw new Error('No new adjudicators to import. Add judges in the Adjudicators page first.');
        await mutate('add-judges', { people });
      } else if (action === 'person-status') await mutate('person-status', { role, personId: id, active: btn.dataset.active === 'true' });
      else if (action === 'open') {
        const warnings = current.state.warnings[id] || []; const reason = warnings.length ? prompt('Allocation warnings need an override reason. Cancel to edit the draw:') : '';
        if (warnings.length && !reason) return;
        await mutate('open-round', { roundId: id, reason });
      } else if (action === 'approve') await mutate('approve-ballot', { roundId: btn.dataset.round, ballotId: id });
      else if (action === 'reopen') { const reason = prompt('Why is this ballot being reopened?'); if (reason) await mutate('reopen-ballot', { roundId: btn.dataset.round, ballotId: id, reason }); }
      else if (action === 'complete') { if (confirm('Complete this round? Approved ballots will be frozen. Review them before continuing.')) await mutate('complete-round', { roundId: id }); }
      else if (action === 'history') { const { audit } = await psRequest({ action: 'audit', eventId: current.id }); root.querySelector('#ps-history').innerHTML = table(['Version', 'When', 'Action', 'Actor', 'Reason'], audit.map(a => [a.version, h(new Date(a.created_at).toLocaleString()), h(a.action), h(a.actor), h(a.reason)])); }
    } catch (error) { errorMessage(error); } finally { busy = false; btn.disabled = false; }
  });

  function newRoundDialog() {
    const people = current.state.speakers.filter(s => s.active);
    showDialog('Create speaking round', `<form class="ps-stack">${field('Round name', input('name', `Round ${current.state.rounds.length + 1}`, 'required'))}${field('Stage', select('stage', [['preliminary', 'Preliminary'], ['semifinal', 'Semifinal'], ['final', 'Final']]))}<fieldset><legend>Speakers in this round</legend><div class="ps-checklist">${people.map(p => `<label><input type="checkbox" name="speakers" value="${p.id}" checked> ${h(p.name)} ${p.checkedIn ? '· checked in' : ''}</label>`).join('')}</div></fieldset>${button('Create draft round', 'type="submit"')}</form>`, async fd => { await mutate('create-round', { name: fd.get('name'), stage: fd.get('stage'), speakerIds: fd.getAll('speakers') }); });
  }

  function breakDialog() {
    showDialog('Create final from preliminary standings', `<form class="ps-stack">${field('Final name', input('name', 'Grand Final', 'required'))}${field('Break size', input('breakSize', 6, 'type="number" min="1" required'))}${field('Category (leave blank for all)', input('category'))}<p class="ps-help">Only active speakers who completed every preliminary round are eligible. An exact cutoff tie blocks the break until you select the required tied speakers below and give a reason.</p><details><summary>Resolve cutoff ties</summary><div class="ps-checklist">${current.state.standings.map(s => `<label><input type="checkbox" name="tieSelections" value="${s.speakerId}"> ${h(s.name)} · ${s.score.toFixed(2)} points · rank total ${s.rankTotal}</label>`).join('')}</div>${field('Tie resolution reason', input('reason', '', 'maxlength="1000"'))}</details>${button('Generate final', 'type="submit"')}</form>`, async fd => { await mutate('create-break', { name: fd.get('name'), breakSize: Number(fd.get('breakSize')), category: fd.get('category'), tieSelections: fd.getAll('tieSelections'), reason: fd.get('reason') }); tab = 'rounds'; render(); });
  }

  function drawDialog(round) {
    const event = current.state, judges = event.judges.filter(j => j.active);
    let rooms = structuredClone(round.rooms);
    const drawEditor = () => `<p class="ps-help">Speaking order follows the number beside each speaker. Review conflicts before publishing. A judge cannot be assigned to two rooms in this round.</p>${rooms.map((room, ri) => `<fieldset class="ps-room"><legend>Room ${ri + 1}</legend>${field('Venue / room', input(`room-${ri}`, room.name, `required list="ps-venues-${ri}"`))}<datalist id="ps-venues-${ri}">${venues.map(v => `<option value="${h(v.name)}"></option>`).join('')}</datalist><div class="ps-checklist">${judges.map(j => `<label><input name="judges-${ri}" type="checkbox" value="${j.id}" ${room.judges.includes(j.id) ? 'checked' : ''}> ${h(j.name)} · ${h(j.institution || 'No institution')}</label>`).join('')}</div></fieldset>`).join('')}${table(['Speaker', 'Room', 'Speaking order'], round.speakerIds.map(id => { const ri = rooms.findIndex(r => r.speakers.includes(id)); return [h(nameOf(event.speakers, id)), select(`roomFor-${id}`, rooms.map((_, i) => [i, `Room ${i + 1}`]), ri), input(`order-${id}`, rooms[ri]?.speakers.indexOf(id) + 1 || 1, 'type="number" min="1" required')]; }))}${button('Save draw', 'type="submit"')}`;
    const dialog = showDialog('Allocate speakers and judges', `<form class="ps-stack"><div class="ps-actions">${field('Maximum speakers per room', input('roomSize', 6, 'type="number" min="1" max="50"'))}${button('Generate random draw', 'type="button" data-generate', true)}${button('Seed from standings', 'type="button" data-seed', true)}</div><div id="ps-draw-editor">${rooms.length ? drawEditor() : empty('Generate a draw, then review rooms and judge allocations.')}</div></form>`, async fd => {
      if (!rooms.length) throw new Error('Generate a draw first.');
      const updated = rooms.map((room, ri) => ({ name: fd.get(`room-${ri}`), judges: fd.getAll(`judges-${ri}`), speakers: round.speakerIds.filter(id => Number(fd.get(`roomFor-${id}`)) === ri).sort((a, b) => Number(fd.get(`order-${a}`)) - Number(fd.get(`order-${b}`))) }));
      for (const room of updated) if (new Set(room.speakers.map(id => fd.get(`order-${id}`))).size !== room.speakers.length) throw new Error('Speaking order numbers must be unique within each room.');
      await mutate('save-draw', { roundId: round.id, rooms: updated });
    });
    const generate = seeded => {
      const size = Number(dialog.querySelector('[name="roomSize"]').value);
      if (!Number.isInteger(size) || size < 1 || size > 50) { alert('Use a room size between 1 and 50.'); return; }
      const count = Math.ceil(round.speakerIds.length / size);
      if (judges.length < count) { alert(`Add at least ${count} active judges or increase the room size.`); return; }
      const ids = [...round.speakerIds];
      if (seeded) ids.sort((a, b) => (event.standings.findIndex(s => s.speakerId === a) + 1 || Infinity) - (event.standings.findIndex(s => s.speakerId === b) + 1 || Infinity));
      else for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      rooms = Array.from({ length: count }, (_, i) => ({ name: venues[i]?.name || `Room ${i + 1}`, speakers: [], judges: [] }));
      // Seeded draw puts similarly ranked speakers together; random draw balances room sizes.
      ids.forEach((id, i) => rooms[seeded ? Math.min(Math.floor(i / size), count - 1) : i % count].speakers.push(id));
      judges.forEach((j, i) => rooms[i % count].judges.push(j.id));
      dialog.querySelector('#ps-draw-editor').innerHTML = drawEditor();
    };
    dialog.querySelector('[data-generate]').onclick = () => generate(false);
    dialog.querySelector('[data-seed]').onclick = () => generate(true);
  }

  try {
    await loadEvents();
    const result = await supabase.from('venues').select('name').eq('tournament_id', tournamentId); venues = result.data || [];
    if (events.length) current = await psRequest({ action: 'read', eventId: events[0].id });
    render();
  } catch (error) {
    root.innerHTML = card('Public speaking is unavailable', `<p class="ps-error" role="alert">${h(error.message)}</p><p>Ask the tournament administrator to check access and the Public Speaking setup.</p>${button('Try again', 'data-action="refresh"', true)}<p id="ps-error" class="ps-error" role="alert" hidden></p>`);
  }
}
