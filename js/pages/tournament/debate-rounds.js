import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { BPEngine } from '../../lib/bp-engine.js';
import { showBallotModal } from '../../components/ballot-modal.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { sendTournamentPush } from '../../lib/push-service.js';
import { isAdmin } from '../../lib/auth-helpers.js';
import { escapeHtml, escapeJsString } from '../../lib/html.js';
import { teamLabelFromMap, teamLabelHtml } from '../../lib/team-display.js';

function isMissingColumn(error, column) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column.toLowerCase()) || message.includes('schema cache') || message.includes('could not find');
}

function roundIsBlind(round) {
  return round?.is_blind !== false;
}

function statusBadge(status) {
  const value = String(status || 'Draft');
  const normalized = value.toLowerCase();
  const bg = normalized === 'completed' ? '#f1f5f9' : normalized === 'released' ? '#ecfdf5' : '#fff7ed';
  const color = normalized === 'completed' ? '#334155' : normalized === 'released' ? '#047857' : '#c2410c';
  return `<span style="background:${bg}; color:${color}; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:800; text-transform:uppercase;">${escapeHtml(value)}</span>`;
}

function judgeLabel(judge, role = 'Adjudicator') {
  const name = judge?.name || 'Unassigned adjudicator';
  const status = judge?.status || 'Active';
  return `
    <div style="border:1px solid #dbeafe; background:#f8fbff; border-radius:8px; padding:10px; min-width:180px;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
        <span style="background:#e0f2fe; color:#075985; border-radius:999px; padding:2px 7px; font-size:10px; font-weight:900;">Adjudicator</span>
        <span style="background:#eef2ff; color:#3730a3; border-radius:999px; padding:2px 7px; font-size:10px; font-weight:800;">${escapeHtml(role)}</span>
      </div>
      <div style="font-weight:800; color:#172033;">${escapeHtml(name)}</div>
      <div style="font-size:11px; color:#64748b;">${escapeHtml(judge?.institution || 'Independent')} · ${escapeHtml(status)}</div>
    </div>
  `;
}

export async function renderDebateRounds(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = AudioCtor ? new AudioCtor() : null;
  let timers = {};
  let isUserAdmin = false;
  let currentRounds = [];
  let currentTeams = [];
  let currentAdjudicators = [];
  let currentVenues = [];
  let currentTeamMap = new Map();
  let currentJudgeMap = new Map();

  const fetchAndRender = async () => {
    isUserAdmin = await isAdmin(tournamentId);

    const [{ data: rounds }, { data: pairings }, { data: teams }, { data: adjudicators }, { data: venues }] = await Promise.all([
      supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('round_num', { ascending: true }),
      supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId),
      supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('name', { ascending: true }),
      supabase.from('adjudicators').select('*').eq('tournament_id', tournamentId).order('name', { ascending: true }),
      supabase.from('venues').select('*').eq('tournament_id', tournamentId).order('name', { ascending: true })
    ]);

    const pairingIds = (pairings || []).map(pairing => pairing.id).filter(Boolean);
    const [{ data: ballots }, { data: allocations }] = pairingIds.length
      ? await Promise.all([
          supabase.from('ballots').select('*').in('pairing_id', pairingIds),
          supabase.from('adjudicator_allocations').select('*').in('pairing_id', pairingIds)
        ])
      : [{ data: [] }, { data: [] }];

    currentTeams = teams || [];
    currentAdjudicators = adjudicators || [];
    currentVenues = venues || [];
    currentTeamMap = new Map(currentTeams.map(team => [team.id, team]));
    currentJudgeMap = new Map(currentAdjudicators.map(judge => [judge.id, judge]));

    const pairingsByRound = new Map();
    (pairings || []).forEach(pairing => {
      const hydrated = {
        ...pairing,
        ballots: (ballots || []).filter(ballot => ballot.pairing_id === pairing.id),
        adjudicator_allocations: (allocations || []).filter(allocation => allocation.pairing_id === pairing.id)
      };
      const list = pairingsByRound.get(pairing.round_id) || [];
      list.push(hydrated);
      pairingsByRound.set(pairing.round_id, list);
    });

    currentRounds = (rounds || []).map(round => ({
      ...round,
      draw_pairings: (pairingsByRound.get(round.id) || []).sort((a, b) => String(a.room_label || '').localeCompare(String(b.room_label || '')))
    }));

    renderUI(currentRounds);
    setupTimers(currentRounds);
  };

  async function saveRoundRecord(payload, roundId = null) {
    const query = roundId
      ? supabase.from('rounds').update(payload).eq('id', roundId)
      : supabase.from('rounds').insert(payload);

    const { error } = await query;
    if (error && ['is_blind', 'panel_size', 'room_names', 'results_released'].some(column => isMissingColumn(error, column))) {
      throw new Error('The round controls database migration is missing. Run supabase/round-controls-and-results.sql and try again.');
    }
    if (error) throw error;
  }

  window.tcAppendRoundRoom = roomName => {
    const input = document.getElementById('round-room-names');
    if (!input) return;
    const rooms = input.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (!rooms.includes(roomName)) rooms.push(roomName);
    input.value = rooms.join('\n');
  };

  window.tcOpenRoundModal = async (roundId = '') => {
    if (!isUserAdmin) {
      alert('Only tournament admins can create or edit rounds.');
      return;
    }

    const existing = currentRounds.find(round => round.id === roundId);
    const nextRoundNumber = currentRounds.length
      ? Math.max(...currentRounds.map(round => Number(round.round_num) || 0)) + 1
      : 1;

    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
        <div style="background:white; border-radius:10px; width:min(720px, 100%); max-height:calc(100vh - 40px); overflow:auto; border:1px solid #e2e8f0; box-shadow:0 24px 60px rgba(15,23,42,.25);">
          <div style="padding:20px 24px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; gap:16px;">
            <div>
              <h2 style="font-size:18px; font-weight:900; margin:0;">${existing ? 'Edit Round' : 'Add Round'}</h2>
              <p style="margin:4px 0 0; color:#64748b; font-size:13px;">Set visibility, panel size, rooms, and result-release behavior.</p>
            </div>
            <button type="button" onclick="document.getElementById('modal-root').innerHTML=''" style="border:0; background:transparent; cursor:pointer; color:#64748b;">${icon('x', 20)}</button>
          </div>
          <form onsubmit="return window.tcSaveRound(event, '${escapeJsString(roundId)}')" style="padding:24px; display:grid; gap:16px;">
            <div style="display:grid; grid-template-columns:120px 1fr; gap:14px;">
              <div class="form-group">
                <label class="form-label">Round No.</label>
                <input name="round_num" type="number" min="1" required class="form-input" value="${escapeHtml(existing?.round_num || nextRoundNumber)}">
              </div>
              <div class="form-group">
                <label class="form-label">Round Name</label>
                <input name="name" required class="form-input" value="${escapeHtml(existing?.name || `Round ${nextRoundNumber}`)}">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 140px; gap:14px;">
              <div class="form-group">
                <label class="form-label">Pairing Type</label>
                <select name="type" class="form-input form-select">
                  ${['RANDOM', 'POWER', 'ELIM'].map(type => `<option value="${type}" ${String(existing?.type || (nextRoundNumber === 1 ? 'RANDOM' : 'POWER')) === type ? 'selected' : ''}>${type}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select name="status" class="form-input form-select">
                  ${['Draft', 'Released', 'Completed'].map(status => `<option value="${status}" ${String(existing?.status || 'Draft') === status ? 'selected' : ''}>${status}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Panel Size</label>
                <input name="panel_size" type="number" min="1" max="20" required class="form-input" value="${Math.max(1, Number(existing?.panel_size) || 1)}">
              </div>
            </div>
            <label style="border:1px solid #dbeafe; background:#f8fbff; border-radius:8px; padding:14px; display:flex; gap:12px; align-items:flex-start; cursor:pointer;">
              <input name="is_blind" type="checkbox" ${roundIsBlind(existing || {}) ? 'checked' : ''} style="margin-top:3px; accent-color:#0044b3;">
              <span>
                <strong style="display:block; color:#172033;">Blind round</strong>
                <span style="font-size:12px; color:#64748b;">Hide team identities from adjudicators until the round is completed or switched to open.</span>
              </span>
            </label>
            <label style="border:1px solid #e2e8f0; border-radius:8px; padding:14px; display:flex; gap:12px; align-items:flex-start; cursor:pointer;">
              <input name="results_released" type="checkbox" ${existing?.results_released ? 'checked' : ''} style="margin-top:3px; accent-color:#10b981;">
              <span>
                <strong style="display:block; color:#172033;">Release results to standings</strong>
                <span style="font-size:12px; color:#64748b;">For blind rounds, keep this off until points may appear publicly. Open-round results are visible normally.</span>
              </span>
            </label>
            <div class="form-group">
              <label class="form-label">Debate Rooms</label>
              <textarea id="round-room-names" name="room_names" rows="3" class="form-input form-textarea" placeholder="One room per line, in draw order">${escapeHtml((existing?.room_names || []).join('\n'))}</textarea>
              ${currentVenues.length ? `
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                  ${currentVenues.map(venue => `<button type="button" onclick="window.tcAppendRoundRoom('${escapeJsString(venue.name || '')}')" style="border:1px solid #cbd5e1; background:white; color:#475569; border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer;">${icon('plus', 11)} ${escapeHtml(venue.name || 'Room')}</button>`).join('')}
                </div>
              ` : ''}
              <span style="display:block; margin-top:6px; font-size:11px; color:#64748b;">Configured rooms are assigned in order when pairings are generated and can be changed per debate later.</span>
            </div>
            <div class="form-group">
              <label class="form-label">Motion</label>
              <textarea name="motion_text" rows="3" class="form-input form-textarea" placeholder="Optional motion text">${escapeHtml(existing?.motion_text || '')}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; padding-top:8px;">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
              <button type="submit" class="btn btn--primary">${icon('check', 16)} Save Round</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.tcSaveRound = async (event, roundId = '') => {
    event.preventDefault();
    if (!isUserAdmin) {
      alert('Only tournament admins can save rounds.');
      return false;
    }

    const form = event.target;
    const fd = new FormData(form);
    const roundNum = Number(fd.get('round_num'));
    const name = String(fd.get('name') || '').trim();
    const panelSize = Number(fd.get('panel_size'));
    const roomNames = String(fd.get('room_names') || '')
      .split(/\r?\n|,/)
      .map(value => value.trim())
      .filter(Boolean);
    if (!Number.isFinite(roundNum) || roundNum < 1) {
      alert('Please enter a valid round number.');
      return false;
    }
    if (!name) {
      alert('Please enter a round name.');
      return false;
    }
    if (!Number.isInteger(panelSize) || panelSize < 1 || panelSize > 20) {
      alert('Panel size must be a whole number between 1 and 20.');
      return false;
    }
    if (new Set(roomNames.map(value => value.toLowerCase())).size !== roomNames.length) {
      alert('Each debate room must have a unique name.');
      return false;
    }

    const payload = {
      tournament_id: tournamentId,
      round_num: roundNum,
      name,
      type: String(fd.get('type') || 'POWER'),
      status: String(fd.get('status') || 'Draft'),
      is_blind: fd.get('is_blind') === 'on',
      results_released: fd.get('results_released') === 'on',
      panel_size: panelSize,
      room_names: roomNames,
      motion_text: String(fd.get('motion_text') || '').trim() || null
    };

    const submit = form.querySelector('button[type="submit"]');
    const originalText = submit?.innerHTML;
    if (submit) {
      submit.disabled = true;
      submit.innerHTML = 'Saving...';
    }

    try {
      await saveRoundRecord(payload, roundId || null);
      document.getElementById('modal-root').innerHTML = '';
      await fetchAndRender();
      alert(roundId ? 'Round updated.' : 'Round created.');
    } catch (error) {
      alert(error.message || 'Could not save round.');
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalText;
      }
    }
    return false;
  };

  window.tcToggleRoundBlind = async (roundId, shouldBeBlind) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can change blind-round settings.');
      return;
    }
    const round = currentRounds.find(item => item.id === roundId);
    const hasResults = (round?.draw_pairings || []).some(pairing => pairing.ballots?.length > 0);
    if (!shouldBeBlind && hasResults && !round?.results_released
      && !confirm('Making this round open will immediately add its confirmed results to public standings. Continue?')) return;
    try {
      await saveRoundRecord({ is_blind: shouldBeBlind }, roundId);
      await fetchAndRender();
    } catch (error) {
      alert(error.message || 'Could not update blind-round setting.');
    }
  };

  window.tcToggleRoundResults = async (roundId, shouldRelease) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can release or withhold blind-round results.');
      return;
    }
    const action = shouldRelease ? 'release' : 'withhold';
    const consequence = shouldRelease
      ? 'Confirmed points from this blind round will appear in standings.'
      : 'Points from this blind round will be removed from public standings until released again.';
    if (!confirm(`${action[0].toUpperCase() + action.slice(1)} these results? ${consequence}`)) return;

    try {
      await saveRoundRecord({ results_released: shouldRelease }, roundId);
      await fetchAndRender();
      alert(shouldRelease ? 'Blind-round results released.' : 'Blind-round results withheld.');
    } catch (error) {
      alert(error.message || `Could not ${action} results.`);
    }
  };

  window.tcUnlockBallot = async (ballotId) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can unlock ballots.');
      return;
    }
    if (confirm('Unlock this ballot for editing? This will revert it from LOCKED to DRAFT.')) {
      const { error } = await supabase.from('ballots').update({ status: 'DRAFT' }).eq('id', ballotId);
      if (error) alert(error.message);
      else fetchAndRender();
    }
  };

  const playPrepSound = () => {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 1.5);
  };

  window.tcReleaseMotion = async (roundId, defaultPrep = 15) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can release motions.');
      return;
    }

    const prepTime = prompt('Enter prep time in minutes:', defaultPrep);
    if (prepTime === null) return;

    const { data: round, error } = await supabase.from('rounds').update({
      motion_released_at: new Date().toISOString(),
      prep_time_override: parseInt(prepTime, 10) || defaultPrep
    }).eq('id', roundId).select('name, round_num, motion_text').single();

    if (error) alert(error.message);
    else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sendTournamentPush({
          authorization: `Bearer ${session.access_token}`,
          tournamentId,
          title: `${round?.name || `Round ${round?.round_num || ''}`} motion released`,
          body: round?.motion_text || 'The motion is now available in your private portal.'
        }).catch(pushError => console.warn('Push notification failed:', pushError));
      }
      fetchAndRender();
    }
  };

  const setupTimers = (rounds) => {
    Object.values(timers).forEach(clearInterval);
    timers = {};

    rounds.forEach(round => {
      if (round.motion_released_at) {
        const releaseTime = new Date(round.motion_released_at).getTime();
        const prepMs = (round.prep_time_override || 15) * 60 * 1000;
        const endTime = releaseTime + prepMs;

        timers[round.id] = setInterval(() => {
          const remaining = endTime - Date.now();
          const el = document.getElementById(`timer-${round.id}`);
          if (!el) return;

          if (remaining <= 0) {
            el.innerHTML = `<span style="color:#ef4444; font-weight:800;">PREP OVER</span>`;
            if (Math.abs(remaining) < 2000) playPrepSound();
            clearInterval(timers[round.id]);
          } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            el.innerHTML = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        }, 1000);
      }
    });
  };

  window.tcGeneratePairings = async (roundId, roundNum) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can generate pairings.');
      return;
    }

    const round = currentRounds.find(item => item.id === roundId);
    if (round?.draw_pairings?.length && !confirm('This round already has pairings. Generate another set anyway?')) return;

    const btn = document.activeElement;
    const originalText = btn?.innerHTML;
    if (btn) {
      btn.innerHTML = 'Generating...';
      btn.disabled = true;
    }

    try {
      const { pairings, allocations } = await BPEngine.generateDraw(
        roundId,
        tournamentId,
        roundNum,
        Math.max(1, Number(round?.panel_size) || 1),
        round?.room_names || []
      );
      const { data: insertedPairings, error: pError } = await supabase.from('draw_pairings').insert(pairings).select();
      if (pError) throw pError;

      const finalAllocations = allocations.map(allocation => {
        const pairing = insertedPairings[allocation.pairing_idx ?? 0];
        if (!pairing) throw new Error('Could not map adjudicator allocation to a pairing.');
        return {
          pairing_id: pairing.id,
          adjudicator_id: allocation.adjudicator_id,
          role: allocation.role
        };
      });

      if (finalAllocations.length) {
        const { error: aError } = await supabase.from('adjudicator_allocations').insert(finalAllocations);
        if (aError) throw aError;
      }

      await fetchAndRender();
      alert('Pairings generated.');
    } catch (err) {
      alert(err.message);
    }

    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  window.tcReleaseDraw = async (roundId) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can publish rounds.');
      return;
    }
    if (!confirm('Publish this round draw to participants and adjudicators? Blind rounds will still hide team identities from adjudicators.')) return;

    const { error } = await supabase.from('rounds').update({ status: 'Released' }).eq('id', roundId);
    if (error) alert(error.message);
    else {
      const { data: round } = await supabase.from('rounds').select('name, round_num').eq('id', roundId).single();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sendTournamentPush({
          authorization: `Bearer ${session.access_token}`,
          tournamentId,
          title: `${round?.name || `Round ${round?.round_num || ''}`} draw released`,
          body: 'Your draw is now available in your private portal.'
        }).catch(pushError => console.warn('Push notification failed:', pushError));
      }
      alert('Round published.');
      fetchAndRender();
    }
  };

  window.tcCompleteRound = async (roundId) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can complete rounds.');
      return;
    }
    if (!confirm('Mark this round as completed? Team identities will become visible, but blind-round points stay withheld until you release the results.')) return;
    const { error } = await supabase.from('rounds').update({ status: 'Completed' }).eq('id', roundId);
    if (error) alert(error.message);
    else fetchAndRender();
  };

  window.tcEnterBallot = (pairingId) => {
    const pairing = currentRounds.flatMap(round => round.draw_pairings || []).find(item => item.id === pairingId);
    if (pairing) {
      showBallotModal(pairing, () => fetchAndRender(), { teamMap: currentTeamMap });
    }
  };

  const getPairingContext = pairingId => {
    for (const round of currentRounds) {
      const pairing = (round.draw_pairings || []).find(item => item.id === pairingId);
      if (pairing) return { round, pairing };
    }
    return null;
  };

  const getPanelAssignments = pairing => {
    const assignments = new Map();
    if (pairing.chair_id) assignments.set(pairing.chair_id, 'CHAIR');
    (pairing.adjudicator_allocations || []).forEach(allocation => {
      if (!assignments.has(allocation.adjudicator_id)) {
        assignments.set(allocation.adjudicator_id, allocation.role || 'WING');
      }
    });
    return assignments;
  };

  window.tcOpenRoomModal = pairingId => {
    if (!isUserAdmin) {
      alert('Only tournament admins can assign rooms.');
      return;
    }
    const context = getPairingContext(pairingId);
    if (!context) return;

    const choices = [...new Set([
      ...(context.round.room_names || []),
      ...currentVenues.map(venue => venue.name),
      ...(context.round.draw_pairings || []).map(pairing => pairing.room_label)
    ].map(value => String(value || '').trim()).filter(Boolean))];

    document.getElementById('modal-root').innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
        <div style="background:white; border-radius:10px; width:min(480px,100%); border:1px solid #e2e8f0; box-shadow:0 24px 60px rgba(15,23,42,.25);">
          <div style="padding:20px 24px; border-bottom:1px solid #e2e8f0;">
            <h2 style="font-size:18px; margin:0 0 4px;">Assign debate room</h2>
            <p style="font-size:12px; color:#64748b; margin:0;">Choose a configured venue or enter a custom room.</p>
          </div>
          <form onsubmit="return window.tcSavePairingRoom(event, '${escapeJsString(pairingId)}')" style="padding:24px; display:grid; gap:18px;">
            <div class="form-group">
              <label class="form-label">Room</label>
              <input name="room_label" list="pairing-room-options" required class="form-input" value="${escapeHtml(context.pairing.room_label || '')}">
              <datalist id="pairing-room-options">${choices.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
              <button type="submit" class="btn btn--primary">${icon('mapPin', 15)} Save room</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.tcSavePairingRoom = async (event, pairingId) => {
    event.preventDefault();
    if (!isUserAdmin) return false;
    const roomLabel = String(new FormData(event.target).get('room_label') || '').trim();
    if (!roomLabel) {
      alert('Please enter a room.');
      return false;
    }
    const context = getPairingContext(pairingId);
    const roomAlreadyUsed = (context?.round.draw_pairings || []).some(pairing =>
      pairing.id !== pairingId &&
      String(pairing.room_label || '').trim().toLowerCase() === roomLabel.toLowerCase());
    if (roomAlreadyUsed) {
      alert('That room is already assigned to another debate in this round.');
      return false;
    }
    const { error } = await supabase.from('draw_pairings').update({ room_label: roomLabel }).eq('id', pairingId);
    if (error) alert(error.message);
    else {
      document.getElementById('modal-root').innerHTML = '';
      await fetchAndRender();
    }
    return false;
  };

  window.tcOpenPanelModal = pairingId => {
    if (!isUserAdmin) {
      alert('Only tournament admins can edit adjudicator panels.');
      return;
    }
    const context = getPairingContext(pairingId);
    if (!context) return;

    const currentAssignments = getPanelAssignments(context.pairing);
    const assignedElsewhere = new Map();
    (context.round.draw_pairings || []).filter(pairing => pairing.id !== pairingId).forEach(pairing => {
      getPanelAssignments(pairing).forEach((role, judgeId) => assignedElsewhere.set(judgeId, pairing.room_label || 'another room'));
    });
    const available = currentAdjudicators.filter(judge =>
      (judge.status || 'Active') === 'Active' || currentAssignments.has(judge.id));

    document.getElementById('modal-root').innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
        <div style="background:white; border-radius:10px; width:min(680px,100%); max-height:calc(100vh - 40px); overflow:auto; border:1px solid #e2e8f0; box-shadow:0 24px 60px rgba(15,23,42,.25);">
          <div style="padding:20px 24px; border-bottom:1px solid #e2e8f0;">
            <h2 style="font-size:18px; margin:0 0 4px;">Edit adjudicator panel</h2>
            <p style="font-size:12px; color:#64748b; margin:0;">${escapeHtml(context.pairing.room_label || 'Room')} · round target ${Math.max(1, Number(context.round.panel_size) || 1)}. Select any panel size, with exactly one chair.</p>
          </div>
          <form onsubmit="return window.tcSavePairingPanel(event, '${escapeJsString(pairingId)}')" style="padding:20px 24px; display:grid; gap:10px;">
            ${available.map(judge => {
              const role = currentAssignments.get(judge.id) || (judge.is_trainee ? 'TRAINEE' : 'WING');
              const elsewhere = assignedElsewhere.get(judge.id);
              const disabled = Boolean(elsewhere && !currentAssignments.has(judge.id));
              return `
                <div style="display:grid; grid-template-columns:24px minmax(0,1fr) 130px; gap:12px; align-items:center; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; opacity:${disabled ? '.55' : '1'};">
                  <input type="checkbox" name="judge-${escapeHtml(judge.id)}" ${currentAssignments.has(judge.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                  <div>
                    <div style="font-weight:800; color:#172033;">${escapeHtml(judge.name || 'Unnamed adjudicator')}</div>
                    <div style="font-size:11px; color:#64748b;">${escapeHtml(judge.institution || 'Independent')}${elsewhere ? ` · Assigned to ${escapeHtml(elsewhere)}` : ''}</div>
                  </div>
                  <select name="role-${escapeHtml(judge.id)}" class="form-input form-select" ${disabled ? 'disabled' : ''} style="padding:7px;">
                    ${['CHAIR', 'WING', 'TRAINEE'].map(value => `<option value="${value}" ${role === value ? 'selected' : ''}>${value[0] + value.slice(1).toLowerCase()}</option>`).join('')}
                  </select>
                </div>
              `;
            }).join('') || '<div style="color:#64748b; padding:20px; text-align:center;">No active adjudicators available.</div>'}
            <div style="display:flex; justify-content:flex-end; gap:10px; padding-top:10px;">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
              <button type="submit" class="btn btn--primary">${icon('check', 15)} Save panel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.tcSavePairingPanel = async (event, pairingId) => {
    event.preventDefault();
    if (!isUserAdmin) return false;
    const fd = new FormData(event.target);
    const selected = currentAdjudicators
      .filter(judge => fd.get(`judge-${judge.id}`) === 'on')
      .map(judge => ({ judge, role: String(fd.get(`role-${judge.id}`) || 'WING') }));
    const chairs = selected.filter(item => item.role === 'CHAIR');
    if (selected.length === 0) {
      alert('Select at least one adjudicator.');
      return false;
    }
    if (chairs.length !== 1) {
      alert('Each debate panel must have exactly one chair.');
      return false;
    }
    if (chairs[0].judge.is_trainee) {
      alert('A trainee cannot be assigned as the panel chair.');
      return false;
    }

    const { error: deleteError } = await supabase.from('adjudicator_allocations').delete().eq('pairing_id', pairingId);
    if (deleteError) {
      alert(deleteError.message);
      return false;
    }
    const { error: pairingError } = await supabase.from('draw_pairings').update({ chair_id: chairs[0].judge.id }).eq('id', pairingId);
    if (pairingError) {
      alert(pairingError.message);
      return false;
    }
    const allocations = selected
      .filter(item => item.role !== 'CHAIR')
      .map(item => ({ pairing_id: pairingId, adjudicator_id: item.judge.id, role: item.role }));
    if (allocations.length) {
      const { error } = await supabase.from('adjudicator_allocations').insert(allocations);
      if (error) {
        alert(error.message);
        return false;
      }
    }
    document.getElementById('modal-root').innerHTML = '';
    await fetchAndRender();
    return false;
  };

  const renderReadiness = () => {
    const activeTeams = currentTeams.filter(team => (team.status || 'Active') !== 'Inactive');
    const activeJudges = currentAdjudicators.filter(judge => (judge.status || 'Active') === 'Active');
    return `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
          <div style="font-size:11px; color:#64748b; font-weight:800; text-transform:uppercase; margin-bottom:8px;">Teams ready (${activeTeams.length})</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${activeTeams.slice(0, 8).map(team => `<span style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:999px; padding:4px 8px; font-size:12px;">${teamLabelHtml(team)}</span>`).join('') || '<span style="font-size:12px; color:#64748b;">No active teams</span>'}
          </div>
        </div>
        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
          <div style="font-size:11px; color:#64748b; font-weight:800; text-transform:uppercase; margin-bottom:8px;">Adjudicators ready (${activeJudges.length})</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${activeJudges.slice(0, 8).map(judge => `<span style="background:#eff6ff; color:#075985; border:1px solid #bfdbfe; border-radius:999px; padding:4px 8px; font-size:12px; font-weight:700;">Adjudicator · ${escapeHtml(judge.name || 'Unnamed')}</span>`).join('') || '<span style="font-size:12px; color:#64748b;">No active adjudicators</span>'}
          </div>
        </div>
      </div>
    `;
  };

  const renderPairing = (pairing, round) => {
    const teamPositions = [
      ['OG', pairing.og_team_id],
      ['OO', pairing.oo_team_id],
      ['CG', pairing.cg_team_id],
      ['CO', pairing.co_team_id]
    ];
    const panel = [...getPanelAssignments(pairing)].map(([id, role]) => ({
      id,
      role: role === 'CHAIR' ? 'Chair' : role === 'TRAINEE' ? 'Trainee' : 'Wing'
    }));

    return `
      <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:white;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:14px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <div>
            <div style="font-weight:900; color:#172033;">${escapeHtml(pairing.room_label || 'Room')}</div>
            <div style="font-size:11px; color:#64748b;">${roundIsBlind(round) ? 'Blind to adjudicators' : 'Open identities'} · ${pairing.ballots?.length ? 'Ballot confirmed' : 'Awaiting ballot'}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${isUserAdmin ? `<button onclick="window.tcOpenRoomModal('${escapeJsString(pairing.id)}')" class="btn btn--outline btn--sm">${icon('mapPin', 14)} Room</button>` : ''}
            ${isUserAdmin ? `<button onclick="window.tcOpenPanelModal('${escapeJsString(pairing.id)}')" class="btn btn--outline btn--sm">${icon('users', 14)} Panel</button>` : ''}
            ${pairing.ballots?.length > 0 ? `<span style="color:#047857; font-size:12px; font-weight:800;">${icon('check', 12)} Confirmed</span>` : ''}
            ${isUserAdmin ? (pairing.ballots?.length > 0
              ? `<button onclick="window.tcUnlockBallot('${escapeJsString(pairing.ballots[0].id)}')" class="btn btn--outline btn--sm" style="color:#ef4444; border-color:#fecaca;">${icon('unlock', 14)} Unlock</button>`
              : `<button onclick="window.tcEnterBallot('${escapeJsString(pairing.id)}')" class="btn btn--outline btn--sm">${icon('fileText', 14)} Ballot</button>`) : ''}
            ${pairing.jitsi_link ? `<a href="${escapeHtml(pairing.jitsi_link)}" target="_blank" class="btn btn--secondary btn--sm" style="display:inline-flex; align-items:center; gap:6px;">${icon('mic', 14)} Join</a>` : ''}
          </div>
        </div>
        <div style="padding:16px; display:grid; grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr); gap:16px;">
          <div>
            <div style="font-size:11px; color:#64748b; font-weight:900; text-transform:uppercase; margin-bottom:8px;">Teams</div>
            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">
              ${teamPositions.map(([pos, teamId]) => `
                <div style="border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                  <div style="font-size:11px; color:#64748b; font-weight:900; margin-bottom:4px;">${pos}</div>
                  <div style="font-weight:800; color:#172033;">${teamLabelFromMap(currentTeamMap, teamId)}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <div style="font-size:11px; color:#64748b; font-weight:900; text-transform:uppercase; margin-bottom:8px;">Adjudicator panel · ${panel.length} assigned / ${Math.max(1, Number(round.panel_size) || 1)} target</div>
            <div style="display:grid; gap:8px;">
              ${panel.length ? panel.map(member => judgeLabel(currentJudgeMap.get(member.id), member.role)).join('') : '<div style="font-size:13px; color:#64748b;">No adjudicators assigned.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderUI = (rounds) => {
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Debate rounds</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Create, edit, publish, blind, and complete tournament rounds.</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:flex-end;">
          ${isUserAdmin ? `<button onclick="window.tcOpenRoundModal()" class="btn btn--primary" style="gap:8px;">${icon('plus', 16)} Add Round</button>` : `<span style="font-size:13px; color:#64748b;">Read-only: admin permissions required for changes.</span>`}
        </div>
      </div>

      ${rounds.length === 0 ? `
        <div class="card" style="padding:32px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
            <div>
              <h3 style="font-size:18px; font-weight:900; margin-bottom:6px;">No rounds yet</h3>
              <p style="color:#64748b; font-size:14px; margin:0;">Create the first round, then generate pairings once teams and adjudicators are ready.</p>
            </div>
            ${isUserAdmin ? `<button onclick="window.tcOpenRoundModal()" class="btn btn--primary">${icon('plus', 16)} Add Round</button>` : ''}
          </div>
          ${renderReadiness()}
        </div>
      ` : `
        <div style="display:grid; gap:18px;">
          ${rounds.map(round => `
            <section class="card" style="padding:0; overflow:hidden;">
              <div style="padding:18px 20px; border-bottom:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="width:36px; height:36px; background:var(--color-primary); color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:900;">${escapeHtml(round.round_num || '')}</div>
                  <div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <h2 style="font-size:17px; font-weight:900; color:#172033; margin:0;">${escapeHtml(round.name || 'Round')}</h2>
                      ${statusBadge(round.status)}
                      <span style="background:${roundIsBlind(round) ? '#eef2ff' : '#ecfdf5'}; color:${roundIsBlind(round) ? '#3730a3' : '#047857'}; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:900;">${roundIsBlind(round) ? 'Blind' : 'Open'}</span>
                      <span style="background:#f1f5f9; color:#475569; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:900;">Panel ${Math.max(1, Number(round.panel_size) || 1)}</span>
                      ${roundIsBlind(round) ? `<span style="background:${round.results_released ? '#ecfdf5' : '#fff7ed'}; color:${round.results_released ? '#047857' : '#c2410c'}; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:900;">Results ${round.results_released ? 'released' : 'withheld'}</span>` : ''}
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-top:4px;">${escapeHtml(round.type || 'POWER')} pairing · ${round.draw_pairings?.length || 0} room${round.draw_pairings?.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                  ${round.motion_released_at ? `
                    <div style="background:white; border:1px solid #e2e8f0; padding:6px 10px; border-radius:8px; display:flex; align-items:center; gap:8px; font-size:12px;">
                      ${icon('clock', 14)} <span id="timer-${round.id}" style="font-family:monospace; font-weight:800;">--:--</span>
                    </div>
                  ` : (isUserAdmin ? `<button onclick="window.tcReleaseMotion('${escapeJsString(round.id)}')" class="btn btn--outline btn--sm">${icon('megaphone', 14)} Release Motion</button>` : '')}
                  ${isUserAdmin ? `
                    <button onclick="window.tcOpenRoundModal('${escapeJsString(round.id)}')" class="btn btn--outline btn--sm">${icon('pencil', 14)} Edit</button>
                    <button onclick="window.tcToggleRoundBlind('${escapeJsString(round.id)}', ${roundIsBlind(round) ? 'false' : 'true'})" class="btn btn--outline btn--sm">${roundIsBlind(round) ? icon('eye', 14) + ' Make Open' : icon('eyeOff', 14) + ' Make Blind'}</button>
                    ${roundIsBlind(round) ? `<button onclick="window.tcToggleRoundResults('${escapeJsString(round.id)}', ${round.results_released ? 'false' : 'true'})" class="btn btn--outline btn--sm">${round.results_released ? icon('eyeOff', 14) + ' Withhold Results' : icon('eye', 14) + ' Release Results'}</button>` : ''}
                    ${round.draw_pairings?.length ? '' : `<button onclick="window.tcGeneratePairings('${escapeJsString(round.id)}', ${Number(round.round_num) || 1})" class="btn btn--secondary btn--sm">${icon('zap', 14)} Generate Pairings</button>`}
                    ${round.draw_pairings?.length && String(round.status || 'Draft') === 'Draft' ? `<button onclick="window.tcReleaseDraw('${escapeJsString(round.id)}')" class="btn btn--sm" style="background:#10b981; color:white;">${icon('send', 14)} Publish</button>` : ''}
                    ${String(round.status || '').toLowerCase() !== 'completed' ? `<button onclick="window.tcCompleteRound('${escapeJsString(round.id)}')" class="btn btn--outline btn--sm">${icon('checkCircle', 14)} Complete</button>` : ''}
                  ` : ''}
                </div>
              </div>
              <div style="padding:18px; display:grid; gap:14px;">
                ${round.motion_text ? `<div style="border:1px solid #e2e8f0; background:#fff; border-radius:8px; padding:12px; font-size:13px;"><strong>Motion:</strong> ${escapeHtml(round.motion_text)}</div>` : ''}
                ${round.draw_pairings?.length ? round.draw_pairings.map(pairing => renderPairing(pairing, round)).join('') : `
                  <div style="padding:18px; border:1px dashed #cbd5e1; border-radius:10px; color:#64748b; font-size:14px;">
                    No pairings generated for this round yet.
                    ${renderReadiness()}
                  </div>
                `}
              </div>
            </section>
          `).join('')}
        </div>
      `}
    `;

    renderAppLayout(container, '/tournament/debate-rounds', 'Debate Rounds', '', content);
  };

  fetchAndRender();
}
