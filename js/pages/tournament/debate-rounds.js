import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { BPEngine } from '../../lib/bp-engine.js';
import { showBallotModal } from '../../components/ballot-modal.js';

export async function renderDebateRounds(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let timers = {};
  let targetPanelSize = 3;

  const fetchAndRender = async () => {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*, draw_pairings(*, ballots(*))')
      .eq('tournament_id', tournamentId)
      .order('round_num', { ascending: true });
    
    renderUI(rounds || []);
    setupTimers(rounds || []);
  };

  window.tcSetPanelSize = (size) => {
    targetPanelSize = size;
    fetchAndRender();
  };

  window.tcUnlockBallot = async (ballotId) => {
    if (confirm('Unlock this ballot for editing? This will revert it from LOCKED to DRAFT.')) {
      const { error } = await supabase.from('ballots').update({ status: 'DRAFT' }).eq('id', ballotId);
      if (error) alert(error.message);
      else fetchAndRender();
    }
  };

  const playPrepSound = () => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioContext.currentTime); // High A
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 1.5);
  };

  window.tcReleaseMotion = async (roundId, defaultPrep = 15) => {
    const prepTime = prompt('Enter prep time in minutes:', defaultPrep);
    if (prepTime === null) return;

    const { error } = await supabase.from('rounds').update({
      motion_released_at: new Date().toISOString(),
      prep_time_override: parseInt(prepTime)
    }).eq('id', roundId);

    if (error) alert(error.message);
    else fetchAndRender();
  };

  const setupTimers = (rounds) => {
    // Clear old timers
    Object.values(timers).forEach(clearInterval);
    timers = {};

    rounds.forEach(r => {
      if (r.motion_released_at) {
        const releaseTime = new Date(r.motion_released_at).getTime();
        const prepMs = (r.prep_time_override || 15) * 60 * 1000;
        const endTime = releaseTime + prepMs;

        timers[r.id] = setInterval(() => {
          const now = Date.now();
          const remaining = endTime - now;
          const el = document.getElementById(`timer-${r.id}`);
          
          if (el) {
            if (remaining <= 0) {
              el.innerHTML = `<span style="color:#ef4444; font-weight:800;">PREP OVER</span>`;
              if (Math.abs(remaining) < 2000) playPrepSound(); // Only play if it just happened
              clearInterval(timers[r.id]);
            } else {
              const mins = Math.floor(remaining / 60000);
              const secs = Math.floor((remaining % 60000) / 1000);
              el.innerHTML = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          }
        }, 1000);
      }
    });
  };

  window.tcCreateRound = async () => {
    const { data: existing } = await supabase.from('rounds').select('round_num').eq('tournament_id', tournamentId);
    const nextNum = (existing?.length || 0) + 1;
    
    const { error } = await supabase.from('rounds').insert({
      tournament_id: tournamentId,
      round_num: nextNum,
      name: `Round ${nextNum}`,
      status: 'Draft',
      type: (nextNum === 1) ? 'RANDOM' : 'POWER'
    });

    if (error) alert(error.message);
    else fetchAndRender();
  };

  window.tcGeneratePairings = async (roundId, roundNum) => {
    const btn = document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Generating...';
    btn.disabled = true;

    try {
      const { pairings, allocations } = await BPEngine.generateDraw(roundId, tournamentId, roundNum, targetPanelSize);
      
      // 1. Insert Pairings
      const { data: insertedPairings, error: pError } = await supabase.from('draw_pairings').insert(pairings).select();
      if (pError) throw pError;

      // 2. Map allocations to inserted pairing IDs
      const finalAllocations = allocations.map(a => ({
        pairing_id: insertedPairings[a.pairing_idx || 0].id,
        adjudicator_id: a.adjudicator_id,
        role: a.role
      }));

      const { error: aError } = await supabase.from('adjudicator_allocations').insert(finalAllocations);
      if (aError) throw aError;
      
      fetchAndRender();
    } catch (err) {
      alert(err.message);
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
  };

  window.tcReleaseDraw = async (roundId) => {
    const { error } = await supabase.from('rounds').update({ status: 'Released' }).eq('id', roundId);
    if (error) alert(error.message);
    else {
      alert('Draw Released! Participants will see it now.');
      fetchAndRender();
    }
  };

  window.tcEnterBallot = (pairingId) => {
    supabase.from('draw_pairings').select('*').eq('id', pairingId).single().then(({ data }) => {
      if (data) {
        showBallotModal(data, () => fetchAndRender());
      }
    });
  };

  const renderUI = (rounds) => {
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--color-text); margin-bottom:4px;">Debate rounds</h1>
          <div style="font-size:14px; color:var(--color-text-muted);">Manage your tournament rounds, pairings, and ballots</div>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="display:flex; background:#f1f5f9; padding:4px; border-radius:8px; gap:4px;">
            ${[1, 3, 5].map(s => `
              <button onclick="window.tcSetPanelSize(${s})" style="border:none; background:${targetPanelSize === s ? 'white' : 'transparent'}; color:${targetPanelSize === s ? 'var(--color-primary)' : '#64748b'}; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:${targetPanelSize === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">
                Panel of ${s}
              </button>
            `).join('')}
          </div>
          <button onclick="window.tcCreateRound()" class="btn btn--primary">${icon('plus', 16)} Add Round</button>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:24px;">
        ${rounds.map(r => `
          <div class="card" style="padding:0; overflow:hidden;">
            <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:32px; height:32px; background:var(--color-primary); color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700;">${r.round_num}</div>
                <div>
                  <div style="font-weight:700;">${r.name}</div>
                  <div style="font-size:11px; color:#64748b; text-transform:uppercase;">${r.status} · ${r.type}</div>
                </div>
              </div>
              <div style="display:flex; gap:12px; align-items:center;">
                ${r.motion_released_at ? `
                  <div style="background:#f1f5f9; padding:6px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;">
                    ${icon('clock', 14)} <span id="timer-${r.id}" style="font-family:monospace; font-weight:700;">--:--</span>
                  </div>
                ` : `
                   <button onclick="window.tcReleaseMotion('${r.id}')" class="btn btn--outline btn--sm">${icon('megaphone', 14)} Release Motion</button>
                `}
                
                ${r.draw_pairings?.length > 0 ? `
                  ${r.status === 'Draft' ? `<button onclick="window.tcReleaseDraw('${r.id}')" class="btn btn--sm" style="background:#10b981; color:white;">${icon('send', 14)} Release Draw</button>` : `<span class="badge badge--active">RELEASED</span>`}
                ` : `
                  <button onclick="window.tcGeneratePairings('${r.id}', ${r.round_num})" class="btn btn--secondary btn--sm">${icon('zap', 14)} Generate Pairings</button>
                `}
              </div>
            </div>

            ${r.draw_pairings?.length > 0 ? `
              <div style="padding:0;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead style="background:#f1f5f9; color:#64748b; font-size:11px; text-transform:uppercase;">
                    <tr>
                      <th style="padding:12px 16px; text-align:left;">Room</th>
                      <th style="padding:12px 16px; text-align:left;">OG / OO</th>
                      <th style="padding:12px 16px; text-align:left;">CG / CO</th>
                      <th style="padding:12px 16px; text-align:left;">Judge</th>
                      <th style="padding:12px 16px; text-align:right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${r.draw_pairings.map(p => `
                      <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:16px;">
                          <div style="font-weight:700;">${p.room_label}</div>
                          ${p.ballots?.length > 0 ? `<div style="font-size:10px; color:#10b981; font-weight:700; margin-top:4px;">${icon('check', 10)} CONFIRMED</div>` : ''}
                        </td>
                        <td style="padding:16px;">
                          <div style="margin-bottom:4px;"><span style="color:#64748b; font-weight:600;">OG:</span> ${p.og_team_id}</div>
                          <div><span style="color:#64748b; font-weight:600;">OO:</span> ${p.oo_team_id}</div>
                        </td>
                        <td style="padding:16px;">
                          <div style="margin-bottom:4px;"><span style="color:#64748b; font-weight:600;">CG:</span> ${p.cg_team_id}</div>
                          <div><span style="color:#64748b; font-weight:600;">CO:</span> ${p.co_team_id}</div>
                        </td>
                        <td style="padding:16px;">
                          <div style="color:var(--color-primary); font-weight:600;">${p.chair_id || 'unassigned'}</div>
                        </td>
                        <td style="padding:16px; text-align:right;">
                          <div style="display:flex; justify-content:flex-end; gap:8px;">
                            ${p.ballots?.length > 0 ? `
                              <button onclick="window.tcUnlockBallot('${p.ballots[0].id}')" class="btn btn--outline btn--sm" style="color:#ef4444; border-color:#fee2e2;">
                                ${icon('unlock', 14)} Unlock
                              </button>
                            ` : `
                              <button onclick="window.tcEnterBallot('${p.id}')" class="btn btn--outline btn--sm" style="display:inline-flex; align-items:center; gap:6px;">
                                ${icon('fileText', 14)} Ballot
                              </button>
                            `}
                            <a href="${p.jitsi_link}" target="_blank" class="btn btn--secondary btn--sm" style="display:inline-flex; align-items:center; gap:6px;">
                              ${icon('mic', 14)} Join
                            </a>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="padding:40px; text-align:center; color:#64748b;">
                <div style="font-size:14px;">No pairings generated yet.</div>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `;

    renderAppLayout(container, '/tournament/debate-rounds', 'Debate Rounds', '', content);
  };

  fetchAndRender();
}
