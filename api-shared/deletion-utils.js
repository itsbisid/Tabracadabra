const ADMIN_ROLES = new Set(['TAB_DIRECTOR', 'CONVENOR', 'DIRECTOR', 'DEPUTY_CONVENOR']);

function env(name) {
  return String(process.env[name] || '').trim();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || '').trim().toUpperCase());
}

function isMissingSchemaObject(body) {
  const message = String(body?.message || body?.error || '').toLowerCase();
  return message.includes('schema cache')
    || message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('unknown column');
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function collectBody(request, maxBytes = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        request.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function getConfig() {
  const supabaseUrl = env('VITE_SUPABASE_URL');
  const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase server configuration.');
  }
  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

function serviceHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  };
}

function tableUrl(config, table, query = '') {
  return `${config.supabaseUrl}/rest/v1/${table}${query}`;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value ?? ''));
}

function eqFilter(column, value) {
  return `${column}=eq.${encodeFilterValue(value)}`;
}

function inFilter(column, values) {
  const encodedValues = values.map(value => encodeFilterValue(value)).join(',');
  return `${column}=in.(${encodedValues})`;
}

async function parseJson(response) {
  return response.json().catch(() => null);
}

async function requestTable(table, query, options = {}) {
  const config = getConfig();
  const response = await fetch(tableUrl(config, table, query), {
    ...options,
    headers: {
      ...serviceHeaders(config),
      ...(options.headers || {})
    }
  });
  const body = await parseJson(response);
  if (!response.ok) {
    if (options.optional && isMissingSchemaObject(body)) return [];
    throw new Error(body?.message || body?.error || `Could not update ${table}.`);
  }
  return Array.isArray(body) ? body : [];
}

async function selectRows(table, filters = [], select = '*', optional = true) {
  const query = `?${[...filters, `select=${encodeURIComponent(select)}`].join('&')}`;
  return requestTable(table, query, { optional });
}

async function deleteRows(table, filters = [], optional = true) {
  const query = filters.length ? `?${filters.join('&')}` : '';
  return requestTable(table, query, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
    optional
  });
}

async function updateRows(table, filters = [], updates = {}, optional = true) {
  const query = filters.length ? `?${filters.join('&')}` : '';
  return requestTable(table, query, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(updates),
    optional
  });
}

async function deleteByIds(table, ids, optional = true) {
  if (!ids.length) return [];
  return deleteRows(table, [inFilter('id', ids)], optional);
}

export async function getSessionContext(request) {
  const config = getConfig();
  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const sessionResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!sessionResponse.ok) return null;
  return { token, user: await sessionResponse.json() };
}

export async function canAdministerTournament({ token, user }, tournamentId) {
  if (!tournamentId) return false;

  const config = getConfig();
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  const tournamentUrl = `${config.supabaseUrl}/rest/v1/tournaments?${eqFilter('id', tournamentId)}&select=owner_id`;
  const tournamentResponse = await fetch(tournamentUrl, { headers });
  const tournamentBody = await parseJson(tournamentResponse);
  const tournaments = tournamentResponse.ok ? tournamentBody : [];
  if (tournaments.some(tournament => tournament.owner_id === user.id)) return true;

  const membershipUrl = `${config.supabaseUrl}/rest/v1/tournament_memberships?${eqFilter('tournament_id', tournamentId)}&${eqFilter('user_id', user.id)}&select=role`;
  const membershipResponse = await fetch(membershipUrl, { headers });
  const membershipBody = await parseJson(membershipResponse);
  const memberships = membershipResponse.ok ? membershipBody : [];

  return memberships.some(membership => isAdminRole(membership.role));
}

export async function listOwnedTournaments(userId) {
  return selectRows('tournaments', [eqFilter('owner_id', userId)], 'id,name,short_name', false);
}

export async function deleteTournamentData(tournamentId) {
  const pairings = await selectRows('draw_pairings', [eqFilter('tournament_id', tournamentId)], 'id');
  const pairingIds = pairings.map(pairing => pairing.id).filter(Boolean);
  const deleted = {};

  const remember = async (key, action) => {
    const rows = await action();
    deleted[key] = rows.length;
  };

  await remember('adjudicator_allocations', () => {
    if (!pairingIds.length) return Promise.resolve([]);
    return deleteRows('adjudicator_allocations', [inFilter('pairing_id', pairingIds)]);
  });
  await remember('judge_feedback', async () => {
    const byTournament = await deleteRows('judge_feedback', [eqFilter('tournament_id', tournamentId)]);
    if (!pairingIds.length) return byTournament;
    const byPairing = await deleteRows('judge_feedback', [inFilter('pairing_id', pairingIds)]);
    return [...byTournament, ...byPairing];
  });
  await remember('portal_check_ins', () => deleteRows('portal_check_ins', [eqFilter('tournament_id', tournamentId)]));
  await remember('push_subscriptions', () => deleteRows('push_subscriptions', [eqFilter('tournament_id', tournamentId)]));
  await remember('ballots', () => deleteRows('ballots', [eqFilter('tournament_id', tournamentId)]));
  await remember('registration_submissions', () => deleteRows('registration_submissions', [eqFilter('tournament_id', tournamentId)]));
  await remember('registration_links', () => deleteRows('registration_links', [eqFilter('tournament_id', tournamentId)]));
  await remember('announcements', () => deleteRows('announcements', [eqFilter('tournament_id', tournamentId)]));
  await remember('venues', () => deleteRows('venues', [eqFilter('tournament_id', tournamentId)]));
  await remember('draw_pairings', () => deleteRows('draw_pairings', [eqFilter('tournament_id', tournamentId)]));
  await remember('rounds', () => deleteRows('rounds', [eqFilter('tournament_id', tournamentId)]));
  await remember('teams', () => deleteRows('teams', [eqFilter('tournament_id', tournamentId)]));
  await remember('adjudicators', () => deleteRows('adjudicators', [eqFilter('tournament_id', tournamentId)]));
  await remember('tournament_memberships', () => deleteRows('tournament_memberships', [eqFilter('tournament_id', tournamentId)]));
  await remember('tournaments', () => deleteRows('tournaments', [eqFilter('id', tournamentId)], false));

  return deleted;
}

function sameEmail(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

async function deleteMatchingRegistrationSubmissions(email, ownedTournamentIds) {
  const submissions = await selectRows('registration_submissions', [], 'id,tournament_id,data');
  const matchingIds = submissions
    .filter(submission => !ownedTournamentIds.has(String(submission.tournament_id)))
    .filter(submission => {
      const data = submission.data || {};
      return sameEmail(data.email, email)
        || sameEmail(data.speaker1_email, email)
        || sameEmail(data.speaker2_email, email);
    })
    .map(submission => submission.id)
    .filter(Boolean);

  return deleteByIds('registration_submissions', matchingIds);
}

async function anonymizeTeamRows(email, ownedTournamentIds) {
  const teams = await selectRows(
    'teams',
    [`or=(speaker1_email.eq.${encodeFilterValue(email)},speaker2_email.eq.${encodeFilterValue(email)})`],
    '*'
  );

  let count = 0;
  for (const team of teams) {
    if (ownedTournamentIds.has(String(team.tournament_id))) continue;

    const updates = {};
    if (sameEmail(team.speaker1_email, email)) {
      updates.speaker1_name = 'Deleted user';
      updates.speaker1_email = null;
    }
    if (sameEmail(team.speaker2_email, email)) {
      updates.speaker2_name = 'Deleted user';
      updates.speaker2_email = null;
    }

    if (Object.keys(updates).length) {
      await updateRows('teams', [eqFilter('id', team.id)], updates);
      count += 1;
    }
  }
  return count;
}

async function anonymizeAdjudicatorRows(email, ownedTournamentIds) {
  const adjudicators = await selectRows('adjudicators', [eqFilter('email', email)], '*');
  let count = 0;

  for (const adjudicator of adjudicators) {
    if (ownedTournamentIds.has(String(adjudicator.tournament_id))) continue;

    await updateRows('adjudicators', [eqFilter('id', adjudicator.id)], {
      name: 'Deleted user',
      email: null,
      institution: null
    });
    await deleteRows('portal_check_ins', [
      'participant_role=eq.judge',
      eqFilter('participant_id', adjudicator.id)
    ]);
    await deleteRows('push_subscriptions', [
      'participant_role=eq.judge',
      eqFilter('participant_id', adjudicator.id)
    ]);
    await deleteRows('judge_feedback', [eqFilter('submitted_by_id', adjudicator.id)]);
    count += 1;
  }

  return count;
}

async function deleteAuthUser(userId) {
  const config = getConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: serviceHeaders(config)
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || 'Could not delete the auth account.');
  }
}

export async function deleteAccountData(user) {
  const ownedTournaments = await listOwnedTournaments(user.id);
  const ownedTournamentIds = new Set(ownedTournaments.map(tournament => String(tournament.id)));
  const deletedTournaments = [];

  for (const tournament of ownedTournaments) {
    deletedTournaments.push({
      id: tournament.id,
      name: tournament.short_name || tournament.name || tournament.id,
      deleted: await deleteTournamentData(tournament.id)
    });
  }

  const [memberships, registrationSubmissions] = await Promise.all([
    deleteRows('tournament_memberships', [eqFilter('user_id', user.id)]),
    user.email ? deleteMatchingRegistrationSubmissions(user.email, ownedTournamentIds) : Promise.resolve([])
  ]);

  const participantCleanup = user.email
    ? {
        teamsAnonymized: await anonymizeTeamRows(user.email, ownedTournamentIds),
        adjudicatorsAnonymized: await anonymizeAdjudicatorRows(user.email, ownedTournamentIds)
      }
    : { teamsAnonymized: 0, adjudicatorsAnonymized: 0 };

  await deleteAuthUser(user.id);

  return {
    deletedTournaments,
    membershipsDeleted: memberships.length,
    registrationSubmissionsDeleted: registrationSubmissions.length,
    ...participantCleanup
  };
}
