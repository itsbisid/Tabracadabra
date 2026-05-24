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
    <section id="portal-feedback-card" class="portal-card">
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

function getTournamentName(tournament) {
  return tournament?.short_name || tournament?.name || 'Tournament';
}

function getPersonalName(role, profile) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const speakerName = params.get('speaker');

  if (role === 'judge') return profile.name || 'Adjudicator';
  return speakerName || profile.speaker1_name || profile.speaker2_name || profile.name || 'Speaker';
}

function getTeamSpeakers(profile) {
  return [profile.speaker1_name, profile.speaker2_name].filter(Boolean).join(', ') || 'Not provided';
}

function getSpeakerCategory(profile, personalName) {
  if (personalName === profile.speaker2_name) return profile.speaker2_eligibility || profile.division || 'Open';
  return profile.speaker1_eligibility || profile.division || 'Open';
}

function getBreakCategory(profile) {
  return profile.manual_category_override || profile.division || getSpeakerCategory(profile, profile.speaker1_name) || 'Open';
}

function renderPortalNav(tournament) {
  return `
    <nav class="portal-nav">
      <div class="portal-brand">
        <div class="portal-brand-mark">${icon('logo', 22)}</div>
        <span>${escapeHtml(getTournamentName(tournament))}</span>
        <span style="color:#64748b;">${icon('chevronDown', 14)}</span>
      </div>
      <div class="portal-links">
        <span>Team Tab</span>
        <span>Speaker Tab</span>
        <span>Motions Tab</span>
        <span>Results</span>
        <span>Break</span>
        <span>Participants</span>
        <span>Institutions</span>
      </div>
      <span class="portal-login">Login</span>
    </nav>
  `;
}

function renderWarning(personName) {
  return `
    <div class="portal-warning">
      ${icon('alertCircle', 20)}
      <div>
        The URL of this page is personalised to you, ${escapeHtml(personName)}.
        <strong>Do not share it with anyone;</strong> anyone who knows this URL can submit results and/or feedback for your debates.
        You may bookmark this page and return here after each debate for the available actions.
      </div>
    </div>
  `;
}

function getOpenBallots(role, pairings) {
  if (role !== 'judge') return [];

  return pairings.filter(pairing => {
    const isReleased = pairing.rounds?.status === 'Released';
    const hasBallot = Array.isArray(pairing.ballots) && pairing.ballots.length > 0;
    return isReleased && !hasBallot;
  });
}

function renderActionRows(role, tournament, pairings) {
  const onlineCheckIn = Boolean(tournament?.settings?.online_check_in || tournament?.settings?.onlineCheckIn || tournament?.settings?.check_in_enabled);
  const openBallots = getOpenBallots(role, pairings);

  return `
    <section class="portal-action-list">
      <button class="portal-action-row" type="button" onclick="alert('Push notifications are not enabled yet.')">
        <span>${icon('bell', 20)} Subscribe to Push Notifications</span>
        ${icon('chevronRight', 18)}
      </button>
      <div class="portal-action-row portal-action-row--notice">
        <span>${icon('alertCircle', 20)} ${onlineCheckIn ? 'You are not currently checked in.' : 'Online check-in is not currently enabled.'}</span>
      </div>
      <button class="portal-action-row" type="button" onclick="alert('Barcode check-in will appear when enabled by the tournament.')">
        <span>${icon('dashboard', 20)} Show barcode for check-in</span>
        ${icon('chevronRight', 18)}
      </button>
      <button class="portal-action-row" type="button" onclick="document.getElementById('portal-feedback-card')?.scrollIntoView({ behavior: 'smooth' })">
        <span>${icon('pen', 20)} Submit Feedback</span>
        ${icon('chevronRight', 18)}
      </button>
      ${openBallots.map(pairing => `
        <button class="portal-action-row" type="button" onclick="window.tcPortalEnterBallot('${escapeJsString(pairing.id)}')">
          <span>${icon('clipboardCheck', 20)} Submit Ballot - ${escapeHtml(pairing.rounds?.name || 'Round')} ${escapeHtml(pairing.room_label || '')}</span>
          ${icon('chevronRight', 18)}
        </button>
      `).join('')}
    </section>
  `;
}

function renderInThisRoundPanel(role, profile, pairings, teamMap) {
  const releasedPairing = pairings
    .filter(pairing => pairing.rounds?.status === 'Released')
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0))[0];

  if (!releasedPairing) {
    return `
      <section class="portal-panel">
        <h2>In This Round</h2>
        <div class="portal-panel-body">
          <em>${role === 'judge' ? 'You are not assigned to a debate this round.' : 'You do not have a debate this round.'}</em>
        </div>
      </section>
    `;
  }

  const position = role === 'judge' ? 'Chair' : positionForTeam(releasedPairing, profile.id);

  return `
    <section class="portal-panel">
      <h2>In This Round</h2>
      <div class="portal-panel-body">
        <div class="portal-round-line"><strong>${escapeHtml(releasedPairing.rounds?.name || 'Round')}</strong> <span>${escapeHtml(position)}</span></div>
        <div style="margin-top:8px;"><strong>Venue:</strong> ${escapeHtml(releasedPairing.room_label || 'TBD')}</div>
        <div class="portal-team-grid">
          ${['OG', 'OO', 'CG', 'CO'].map(pos => {
            const teamId = releasedPairing[`${pos.toLowerCase()}_team_id`];
            const active = teamId === profile.id;
            return `<div class="${active ? 'active' : ''}"><strong>${pos}</strong><br>${teamName(teamMap, teamId)}</div>`;
          }).join('')}
        </div>
        ${releasedPairing.jitsi_link ? `<a class="portal-link-button" href="${escapeHtml(releasedPairing.jitsi_link)}" target="_blank" rel="noopener">${icon('mic', 16)} Join room</a>` : ''}
      </div>
    </section>
  `;
}

function renderRegistrationPanel(role, profile, personName) {
  if (role === 'judge') {
    return `
      <section class="portal-panel">
        <h2>Registration (${escapeHtml(personName)})</h2>
        <div class="portal-panel-body portal-registration-rows">
          <div><strong>Name:</strong> ${escapeHtml(profile.name || 'Not provided')}</div>
          <div><strong>Email:</strong> ${escapeHtml(profile.email || 'Not provided')}</div>
          <div><strong>Role:</strong> Adjudicator${profile.is_trainee ? ' / Trainee' : ''}</div>
          <div class="portal-muted-band"><strong>Institution:</strong> ${escapeHtml(profile.institution || 'Independent')}</div>
        </div>
      </section>
    `;
  }

  return `
    <section class="portal-panel">
      <h2>Registration (${escapeHtml(personName)})</h2>
      <div class="portal-panel-body portal-registration-rows">
        <div><strong>Team name:</strong> ${escapeHtml(profile.name || 'Not provided')}</div>
        ${profile.emoji ? `<div><strong>Emoji:</strong> ${escapeHtml(profile.emoji)}</div>` : ''}
        <div><strong>Speakers:</strong> ${escapeHtml(getTeamSpeakers(profile))}</div>
        <div>
          <strong>Eligible for break categories:</strong> ${escapeHtml(getBreakCategory(profile))}<br>
          <strong>Speaker categories:</strong> ${escapeHtml(getSpeakerCategory(profile, personName))}
        </div>
        <div class="portal-muted-band"><strong>Institution:</strong> ${escapeHtml(profile.institution || 'Unaffiliated')}</div>
      </div>
    </section>
  `;
}

function renderMotionsPanel(rounds) {
  const releasedMotions = rounds
    .filter(round => round.motion_released_at && round.motion_text)
    .sort((a, b) => (b.round_num || 0) - (a.round_num || 0));

  return `
    <section class="portal-panel">
      <h2>Motions</h2>
      <div class="portal-panel-body">
        ${releasedMotions.length === 0 ? `
          <em>No motions have been released yet.</em>
        ` : releasedMotions.map(round => `
          <div style="border-bottom:1px solid #e5e7eb; padding:10px 0;">
            <strong>Round ${escapeHtml(round.round_num || '')}:</strong> ${escapeHtml(round.motion_text)}
            ${round.motion_info ? `<div style="color:#64748b; margin-top:4px;">${escapeHtml(round.motion_info)}</div>` : ''}
          </div>
        `).join('')}
      </div>
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
  const personName = getPersonalName(safeRole, profile);

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
    <div style="min-height:100vh; background:#f3f6f9; color:#111827; font-family:Inter, Arial, sans-serif;">
      <style>
        .portal-nav { height:56px; display:flex; align-items:center; gap:24px; padding:0 22px; background:#fff; border-bottom:1px solid #dde2e8; position:sticky; top:0; z-index:5; }
        .portal-brand { display:flex; align-items:center; gap:8px; font-size:21px; color:#111827; white-space:nowrap; }
        .portal-brand-mark { width:38px; height:38px; border-radius:50%; background:#6f42c1; color:white; display:flex; align-items:center; justify-content:center; }
        .portal-links { display:flex; align-items:center; gap:20px; color:#68707c; font-size:19px; flex:1; overflow:hidden; white-space:nowrap; }
        .portal-login { color:#7b635d; font-size:19px; }
        .portal-page { padding:22px 20px 48px; }
        .portal-title { font-size:40px; line-height:1.15; margin:0 0 20px; font-weight:800; color:#0b1118; }
        .portal-title span { color:#7d8a99; font-weight:500; }
        .portal-warning { display:flex; gap:18px; align-items:flex-start; color:#ff4b14; border:1px solid #ff4b14; background:#fff; border-radius:5px; padding:16px 24px; font-size:20px; line-height:1.35; margin-bottom:20px; }
        .portal-action-list { background:#fff; border:1px solid #d9dde3; border-radius:5px; overflow:hidden; margin-bottom:20px; }
        .portal-action-row { min-height:58px; width:100%; border:0; border-bottom:1px solid #d9dde3; background:#fff; color:#673ab7; display:flex; align-items:center; justify-content:space-between; padding:0 28px; font-size:20px; cursor:pointer; text-align:left; }
        .portal-action-row span { display:flex; align-items:center; gap:16px; }
        .portal-action-row:last-child { border-bottom:0; }
        .portal-action-row--notice { color:#ff4b14; cursor:default; justify-content:flex-start; }
        .portal-grid { display:grid; grid-template-columns:1fr 1fr; gap:36px; align-items:start; }
        .portal-panel { background:#fff; border:1px solid #d9dde3; border-radius:5px; overflow:hidden; margin-bottom:28px; }
        .portal-panel h2 { margin:0; padding:14px 26px; font-size:30px; line-height:1.25; color:#0b1118; border-bottom:1px solid #d9dde3; }
        .portal-panel-body { padding:18px 26px; font-size:22px; line-height:1.32; min-height:54px; }
        .portal-registration-rows { padding:0; }
        .portal-registration-rows > div { padding:14px 26px; border-bottom:1px solid #d9dde3; }
        .portal-registration-rows > div:last-child { border-bottom:0; }
        .portal-muted-band { background:#d7dbe0; color:#8290a0; }
        .portal-round-line { display:flex; justify-content:space-between; gap:16px; }
        .portal-team-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin-top:14px; font-size:14px; }
        .portal-team-grid div { border:1px solid #d9dde3; border-radius:4px; padding:8px; background:#fff; }
        .portal-team-grid div.active { border-color:#673ab7; background:#f5f0ff; }
        .portal-link-button { border:0; background:#673ab7; color:white; border-radius:4px; padding:9px 14px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-size:14px; margin-top:14px; }
        .portal-input { width:100%; border:1px solid #cbd5e1; border-radius:4px; padding:10px 12px; font-size:16px; font-family:inherit; box-sizing:border-box; }
        .portal-card { background:white; border:1px solid #d9dde3; border-radius:5px; padding:20px; margin-bottom:16px; }
        .portal-card__heading { display:flex; align-items:center; gap:8px; color:#111827; font-weight:800; font-size:18px; }
        .portal-muted { color:#64748b; line-height:1.6; margin:12px 0 0; }
        .portal-button { border:0; background:#673ab7; color:white; border-radius:4px; padding:10px 14px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-size:13px; }
        .portal-search-row { display:flex; gap:10px; margin-top:2px; }
        .portal-search-row input { flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:13px 26px; font-size:20px; }
        .portal-search-row button { width:52px; border:1px solid #cbd5e1; background:#e5e9ee; border-radius:4px; color:#374151; }
        @media (max-width: 900px) {
          .portal-links { display:none; }
          .portal-grid { grid-template-columns:1fr; gap:16px; }
          .portal-title { font-size:30px; }
          .portal-warning, .portal-action-row, .portal-panel-body { font-size:16px; }
          .portal-panel h2 { font-size:24px; }
          .portal-team-grid { grid-template-columns:1fr 1fr; }
        }
      </style>
      ${renderPortalNav(tournament)}
      <main class="portal-page">
        <h1 class="portal-title">Private URL <span>for ${escapeHtml(personName)}${safeRole === 'team' ? ` (${escapeHtml(profile.name || 'Team')})` : ''}</span></h1>
        ${renderWarning(personName)}
        ${renderActionRows(safeRole, tournament, pairings)}
        <div class="portal-grid">
          <div>
            ${renderInThisRoundPanel(safeRole, profile, pairings, teamMap)}
            ${renderMotionsPanel(rounds || [])}
            ${renderFeedbackCard(safeRole, profile, pairings, blocked)}
          </div>
          <div>
            ${renderRegistrationPanel(safeRole, profile, personName)}
            ${renderBallotCard(safeRole, pairings)}
            ${renderCheckInCard(tournament)}
          </div>
        </div>
        <div class="portal-search-row">
          <input type="text" placeholder="Find in Table" aria-label="Find in Table">
          <button type="button">${icon('search', 22)}</button>
          <button type="button">${icon('clipboard', 22)}</button>
        </div>
      </main>
    </div>
  `;
}
