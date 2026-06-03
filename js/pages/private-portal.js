import { icon } from '../components/icons.js';
import { showBallotModal } from '../components/ballot-modal.js';
import { supabase } from '../lib/supabase.js';
import { escapeHtml, escapeJsString } from '../lib/html.js';
import { getPortalPushStatus, subscribeToPortalPush } from '../lib/push-service.js';
import QRCode from 'qrcode';

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
  const select = '*, rounds!inner(*), ballots(*)';
  const byTeams = `og_team_id.eq.${id},oo_team_id.eq.${id},cg_team_id.eq.${id},co_team_id.eq.${id}`;
  let pairings = [];

  if (role === 'judge') {
    const [{ data: chairPairings }, { data: allocations }] = await Promise.all([
      supabase
        .from('draw_pairings')
        .select(select)
        .eq('tournament_id', tournamentId)
        .eq('chair_id', id),
      supabase
        .from('adjudicator_allocations')
        .select('pairing_id, role')
        .eq('adjudicator_id', id)
    ]);

    const allocationPairingIds = [...new Set((allocations || []).map(allocation => allocation.pairing_id).filter(Boolean))];
    let allocationPairings = [];
    if (allocationPairingIds.length > 0) {
      const { data } = await supabase
        .from('draw_pairings')
        .select(select)
        .eq('tournament_id', tournamentId)
        .in('id', allocationPairingIds);
      allocationPairings = data || [];
    }

    const map = new Map([...(chairPairings || []), ...allocationPairings].map(pairing => [pairing.id, pairing]));
    pairings = [...map.values()];
  } else {
    const { data } = await supabase
      .from('draw_pairings')
      .select(select)
      .eq('tournament_id', tournamentId)
      .or(byTeams);
    pairings = data || [];
  }

  return hydratePairings(pairings, id);
}

async function hydratePairings(pairings, viewerId) {
  const pairingIds = pairings.map(pairing => pairing.id).filter(Boolean);
  if (pairingIds.length === 0) return [];

  const [{ data: allocations }, { data: feedback }] = await Promise.all([
    supabase.from('adjudicator_allocations').select('*').in('pairing_id', pairingIds),
    supabase.from('judge_feedback').select('*').in('pairing_id', pairingIds).eq('submitted_by_id', viewerId)
  ]);

  const judgeIds = [
    ...pairings.map(pairing => pairing.chair_id),
    ...(allocations || []).map(allocation => allocation.adjudicator_id)
  ].filter(Boolean);
  const uniqueJudgeIds = [...new Set(judgeIds)];
  const { data: judges } = uniqueJudgeIds.length > 0
    ? await supabase.from('adjudicators').select('id,name,institution,is_trainee').in('id', uniqueJudgeIds)
    : { data: [] };

  const judgeMap = new Map((judges || []).map(judge => [judge.id, judge]));

  return pairings.map(pairing => ({
    ...pairing,
    adjudicator_allocations: (allocations || []).filter(allocation => allocation.pairing_id === pairing.id),
    submitted_feedback: (feedback || []).filter(item => item.pairing_id === pairing.id),
    judgeMap
  }));
}

async function fetchPortalSession({ role, id, tournamentId }) {
  try {
    const response = await fetch('/api/portal-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, id, tournamentId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not create portal token.');
    return data;
  } catch (error) {
    if (!isLocalhost()) throw error;
    const token = `local:${role}:${id}:${tournamentId}`;
    const { data } = await supabase
      .from('portal_check_ins')
      .select('checked_in_at')
      .eq('tournament_id', tournamentId)
      .eq('participant_role', role)
      .eq('participant_id', id)
      .maybeSingle();
    return {
      ok: true,
      token,
      checkIn: data ? { checkedIn: true, checkedInAt: data.checked_in_at } : { checkedIn: false }
    };
  }
}

async function postPortalAction(path, payload) {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Action could not be completed.');
    return data;
  } catch (error) {
    if (!isLocalhost() || !String(payload.token || '').startsWith('local:')) throw error;
    return postLocalPortalAction(path, payload);
  }
}

function isLocalhost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function parseLocalToken(token) {
  const [, role, id, tournamentId] = String(token || '').split(':');
  return { role, id, tournamentId };
}

async function postLocalPortalAction(path, payload) {
  const tokenData = parseLocalToken(payload.token);
  if (!tokenData.id || !tokenData.tournamentId) throw new Error('Local portal token is invalid.');

  if (path === '/api/portal-check-in') {
    const { error } = await supabase.from('portal_check_ins').upsert({
      tournament_id: tokenData.tournamentId,
      participant_role: tokenData.role,
      participant_id: tokenData.id,
      token_hash: payload.token,
      checked_in_at: new Date().toISOString(),
      user_agent: navigator.userAgent
    }, { onConflict: 'tournament_id,participant_role,participant_id' });
    if (error) throw error;
    return { ok: true };
  }

  if (path === '/api/portal-ballot') {
    const ballots = payload.ballots.map(row => ({
      tournament_id: tokenData.tournamentId,
      pairing_id: payload.pairingId,
      team_id: row.team_id,
      rank: row.rank,
      points: row.points,
      s1_points: row.s1_points,
      s2_points: row.s2_points,
      speaker_points: row.speaker_points,
      status: 'LOCKED',
      submitted_by_id: tokenData.id,
      submitted_at: new Date().toISOString()
    }));
    const { error } = await supabase.from('ballots').upsert(ballots, { onConflict: 'pairing_id,team_id' });
    if (error) throw error;
    return { ok: true };
  }

  if (path === '/api/portal-feedback') {
    const { error } = await supabase.from('judge_feedback').insert({
      tournament_id: tokenData.tournamentId,
      pairing_id: payload.pairingId,
      submitted_by_id: tokenData.id,
      submitted_role: tokenData.role === 'judge' ? 'JUDGE' : 'TEAM',
      target_judge_id: payload.targetId,
      score: payload.score,
      comments: payload.comments || null
    });
    if (error) throw error;
    return { ok: true };
  }

  throw new Error('Unsupported local portal action.');
}

function judgePositionForPairing(pairing, judgeId) {
  if (pairing.chair_id === judgeId) return 'Chair';
  const allocation = (pairing.adjudicator_allocations || []).find(item => item.adjudicator_id === judgeId);
  if (!allocation) return 'Panel';
  return allocation.role === 'TRAINEE' ? 'Trainee' : 'Wing';
}

function getJudgeName(pairing, judgeId) {
  return pairing.judgeMap?.get(judgeId)?.name || judgeId || 'TBD';
}

function getFeedbackTargetsForPairing(pairing, role, profile) {
  if (!pairing?.chair_id) return [];

  if (role === 'team') {
    return [{ id: pairing.chair_id, label: `Chair: ${getJudgeName(pairing, pairing.chair_id)}` }];
  }

  const position = judgePositionForPairing(pairing, profile.id);
  if (position === 'Chair') {
    return (pairing.adjudicator_allocations || [])
      .filter(allocation => ['WING', 'TRAINEE'].includes(allocation.role) && allocation.adjudicator_id !== profile.id)
      .map(allocation => ({
        id: allocation.adjudicator_id,
        label: `${allocation.role === 'TRAINEE' ? 'Trainee' : 'Wing'}: ${getJudgeName(pairing, allocation.adjudicator_id)}`
      }));
  }

  return [{ id: pairing.chair_id, label: `Chair: ${getJudgeName(pairing, pairing.chair_id)}` }];
}

function getLatestCompletedPairing(pairings) {
  return pairings
    .filter(pairing => Array.isArray(pairing.ballots) && pairing.ballots.length > 0)
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0))[0] || null;
}

function getFeedbackBlockInfo(pairings, role, profile, tournament) {
  if (tournament?.bypass_feedback_lock) return { blocked: false, pairing: null, missingTargets: [] };

  const pairing = getLatestCompletedPairing(pairings);
  if (!pairing) return { blocked: false, pairing: null, missingTargets: [] };

  const submittedTargetIds = new Set((pairing.submitted_feedback || []).map(item => item.target_judge_id));
  const missingTargets = getFeedbackTargetsForPairing(pairing, role, profile)
    .filter(target => !submittedTargetIds.has(target.id));

  return { blocked: missingTargets.length > 0, pairing, missingTargets };
}

function getPrepCountdown(round) {
  if (!round?.motion_released_at || !round?.prep_time_override) return '';
  const releaseTime = new Date(round.motion_released_at).getTime();
  const endTime = releaseTime + Number(round.prep_time_override) * 60 * 1000;
  const remaining = endTime - Date.now();

  if (Number.isNaN(endTime)) return '';
  if (remaining <= 0) return 'Prep time over';

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')} prep remaining`;
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

function renderBallotCard(role, profile, pairings, blockInfo) {
  if (role !== 'judge') {
    return `
      <section class="portal-card">
        <div class="portal-card__heading">${icon('clipboardCheck', 18)} Ballots</div>
        <p class="portal-muted">Ballot forms only appear for adjudicators assigned to submit them.</p>
      </section>
    `;
  }

  const openBallots = blockInfo?.blocked ? [] : pairings.filter(pairing => {
    const isReleased = pairing.rounds?.status === 'Released';
    const hasBallot = Array.isArray(pairing.ballots) && pairing.ballots.length > 0;
    return isReleased && !hasBallot && judgePositionForPairing(pairing, profile.id) === 'Chair';
  });

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('clipboardCheck', 18)} Ballots</div>
      ${openBallots.length === 0 ? `
        <p class="portal-muted">No ballot is currently open for this adjudicator link.</p>
      ` : openBallots.map(pairing => `
        <div class="portal-inline-task">
          <div>
            <strong>${escapeHtml(pairing.rounds?.name || 'Round')} · ${escapeHtml(pairing.room_label || 'Room')}</strong>
            <span>Submit the official ballot for this room.</span>
          </div>
          <button class="portal-button" type="button" data-portal-action="ballot" data-pairing-id="${escapeHtml(pairing.id)}">${icon('fileText', 16)} Open ballot</button>
        </div>
      `).join('')}
    </section>
  `;
}

function renderFeedbackCard(role, profile, blockInfo) {
  const latest = blockInfo.pairing || null;
  const targets = latest ? getFeedbackTargetsForPairing(latest, role, profile) : [];
  const submittedTargetIds = new Set((latest?.submitted_feedback || []).map(item => item.target_judge_id));
  const missingTargets = targets.filter(target => !submittedTargetIds.has(target.id));

  return `
    <section id="portal-feedback-card" class="portal-card">
      <div class="portal-card__heading">${icon('messageSquare', 18)} Feedback</div>
      ${!latest ? `
        <p class="portal-muted">Feedback forms will appear here after a completed round.</p>
      ` : missingTargets.length === 0 ? `
        <p class="portal-muted">Feedback is complete for your latest finished room.</p>
      ` : `
        <p class="portal-muted">${blockInfo.blocked ? 'Feedback is required before your next released draw is unlocked.' : 'You can submit feedback for your latest completed round.'}</p>
        ${missingTargets.map(target => `
          <form onsubmit="window.tcPortalSubmitFeedback(event)" class="portal-form portal-feedback-form">
            <input type="hidden" name="pairing_id" value="${escapeHtml(latest.id)}">
            <input type="hidden" name="target_id" value="${escapeHtml(target.id)}">
            <div class="portal-feedback-target">${escapeHtml(target.label)}</div>
            <label>Score<input class="portal-input" name="score" type="number" min="1" max="10" required placeholder="1-10"></label>
            <label>Comments<textarea class="portal-input" name="comments" rows="4" placeholder="Optional context for tab/adjudication core"></textarea></label>
            <button class="portal-button" type="submit">${icon('send', 16)} Submit feedback</button>
          </form>
        `).join('')}
      `}
    </section>
  `;
}

function renderCheckInCard(tournament, checkInStatus) {
  const settings = tournament?.settings || {};
  const enabled = Boolean(settings.online_check_in || settings.onlineCheckIn || settings.check_in_enabled);
  const checkedIn = Boolean(checkInStatus?.checkedIn);

  return `
    <section class="portal-card">
      <div class="portal-card__heading">${icon('checkSquare', 18)} Check-in</div>
      ${enabled ? `
        <p class="portal-muted">${checkedIn ? `Checked in at ${escapeHtml(new Date(checkInStatus.checkedInAt).toLocaleString())}.` : 'Online check-in is enabled for this tournament.'}</p>
        <button class="portal-button" type="button" data-portal-action="check-in">${icon(checkedIn ? 'checkCircle' : 'check', 16)} ${checkedIn ? 'Refresh check-in' : 'Check in now'}</button>
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

function getPortalUrl() {
  return window.location.href;
}

function renderPortalNav(tournament) {
  return `
    <nav class="portal-nav">
      <div class="portal-brand">
        <div class="portal-brand-mark">${icon('logo', 20)}</div>
        <div>
          <strong>${escapeHtml(getTournamentName(tournament))}</strong>
          <span>Private portal</span>
        </div>
      </div>
      <div class="portal-links">
        <button type="button" data-portal-action="scroll" data-target="portal-round">Round</button>
        <button type="button" data-portal-action="scroll" data-target="portal-motions">Motions</button>
        <button type="button" data-portal-action="scroll" data-target="portal-feedback-card">Feedback</button>
        <button type="button" data-portal-action="scroll" data-target="portal-registration">Registration</button>
      </div>
      <button class="portal-copy-link" type="button" data-portal-action="copy-url">${icon('copy', 16)} Copy URL</button>
    </nav>
  `;
}

function renderWarning(personName) {
  return `
    <div class="portal-warning">
      ${icon('alertCircle', 20)}
      <div>
        This link is personalized for <strong>${escapeHtml(personName)}</strong>. Keep it private because anyone with this URL can submit actions for this participant.
      </div>
    </div>
  `;
}

function renderHero(role, profile, personName, tournament, pairings, blockInfo) {
  const tournamentName = getTournamentName(tournament);
  const releasedPairing = blockInfo?.blocked ? null : pairings
    .filter(pairing => pairing.rounds?.status === 'Released')
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0))[0];
  const assignment = releasedPairing
    ? `${releasedPairing.rounds?.name || 'Round'} · ${releasedPairing.room_label || 'Venue TBD'}`
    : (blockInfo?.blocked ? 'Locked until feedback is submitted' : 'No active assignment');
  const roleText = role === 'judge'
    ? `Adjudicator${profile.is_trainee ? ' / Trainee' : ''}`
    : profile.name || 'Team';
  const institution = profile.institution || (role === 'judge' ? 'Independent' : 'Unaffiliated');

  return `
    <section class="portal-hero">
      <div class="portal-hero-main">
        <div class="portal-kicker">${escapeHtml(tournamentName)} · ${escapeHtml(getRoleLabel(role))}</div>
        <h1>${escapeHtml(personName)}</h1>
        <div class="portal-hero-meta">
          <span>${icon(role === 'judge' ? 'gavel' : 'users', 16)} ${escapeHtml(roleText)}</span>
          <span>${icon('building', 16)} ${escapeHtml(institution)}</span>
          <span>${icon('mapPin', 16)} ${escapeHtml(assignment)}</span>
        </div>
      </div>
      <div class="portal-hero-aside">
        <div class="portal-url-label">Personal URL</div>
        <div class="portal-url-text">${escapeHtml(getPortalUrl())}</div>
        <button type="button" data-portal-action="copy-url">${icon('copy', 16)} Copy private link</button>
      </div>
    </section>
  `;
}

function getOpenBallots(role, pairings) {
  if (role !== 'judge') return [];

  return pairings.filter(pairing => {
    const isReleased = pairing.rounds?.status === 'Released';
    const hasBallot = Array.isArray(pairing.ballots) && pairing.ballots.length > 0;
    return isReleased && !hasBallot && judgePositionForPairing(pairing, id) === 'Chair';
  });
}

function getNotificationCopy(status = {}) {
  if (status.state === 'subscribed') {
    return {
      className: 'is-success',
      iconName: 'checkCircle',
      title: 'Notifications on',
      body: 'This private portal is subscribed for tournament updates.'
    };
  }

  if (status.state === 'denied') {
    return {
      className: 'is-disabled',
      iconName: 'bell',
      title: 'Notifications blocked',
      body: 'Browser permission is blocked. Enable it in site settings to receive alerts.'
    };
  }

  if (status.state === 'unsupported') {
    return {
      className: 'is-disabled',
      iconName: 'bell',
      title: 'Notifications unavailable',
      body: 'This browser does not support push notifications.'
    };
  }

  if (status.state === 'local_only') {
    return {
      className: 'is-warning',
      iconName: 'bell',
      title: 'Resync notifications',
      body: 'Your browser has a subscription, but the tournament record needs to be saved again.'
    };
  }

  if (status.state === 'unknown') {
    return {
      className: '',
      iconName: 'bell',
      title: 'Notifications',
      body: 'Tap to verify or enable tournament alerts for this portal.'
    };
  }

  return {
    className: '',
    iconName: 'bell',
    title: 'Notifications',
    body: 'Get browser alerts when updates are available.'
  };
}

function renderActionRows(role, id, tournament, pairings, notificationStatus, checkInStatus, blockInfo) {
  const onlineCheckIn = Boolean(tournament?.settings?.online_check_in || tournament?.settings?.onlineCheckIn || tournament?.settings?.check_in_enabled);
  const openBallots = blockInfo?.blocked ? [] : getOpenBallots(role, pairings);
  const checkedIn = Boolean(checkInStatus?.checkedIn);
  const notification = getNotificationCopy(notificationStatus);
  const notificationDisabled = ['denied', 'unsupported'].includes(notificationStatus?.state);

  return `
    <section class="portal-actions" aria-label="Portal actions">
      <button class="portal-action-card ${notification.className}" type="button" ${notificationDisabled ? 'disabled' : 'data-portal-action="notifications"'}>
        <span class="portal-action-icon">${icon(notification.iconName, 20)}</span>
        <strong>${notification.title}</strong>
        <small>${notification.body}</small>
      </button>
      <button class="portal-action-card ${onlineCheckIn ? '' : 'is-disabled'} ${checkedIn ? 'is-success' : ''}" type="button" ${onlineCheckIn ? 'data-portal-action="check-in"' : 'disabled'}>
        <span class="portal-action-icon">${icon(checkedIn ? 'checkCircle' : 'checkSquare', 20)}</span>
        <strong>${checkedIn ? 'Checked in' : 'Check in'}</strong>
        <small>${onlineCheckIn ? (checkedIn ? 'Your check-in is stored in tournament records.' : 'Mark yourself as present for the current round.') : 'Online check-in is not enabled yet.'}</small>
      </button>
      <button class="portal-action-card" type="button" data-portal-action="barcode">
        <span class="portal-action-icon">${icon('dashboard', 20)}</span>
        <strong>Barcode</strong>
        <small>Show this at check-in or copy the private URL.</small>
      </button>
      <button class="portal-action-card" type="button" data-portal-action="scroll" data-target="portal-feedback-card">
        <span class="portal-action-icon">${icon('pen', 20)}</span>
        <strong>${blockInfo?.blocked ? 'Feedback required' : 'Feedback'}</strong>
        <small>${blockInfo?.blocked ? 'Submit required feedback to unlock next-round access.' : 'Jump to the available feedback form.'}</small>
      </button>
      ${openBallots.map(pairing => `
        <button class="portal-action-card portal-action-card--primary" type="button" data-portal-action="ballot" data-pairing-id="${escapeHtml(pairing.id)}">
          <span class="portal-action-icon">${icon('clipboardCheck', 20)}</span>
          <strong>Submit ballot</strong>
          <small>${escapeHtml(pairing.rounds?.name || 'Round')} ${escapeHtml(pairing.room_label || '')}</small>
        </button>
      `).join('')}
    </section>
  `;
}

function renderInThisRoundPanel(role, profile, pairings, teamMap, blockInfo) {
  if (blockInfo?.blocked) {
    return `
      <section id="portal-round" class="portal-panel">
        <div class="portal-panel-head">
          <div>
            <span>Current assignment</span>
            <h2>Feedback required</h2>
          </div>
          <div class="portal-status-pill is-warning">Locked</div>
        </div>
        <div class="portal-panel-body">
          <p class="portal-empty">Submit the required feedback below before viewing your next released draw.</p>
        </div>
      </section>
    `;
  }

  const releasedPairing = pairings
    .filter(pairing => pairing.rounds?.status === 'Released')
    .sort((a, b) => (b.rounds?.round_num || 0) - (a.rounds?.round_num || 0))[0];

  if (!releasedPairing) {
    return `
      <section id="portal-round" class="portal-panel">
        <div class="portal-panel-head">
          <div>
            <span>Current assignment</span>
            <h2>In this round</h2>
          </div>
          <div class="portal-status-pill is-muted">Standby</div>
        </div>
        <div class="portal-panel-body">
          <p class="portal-empty">${role === 'judge' ? 'You are not assigned to a debate this round.' : 'You do not have a debate this round.'}</p>
        </div>
      </section>
    `;
  }

  const position = role === 'judge' ? judgePositionForPairing(releasedPairing, profile.id) : positionForTeam(releasedPairing, profile.id);
  const prepCountdown = getPrepCountdown(releasedPairing.rounds);
  const panel = [
    releasedPairing.chair_id ? { role: 'Chair', id: releasedPairing.chair_id } : null,
    ...(releasedPairing.adjudicator_allocations || []).map(allocation => ({
      role: allocation.role === 'TRAINEE' ? 'Trainee' : 'Wing',
      id: allocation.adjudicator_id
    }))
  ].filter(Boolean);

  return `
    <section id="portal-round" class="portal-panel">
      <div class="portal-panel-head">
        <div>
          <span>Current assignment</span>
          <h2>In this round</h2>
        </div>
        <div class="portal-status-pill">${escapeHtml(position)}</div>
      </div>
      <div class="portal-panel-body">
        <div class="portal-round-summary">
          <div>
            <span>Round</span>
            <strong>${escapeHtml(releasedPairing.rounds?.name || 'Round')}</strong>
          </div>
          <div>
            <span>Venue</span>
            <strong>${escapeHtml(releasedPairing.room_label || 'TBD')}</strong>
          </div>
          ${prepCountdown ? `
            <div>
              <span>Prep timer</span>
              <strong class="portal-prep-countdown" data-prep-end="${escapeHtml(String(new Date(releasedPairing.rounds.motion_released_at).getTime() + Number(releasedPairing.rounds.prep_time_override || 0) * 60000))}">${escapeHtml(prepCountdown)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="portal-team-grid">
          ${['OG', 'OO', 'CG', 'CO'].map(pos => {
            const teamId = releasedPairing[`${pos.toLowerCase()}_team_id`];
            const active = teamId === profile.id;
            return `<div class="${active ? 'active' : ''}"><strong>${pos}</strong><br>${teamName(teamMap, teamId)}</div>`;
          }).join('')}
        </div>
        ${panel.length > 0 ? `
          <div class="portal-panel-list">
            ${panel.map(member => `
              <div class="${member.id === profile.id ? 'active' : ''}">
                <span>${escapeHtml(member.role)}</span>
                <strong>${escapeHtml(getJudgeName(releasedPairing, member.id))}</strong>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${releasedPairing.jitsi_link ? `<a class="portal-link-button" href="${escapeHtml(releasedPairing.jitsi_link)}" target="_blank" rel="noopener">${icon('mic', 16)} Join room</a>` : ''}
      </div>
    </section>
  `;
}

function renderRegistrationPanel(role, profile, personName) {
  if (role === 'judge') {
    return `
      <section id="portal-registration" class="portal-panel">
        <div class="portal-panel-head">
          <div>
            <span>Profile</span>
            <h2>Registration</h2>
          </div>
          <div class="portal-status-pill is-success">Approved</div>
        </div>
        <div class="portal-panel-body portal-registration-rows">
          <div><span>Name</span><strong>${escapeHtml(profile.name || 'Not provided')}</strong></div>
          <div><span>Email</span><strong>${escapeHtml(profile.email || 'Not provided')}</strong></div>
          <div><span>Role</span><strong>Adjudicator${profile.is_trainee ? ' / Trainee' : ''}</strong></div>
          <div><span>Institution</span><strong>${escapeHtml(profile.institution || 'Independent')}</strong></div>
        </div>
      </section>
    `;
  }

  return `
    <section id="portal-registration" class="portal-panel">
      <div class="portal-panel-head">
        <div>
          <span>Profile</span>
          <h2>Registration</h2>
        </div>
        <div class="portal-status-pill is-success">Approved</div>
      </div>
      <div class="portal-panel-body portal-registration-rows">
        <div><span>Team name</span><strong>${escapeHtml(profile.name || 'Not provided')}</strong></div>
        ${profile.emoji ? `<div><span>Emoji</span><strong>${escapeHtml(profile.emoji)}</strong></div>` : ''}
        <div><span>Speakers</span><strong>${escapeHtml(getTeamSpeakers(profile))}</strong></div>
        <div>
          <span>Categories</span>
          <strong>${escapeHtml(getBreakCategory(profile))}</strong>
          <small>Speaker category: ${escapeHtml(getSpeakerCategory(profile, personName))}</small>
        </div>
        <div><span>Institution</span><strong>${escapeHtml(profile.institution || 'Unaffiliated')}</strong></div>
      </div>
    </section>
  `;
}

function renderMotionsPanel(rounds) {
  const releasedMotions = rounds
    .filter(round => round.motion_released_at && round.motion_text)
    .sort((a, b) => (b.round_num || 0) - (a.round_num || 0));

  return `
    <section id="portal-motions" class="portal-panel">
      <div class="portal-panel-head">
        <div>
          <span>Released content</span>
          <h2>Motions</h2>
        </div>
      </div>
      <div class="portal-panel-body">
        ${releasedMotions.length === 0 ? `
          <p class="portal-empty">No motions have been released yet.</p>
        ` : releasedMotions.map(round => `
          <div class="portal-motion-item">
            <span>Round ${escapeHtml(round.round_num || '')}</span>
            <strong>${escapeHtml(round.motion_text)}</strong>
            ${round.motion_info ? `<p>${escapeHtml(round.motion_info)}</p>` : ''}
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
  const personName = getPersonalName(safeRole, profile);
  let portalSession;
  try {
    portalSession = await fetchPortalSession({ role: safeRole, id: profile.id, tournamentId });
  } catch (sessionError) {
    container.className = '';
    container.innerHTML = renderNotice('Private link unavailable', sessionError.message || 'This private portal could not be validated.');
    return;
  }
  const blockInfo = getFeedbackBlockInfo(pairings, safeRole, profile, tournament);
  const notificationStatus = await getPortalPushStatus({
    tournamentId,
    participantRole: safeRole,
    participantId: profile.id
  }).catch(error => ({ state: 'unknown', message: error.message, subscribed: false }));

  const enterBallot = (pairingId) => {
    const pairing = pairings.find(item => item.id === pairingId);
    if (pairing) {
      showBallotModal(pairing, () => renderPrivatePortal(container, safeRole, id), {
        onSubmit: (ballots) => postPortalAction('/api/portal-ballot', {
          token: portalSession.token,
          pairingId,
          ballots
        })
      });
    }
  };

  const showToast = (message) => {
    const existing = document.getElementById('portal-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'portal-toast';
    toast.textContent = message;
    toast.className = 'portal-toast';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  };

  const scrollToPortal = (targetId) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(getPortalUrl()).then(
      () => showToast('Private URL copied.'),
      () => alert(getPortalUrl())
    );
  };

  const requestNotifications = async () => {
    try {
      const result = await subscribeToPortalPush({
        tournamentId,
        participantRole: safeRole,
        participantId: profile.id,
        participantName: personName,
        portalUrl: getPortalUrl()
      });
      showToast(result.ok ? 'Push notifications enabled.' : 'Push subscription saved.');
      renderPrivatePortal(container, safeRole, id);
    } catch (error) {
      alert(error.message || 'Push notifications could not be enabled.');
    }
  };

  const checkIn = async () => {
    try {
      await postPortalAction('/api/portal-check-in', { token: portalSession.token });
      showToast('Check-in recorded in tournament data.');
      renderPrivatePortal(container, safeRole, id);
    } catch (error) {
      alert(error.message || 'Check-in could not be recorded.');
    }
  };

  const showBarcode = async () => {
    const modalRoot = document.getElementById('modal-root');
    const qrPayload = `${window.location.origin}/api/portal-check-in?token=${encodeURIComponent(portalSession.token)}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 256 });
    modalRoot.innerHTML = `
      <div class="portal-modal-backdrop">
        <div class="portal-modal">
          <div class="portal-modal-head">
            <div>
              <span>Private check-in code</span>
              <h3>${escapeHtml(personName)}</h3>
            </div>
            <button type="button" data-modal-close>${icon('x', 20)}</button>
          </div>
          <div class="portal-qr-wrap"><img src="${qrDataUrl}" alt="Check-in QR code"></div>
          <div class="portal-modal-url">${escapeHtml(qrPayload)}</div>
          <div class="portal-modal-actions">
            <button class="portal-button" type="button" data-modal-copy>${icon('copy', 16)} Copy token</button>
            <button class="portal-button is-secondary" type="button" data-modal-close>Done</button>
          </div>
        </div>
      </div>
    `;
    modalRoot.querySelectorAll('[data-modal-close]').forEach(button => {
      button.addEventListener('click', () => { modalRoot.innerHTML = ''; });
    });
    modalRoot.querySelector('[data-modal-copy]')?.addEventListener('click', () => {
      navigator.clipboard.writeText(qrPayload).then(() => showToast('Check-in token copied.'));
    });
  };

  const findInPage = (event) => {
    event.preventDefault();
    const query = new FormData(event.target).get('query');
    if (!query) return;
    window.find(String(query));
  };

  Object.assign(window, {
    tcPortalEnterBallot: enterBallot,
    tcPortalToast: showToast,
    tcPortalScrollTo: scrollToPortal,
    tcPortalCopyUrl: copyPortalUrl,
    tcPortalRequestNotifications: requestNotifications,
    tcPortalCheckIn: checkIn,
    tcPortalShowBarcode: showBarcode,
    tcPortalFindInPage: findInPage
  });

  window.tcPortalSubmitFeedback = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      await postPortalAction('/api/portal-feedback', {
        token: portalSession.token,
        pairingId: formData.get('pairing_id'),
        targetId: formData.get('target_id'),
        score: Number(formData.get('score')),
        comments: formData.get('comments')
      });
      showToast('Feedback submitted.');
      renderPrivatePortal(container, safeRole, id);
    } catch (error) {
      alert(error.message || 'Feedback could not be submitted.');
    }
  };

  container.className = '';
  container.innerHTML = `
    <div class="portal-shell">
      <style>
        .portal-shell { min-height:100vh; background:#f4f7fb; color:#172033; font-family:Inter, Arial, sans-serif; }
        .portal-nav { height:68px; display:flex; align-items:center; gap:22px; padding:0 28px; background:rgba(255,255,255,.92); border-bottom:1px solid #dbe3ee; position:sticky; top:0; z-index:20; backdrop-filter:blur(12px); }
        .portal-brand { display:flex; align-items:center; gap:10px; min-width:240px; color:#172033; }
        .portal-brand-mark { width:40px; height:40px; border-radius:8px; background:#0f2b5b; color:white; display:flex; align-items:center; justify-content:center; }
        .portal-brand strong { display:block; font-size:16px; line-height:1.1; }
        .portal-brand span { display:block; font-size:12px; color:#64748b; margin-top:2px; }
        .portal-links { display:flex; align-items:center; gap:6px; flex:1; overflow:auto; white-space:nowrap; }
        .portal-links button, .portal-copy-link { border:0; background:transparent; color:#526174; border-radius:8px; padding:9px 12px; font-weight:700; cursor:pointer; font-size:13px; }
        .portal-links button:hover, .portal-copy-link:hover { background:#eef4fb; color:#0f2b5b; }
        .portal-copy-link { display:flex; align-items:center; gap:8px; border:1px solid #cfdbe8; background:white; color:#0f2b5b; }
        .portal-page { max-width:1180px; margin:0 auto; padding:28px 24px 48px; }
        .portal-hero { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:18px; align-items:stretch; background:#0f2b5b; color:white; border-radius:8px; padding:28px; box-shadow:0 18px 36px rgba(15,43,91,.18); }
        .portal-kicker { color:#9fd5c8; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; }
        .portal-hero h1 { margin:0; font-size:36px; line-height:1.08; letter-spacing:0; }
        .portal-hero-meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
        .portal-hero-meta span { display:flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.08); border-radius:999px; padding:8px 10px; color:#e5edf7; font-size:13px; font-weight:700; }
        .portal-hero-aside { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.16); border-radius:8px; padding:18px; min-width:0; }
        .portal-url-label { color:#9fd5c8; font-size:11px; font-weight:900; text-transform:uppercase; margin-bottom:8px; }
        .portal-url-text { color:#e5edf7; font-size:13px; line-height:1.45; word-break:break-all; min-height:58px; }
        .portal-hero-aside button { margin-top:14px; border:0; border-radius:8px; background:#18a689; color:white; padding:10px 12px; display:flex; align-items:center; gap:8px; font-weight:800; cursor:pointer; }
        .portal-warning { display:flex; gap:12px; align-items:flex-start; color:#8a3b00; border:1px solid #f2c078; background:#fff8eb; border-radius:8px; padding:14px 16px; font-size:14px; line-height:1.5; margin:18px 0; }
        .portal-warning svg { flex:0 0 auto; margin-top:1px; }
        .portal-actions { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-bottom:18px; }
        .portal-action-card { min-height:126px; border:1px solid #dbe3ee; background:white; border-radius:8px; padding:16px; text-align:left; display:flex; flex-direction:column; gap:8px; cursor:pointer; box-shadow:0 8px 18px rgba(15,43,91,.06); transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
        .portal-action-card:hover { transform:translateY(-2px); box-shadow:0 14px 26px rgba(15,43,91,.1); border-color:#b8c8da; }
        .portal-action-card:disabled, .portal-action-card.is-disabled { cursor:not-allowed; opacity:.72; transform:none; box-shadow:none; }
        .portal-action-card--primary { background:#0f2b5b; color:white; border-color:#0f2b5b; }
        .portal-action-card.is-success { border-color:#a6dbc5; background:#f0fbf6; }
        .portal-action-card.is-warning { border-color:#f2c078; background:#fff8eb; }
        .portal-action-icon { width:36px; height:36px; border-radius:8px; background:#eef4fb; color:#0f2b5b; display:flex; align-items:center; justify-content:center; }
        .portal-action-card.is-success .portal-action-icon { background:#dff7ec; color:#047857; }
        .portal-action-card.is-warning .portal-action-icon { background:#ffe9bd; color:#8a3b00; }
        .portal-action-card--primary .portal-action-icon { background:rgba(255,255,255,.12); color:white; }
        .portal-action-card strong { color:#172033; font-size:15px; }
        .portal-action-card--primary strong { color:white; }
        .portal-action-card small { color:#64748b; line-height:1.45; font-size:12px; }
        .portal-action-card--primary small { color:#cbd8e8; }
        .portal-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr); gap:18px; align-items:start; }
        .portal-panel, .portal-card { background:white; border:1px solid #dbe3ee; border-radius:8px; overflow:hidden; margin-bottom:18px; box-shadow:0 8px 18px rgba(15,43,91,.05); scroll-margin-top:88px; }
        .portal-panel-head { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:18px 20px; border-bottom:1px solid #edf1f6; }
        .portal-panel-head span { display:block; color:#64748b; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.07em; margin-bottom:4px; }
        .portal-panel h2 { margin:0; color:#172033; font-size:22px; line-height:1.2; letter-spacing:0; }
        .portal-panel-body { padding:18px 20px; font-size:15px; line-height:1.55; }
        .portal-empty { margin:0; color:#64748b; font-style:normal; }
        .portal-status-pill { border-radius:999px; padding:7px 10px; background:#e8f7f1; color:#047857; font-size:12px; font-weight:900; white-space:nowrap; }
        .portal-status-pill.is-muted { background:#eef2f7; color:#64748b; }
        .portal-status-pill.is-success { background:#e8f7f1; color:#047857; }
        .portal-status-pill.is-warning { background:#fff8eb; color:#8a3b00; }
        .portal-round-summary { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
        .portal-round-summary div { border:1px solid #edf1f6; background:#f8fafc; border-radius:8px; padding:12px; }
        .portal-round-summary span { display:block; color:#64748b; font-size:11px; font-weight:900; text-transform:uppercase; margin-bottom:4px; }
        .portal-round-summary strong { font-size:16px; color:#172033; }
        .portal-team-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin-top:12px; font-size:13px; }
        .portal-team-grid div { border:1px solid #dbe3ee; border-radius:8px; padding:10px; background:#fff; min-height:54px; }
        .portal-team-grid div.active { border-color:#0f2b5b; background:#eef4fb; }
        .portal-panel-list { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; margin-top:12px; }
        .portal-panel-list div { border:1px solid #dbe3ee; border-radius:8px; padding:10px; background:#fff; }
        .portal-panel-list div.active { border-color:#18a689; background:#f0fbf6; }
        .portal-panel-list span { display:block; color:#64748b; font-size:11px; font-weight:900; text-transform:uppercase; margin-bottom:4px; }
        .portal-panel-list strong { color:#172033; font-size:13px; }
        .portal-prep-countdown { color:#8a3b00; }
        .portal-link-button, .portal-button { border:0; background:#0f2b5b; color:white; border-radius:8px; padding:10px 14px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; font-size:13px; }
        .portal-button:hover, .portal-link-button:hover { background:#12366f; }
        .portal-button.is-secondary { background:#eef2f7; color:#172033; }
        .portal-card { padding:18px; }
        .portal-card__heading { display:flex; align-items:center; gap:9px; color:#172033; font-weight:900; font-size:16px; }
        .portal-muted { color:#64748b; line-height:1.55; margin:10px 0 0; font-size:14px; }
        .portal-form { display:grid; gap:12px; margin-top:14px; }
        .portal-feedback-form { border-top:1px solid #edf1f6; padding-top:14px; }
        .portal-feedback-target { background:#f8fafc; border:1px solid #edf1f6; border-radius:8px; padding:10px 12px; color:#172033; font-weight:900; }
        .portal-form label { display:grid; gap:6px; color:#526174; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.04em; }
        .portal-input { width:100%; border:1px solid #cfdbe8; border-radius:8px; padding:11px 12px; font-size:14px; font-family:inherit; box-sizing:border-box; color:#172033; }
        .portal-input:focus { outline:2px solid rgba(24,166,137,.18); border-color:#18a689; }
        .portal-registration-rows { padding:0; }
        .portal-registration-rows > div { display:grid; grid-template-columns:120px minmax(0,1fr); gap:12px; padding:14px 20px; border-bottom:1px solid #edf1f6; align-items:start; }
        .portal-registration-rows > div:last-child { border-bottom:0; }
        .portal-registration-rows span { color:#64748b; font-size:12px; font-weight:900; text-transform:uppercase; }
        .portal-registration-rows strong { color:#172033; font-size:14px; word-break:break-word; }
        .portal-registration-rows small { display:block; color:#64748b; margin-top:3px; font-size:12px; }
        .portal-motion-item { border:1px solid #edf1f6; border-radius:8px; padding:14px; margin-bottom:10px; }
        .portal-motion-item span { color:#64748b; font-size:11px; font-weight:900; text-transform:uppercase; }
        .portal-motion-item strong { display:block; margin-top:6px; color:#172033; font-size:16px; }
        .portal-motion-item p { color:#64748b; margin:8px 0 0; }
        .portal-inline-task { display:flex; justify-content:space-between; gap:14px; align-items:center; border:1px solid #edf1f6; background:#f8fafc; border-radius:8px; padding:14px; margin-top:12px; }
        .portal-inline-task strong { display:block; color:#172033; }
        .portal-inline-task span { display:block; color:#64748b; font-size:13px; margin-top:3px; }
        .portal-search-row { display:flex; gap:10px; margin-top:6px; background:white; border:1px solid #dbe3ee; border-radius:8px; padding:10px; }
        .portal-search-row input { flex:1; min-width:0; border:0; background:#f8fafc; border-radius:8px; padding:12px 14px; font-size:14px; }
        .portal-search-row button { width:44px; border:0; background:#eef4fb; border-radius:8px; color:#0f2b5b; cursor:pointer; }
        .portal-toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); background:#172033; color:white; padding:12px 16px; border-radius:8px; box-shadow:0 12px 24px rgba(0,0,0,.18); z-index:10000; font-weight:800; font-size:13px; }
        .portal-modal-backdrop { position:fixed; inset:0; background:rgba(15,32,51,.48); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:24px; z-index:9999; }
        .portal-modal { width:min(520px, 100%); background:white; border-radius:8px; overflow:hidden; box-shadow:0 24px 54px rgba(15,32,51,.25); }
        .portal-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px; border-bottom:1px solid #edf1f6; }
        .portal-modal-head span { color:#64748b; font-size:11px; font-weight:900; text-transform:uppercase; }
        .portal-modal-head h3 { margin:3px 0 0; color:#172033; font-size:20px; }
        .portal-modal-head button { border:0; background:transparent; color:#64748b; cursor:pointer; }
        .portal-barcode { height:112px; margin:22px; border-radius:8px; border:1px solid #dbe3ee; background:repeating-linear-gradient(90deg,#172033 0 3px,#fff 3px 7px,#172033 7px 9px,#fff 9px 15px,#172033 15px 20px,#fff 20px 24px); }
        .portal-modal-url { margin:0 22px 18px; padding:12px; border-radius:8px; background:#f8fafc; color:#526174; font-size:13px; line-height:1.45; word-break:break-all; }
        .portal-modal-actions { display:flex; gap:10px; padding:0 22px 22px; }
        .portal-qr-wrap { display:flex; justify-content:center; padding:24px 24px 12px; }
        .portal-qr-wrap img { width:256px; height:256px; border:1px solid #dbe3ee; border-radius:8px; padding:10px; background:white; }
        @media (max-width: 900px) {
          .portal-nav { padding:0 16px; }
          .portal-brand { min-width:auto; }
          .portal-links { display:none; }
          .portal-page { padding:18px 14px 36px; }
          .portal-hero { grid-template-columns:1fr; padding:20px; }
          .portal-hero h1 { font-size:28px; }
          .portal-actions { grid-template-columns:1fr 1fr; }
          .portal-grid { grid-template-columns:1fr; gap:0; }
          .portal-team-grid { grid-template-columns:1fr 1fr; }
          .portal-registration-rows > div { grid-template-columns:1fr; gap:4px; }
          .portal-round-summary { grid-template-columns:1fr; }
          .portal-inline-task { align-items:stretch; flex-direction:column; }
        }
        @media (max-width: 560px) {
          .portal-actions { grid-template-columns:1fr; }
          .portal-copy-link { display:none; }
          .portal-hero-meta span { width:100%; }
          .portal-search-row { display:none; }
        }
      </style>
      ${renderPortalNav(tournament)}
      <main class="portal-page">
        ${renderHero(safeRole, profile, personName, tournament, pairings, blockInfo)}
        ${renderWarning(personName)}
        ${renderActionRows(safeRole, profile.id, tournament, pairings, notificationStatus, portalSession.checkIn, blockInfo)}
        <div class="portal-grid">
          <div>
            ${renderInThisRoundPanel(safeRole, profile, pairings, teamMap, blockInfo)}
            ${renderMotionsPanel(rounds || [])}
            ${renderFeedbackCard(safeRole, profile, blockInfo)}
          </div>
          <div>
            ${renderRegistrationPanel(safeRole, profile, personName)}
            ${renderBallotCard(safeRole, profile, pairings, blockInfo)}
            ${renderCheckInCard(tournament, portalSession.checkIn)}
          </div>
        </div>
        <form class="portal-search-row" id="portal-find-form">
          <input name="query" type="text" placeholder="Find on this page" aria-label="Find on this page">
          <button type="submit" title="Find">${icon('search', 20)}</button>
          <button type="button" title="Copy private URL" data-portal-action="copy-url">${icon('clipboard', 20)}</button>
        </form>
      </main>
    </div>
  `;

  container.querySelector('.portal-shell')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-portal-action]');
    if (!button) return;

    const action = button.dataset.portalAction;
    if (action === 'scroll') scrollToPortal(button.dataset.target);
    if (action === 'copy-url') copyPortalUrl();
    if (action === 'notifications') requestNotifications();
    if (action === 'check-in') checkIn();
    if (action === 'barcode') showBarcode();
    if (action === 'ballot') enterBallot(button.dataset.pairingId);
  });

  document.getElementById('portal-find-form')?.addEventListener('submit', findInPage);

  const updatePrepCountdowns = () => {
    document.querySelectorAll('[data-prep-end]').forEach(element => {
      const endTime = Number(element.dataset.prepEnd);
      const remaining = endTime - Date.now();
      if (!endTime || Number.isNaN(endTime)) return;
      if (remaining <= 0) {
        element.textContent = 'Prep time over';
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      element.textContent = `${minutes}:${String(seconds).padStart(2, '0')} prep remaining`;
    });
  };
  updatePrepCountdowns();
  clearInterval(window.tcPortalPrepTimer);
  window.tcPortalPrepTimer = setInterval(updatePrepCountdowns, 1000);
}
