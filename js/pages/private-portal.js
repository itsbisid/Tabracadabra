import { icon } from '../components/icons.js';
import { showBallotModal } from '../components/ballot-modal.js';
import { supabase } from '../lib/supabase.js';
import { escapeHtml, escapeJsString } from '../lib/html.js';

function getRoleLabel(role) {
  return role === 'judge' ? 'Adjudicator' : 'Team';
}

function renderNotice(title, text) {
  return `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px; background:#f8fafc; font-family:Inter, sans-serif;">
      <div style="max-width:560px; background:white; border:1px solid #e2e8f0; border-radius:16px; padding:40px; text-align:center;">
        <div style="width:56px; height:56px; border-radius:16px; background:#eff6ff; color:#0044b3; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">${icon('lock', 28)}</div>
        <h1 style="font-size:24px; font-weight:800; margin-bottom:8px; color:#0f172a;">${escapeHtml(title)}</h1>
        <p style="color:#64748b; line-height:1.6; margin:0;">${escapeHtml(text)}</p>
      </div>
    </div>
  `;
}

function positionForTeam(pairing, teamId) {
  const positions = {
    OG: pairing.og_team_id,
    OO: pairing.oo_team_id,
    CG: pairing.cg_team_id,
    CO: pairing.co_team_id
  };

  return Object.entries(positions).find(([, id]) => id === teamId)?.[0] || '';
}

function teamName(teamMap, teamId) {
  return escapeHtml(teamMap.get(teamId)?.name || teamId || 'TBD');
}

async function fetchProfile(role, id) {
  if (role === 'judge') {
    const { data, error } = await supabase.from('adjudicators').select('*').eq('id', id).single();
    return { data, error };
  }

  const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
  return { data, error };
}

async function fetchPairings(role, id, tournamentId) {
  const filters = role === 'judge'
    ? `chair_id.eq.${id}`
    : `og_team_id.eq.${id},oo_team_id.eq.${id},cg_team_id.eq.${id},co_team_id.eq.${id}`;

  const withBallots = await supabase
    .from('draw_pairings')
    .select('*, rounds!inner(*), ballots(*)')
    .eq('tournament_id', tournamentId)
    .or(filters);

  if (!withBallots.error) return withBallots.data || [];

  const fallback = await supabase
    .from('draw_pairings')
    .select('*, rounds!inner(*)')
    .eq('tournament_id', tournamentId)
    .or(filters);

  return fallback.data || [];
}

function renderProfileCard(role, profile, tournament) {
  const tournamentName = tournament?.short_name || tournament?.name || 'Tournament';
  const details = role === 'judge'
    ? [
        ['Name', profile.name],
        ['Institution', profile.institution || 'Independent'],
        ['Email', profile.email || 'Not provided']
      ]
    : [
        ['Team', profile.name],
        ['Institution', profile.institution || 'Unaffiliated'],
        ['Speaker 1', profile.speaker1_name || 'TBD'],
        ['Speaker 2', profile.speaker2_name || 'TBD']
      ];

  return `
    <section style="background:#0f2b5b; color:white; padding:32px; border-radius:16px; margin-bottom:20px;">
      <div style="font-size:12px; opacity:.75; text-transform:uppercase; font-weight:800; letter-spacing:.08em; margin-bottom:8px;">${escapeHtml(tournamentName)} private portal</div>
      <h1 style="font-size:32px; line-height:1.1; margin:0 0 16px; font-weight:900;">${escapeHtml(profile.name || getRoleLabel(role))}</h1>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
        ${details.map(([label, value]) => `
          <div style="background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.14); border-radius:10px; padding:12px;">
            <div style="font-size:11px; opacity:.72; margin-bottom:4px;">${escapeHtml(label)}</div>
            <div style="font-size:14px; font-weight:800;">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDrawCard(role, profile, pairings, teamMap) {
  const releasedPairings = pairings
    .filter(pairing => pairing.rounds?.status === 'Released')
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0));

  if (releasedPairings.length === 0) {
    return `
      <section class="portal-card">
        <div class="portal-card__heading">${icon('mapPin', 18)} Debate draw / venue</div>
        <p class="portal-muted">Your draw and venue will appear here once the tab room releases them.</p>
      </section>
    `;
  }

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('mapPin', 18)} Debate draw / venue</div>
      ${releasedPairings.map(pairing => {
        const position = role === 'team' ? positionForTeam(pairing, profile.id) : 'Chair';
        return `
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-top:12px;">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:12px;">
              <div>
                <div style="font-size:12px; color:#64748b; font-weight:800; text-transform:uppercase;">Round ${escapeHtml(pairing.rounds?.round_num || '')}</div>
                <div style="font-size:18px; color:#0f172a; font-weight:900;">${escapeHtml(pairing.rounds?.name || 'Released round')}</div>
              </div>
              <span style="background:#eff6ff; color:#0044b3; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800;">${escapeHtml(position)}</span>
            </div>
            <div style="font-weight:800; margin-bottom:10px;">Venue: ${escapeHtml(pairing.room_label || 'TBD')}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; font-size:13px;">
              ${['OG', 'OO', 'CG', 'CO'].map(pos => {
                const teamId = pairing[`${pos.toLowerCase()}_team_id`];
                const active = teamId === profile.id;
                return `<div style="border:1px solid ${active ? '#0044b3' : '#e2e8f0'}; background:${active ? '#eff6ff' : '#fff'}; border-radius:8px; padding:10px;"><strong>${pos}</strong><br>${teamName(teamMap, teamId)}</div>`;
              }).join('')}
            </div>
            ${pairing.jitsi_link ? `<a href="${escapeHtml(pairing.jitsi_link)}" target="_blank" rel="noopener" class="portal-button" style="margin-top:14px;">${icon('mic', 16)} Join room</a>` : ''}
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderMotionsCard(rounds) {
  const releasedMotions = rounds
    .filter(round => round.motion_released_at && round.motion_text)
    .sort((a, b) => (b.round_num || 0) - (a.round_num || 0));

  if (releasedMotions.length === 0) {
    return `
      <section class="portal-card">
        <div class="portal-card__heading">${icon('fileText', 18)} Motions</div>
        <p class="portal-muted">Released motions will appear here.</p>
      </section>
    `;
  }

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('fileText', 18)} Motions</div>
      ${releasedMotions.map(round => `
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-top:12px;">
          <div style="font-size:12px; color:#64748b; font-weight:800; text-transform:uppercase;">Round ${escapeHtml(round.round_num || '')}</div>
          ${round.motion_info ? `<p style="color:#475569; margin:8px 0;">${escapeHtml(round.motion_info)}</p>` : ''}
          <div style="font-size:17px; font-weight:900; color:#0f172a;">${escapeHtml(round.motion_text)}</div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderBallotCard(role, pairings) {
  if (role !== 'judge') {
    return `
      <section class="portal-card">
        <div class="portal-card__heading">${icon('clipboardCheck', 18)} Ballots</div>
        <p class="portal-muted">Ballot forms only appear for adjudicators assigned to submit them.</p>
      </section>
    `;
  }

  const openBallots = pairings.filter(pairing => {
    const isReleased = pairing.rounds?.status === 'Released';
    const hasBallot = Array.isArray(pairing.ballots) && pairing.ballots.length > 0;
    return isReleased && !hasBallot;
  });

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('clipboardCheck', 18)} Ballots</div>
      ${openBallots.length === 0 ? `
        <p class="portal-muted">No ballot is currently open for this adjudicator link.</p>
      ` : openBallots.map(pairing => `
        <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-top:12px;">
          <div>
            <div style="font-weight:900;">${escapeHtml(pairing.rounds?.name || 'Round')} - ${escapeHtml(pairing.room_label || 'Room')}</div>
            <div style="font-size:13px; color:#64748b;">Submit the official ballot for this room.</div>
          </div>
          <button class="portal-button" onclick="window.tcPortalEnterBallot('${escapeJsString(pairing.id)}')">${icon('fileText', 16)} Open ballot</button>
        </div>
      `).join('')}
    </section>
  `;
}

function renderFeedbackCard(role, profile, pairings, blocked) {
  const latest = pairings
    .filter(pairing => Array.isArray(pairing.ballots) && pairing.ballots.length > 0 && pairing.chair_id)
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0))[0];

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('messageSquare', 18)} Feedback</div>
      ${!latest ? `
        <p class="portal-muted">Feedback forms will appear here after a completed round.</p>
      ` : `
        <p class="portal-muted">${blocked ? 'Feedback is required before the next draw is unlocked.' : 'You can submit feedback for your latest completed round.'}</p>
        <form onsubmit="window.tcPortalSubmitFeedback(event)" style="display:grid; gap:12px; margin-top:14px;">
          <input type="hidden" name="pairing_id" value="${escapeHtml(latest.id)}">
          <input type="hidden" name="target_id" value="${escapeHtml(latest.chair_id)}">
          <input type="hidden" name="submitted_by_id" value="${escapeHtml(profile.id)}">
          <input type="hidden" name="submitted_role" value="${escapeHtml(role === 'judge' ? 'JUDGE' : 'TEAM')}">
          <label style="font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase;">Score</label>
          <input class="portal-input" name="score" type="number" min="1" max="10" required placeholder="1-10">
          <label style="font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase;">Comments</label>
          <textarea class="portal-input" name="comments" rows="4" placeholder="Optional context for tab/adjudication core"></textarea>
          <button class="portal-button" type="submit">${icon('send', 16)} Submit feedback</button>
        </form>
      `}
    </section>
  `;
}

function renderCheckInCard(tournament) {
  const settings = tournament?.settings || {};
  const enabled = Boolean(settings.online_check_in || settings.onlineCheckIn || settings.check_in_enabled);

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('checkSquare', 18)} Check-in</div>
      ${enabled ? `
        <p class="portal-muted">Online check-in is enabled for this tournament. Your check-in action will appear here when the next round opens.</p>
        <button class="portal-button" type="button" onclick="alert('Check-in is not open yet.')">${icon('check', 16)} Check in</button>
      ` : `
        <p class="portal-muted">This tournament has not enabled online check-in.</p>
      `}
    </section>
  `;
}

export async function renderPrivatePortal(container, role, id) {
  const safeRole = role === 'judge' ? 'judge' : 'team';
  const { data: profile, error } = await fetchProfile(safeRole, id);

  if (error || !profile) {
    container.className = '';
    container.innerHTML = renderNotice('Private link unavailable', 'This private tournament link is invalid or no longer available.');
    return;
  }

  const tournamentId = profile.tournament_id;
  const [{ data: tournament }, { data: teams }, { data: rounds }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('teams').select('*').eq('tournament_id', tournamentId),
    supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('round_num', { ascending: true })
  ]);

  const teamMap = new Map((teams || []).map(team => [team.id, team]));
  const pairings = await fetchPairings(safeRole, profile.id, tournamentId);
  const blocked = false;

  window.tcPortalEnterBallot = (pairingId) => {
    const pairing = pairings.find(item => item.id === pairingId);
    if (pairing) showBallotModal(pairing, () => renderPrivatePortal(container, safeRole, id));
  };

  window.tcPortalSubmitFeedback = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const { error: submitError } = await supabase.from('judge_feedback').insert({
      tournament_id: tournamentId,
      submitted_by_id: formData.get('submitted_by_id'),
      target_judge_id: formData.get('target_id'),
      pairing_id: formData.get('pairing_id'),
      score: Number(formData.get('score')),
      comments: formData.get('comments')
    });

    if (submitError) {
      alert(submitError.message);
      return;
    }

    alert('Feedback submitted.');
    renderPrivatePortal(container, safeRole, id);
  };

  container.className = '';
  container.innerHTML = `
    <div style="min-height:100vh; background:#f8fafc; color:#0f172a; font-family:Inter, sans-serif;">
      <style>
        .portal-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:16px; }
        .portal-card__heading { display:flex; align-items:center; gap:8px; color:#0f172a; font-weight:900; font-size:17px; }
        .portal-muted { color:#64748b; line-height:1.6; margin:12px 0 0; }
        .portal-button { border:0; background:#0044b3; color:white; border-radius:8px; padding:10px 14px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-size:13px; }
        .portal-input { width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px 12px; font-size:14px; font-family:inherit; box-sizing:border-box; }
      </style>
      <main style="max-width:980px; margin:0 auto; padding:28px 20px 48px;">
        ${renderProfileCard(safeRole, profile, tournament)}
        <div style="display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr); gap:16px; align-items:start;">
          <div>
            ${renderDrawCard(safeRole, profile, pairings, teamMap)}
            ${renderMotionsCard(rounds || [])}
          </div>
          <div>
            ${renderFeedbackCard(safeRole, profile, pairings, blocked)}
            ${renderBallotCard(safeRole, pairings)}
            ${renderCheckInCard(tournament)}
          </div>
        </div>
      </main>
    </div>
  `;
}
