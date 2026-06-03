import crypto from 'crypto';

function env(name) {
  return String(process.env[name] || '').trim();
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function collectBody(request, maxBytes = 1024 * 128) {
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
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server configuration.');
  }
  return { supabaseUrl, serviceRoleKey };
}

function headers(config) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

function tableUrl(config, table, query = '') {
  return `${config.supabaseUrl}/rest/v1/${table}${query}`;
}

export async function selectRows(table, query = '') {
  const config = getConfig();
  const response = await fetch(tableUrl(config, table, query), {
    headers: headers(config)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Could not load ${table}.`);
  }
  return Array.isArray(body) ? body : [];
}

export async function insertRows(table, rows, query = '') {
  const config = getConfig();
  const response = await fetch(tableUrl(config, table, query), {
    method: 'POST',
    headers: {
      ...headers(config),
      Prefer: 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Could not save ${table}.`);
  }
  return body;
}

export async function upsertRows(table, rows, conflictColumns) {
  const config = getConfig();
  const response = await fetch(tableUrl(config, table, `?on_conflict=${conflictColumns}`), {
    method: 'POST',
    headers: {
      ...headers(config),
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(rows)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Could not save ${table}.`);
  }
  return body;
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  const { serviceRoleKey } = getConfig();
  return crypto.createHmac('sha256', serviceRoleKey).update(payload).digest('base64url');
}

export function createPortalToken({ role, id, tournamentId }) {
  const payload = base64Url(JSON.stringify({
    role: role === 'judge' ? 'judge' : 'team',
    id,
    tournamentId,
    issuedAt: Date.now()
  }));
  return `${payload}.${signPayload(payload)}`;
}

export function verifyPortalToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('A valid portal token is required.');
  }

  const [payload, signature] = token.split('.');
  const expected = signPayload(payload);
  const provided = Buffer.from(signature || '');
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    throw new Error('Portal token validation failed.');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.id || !data.tournamentId || !['judge', 'team'].includes(data.role)) {
    throw new Error('Portal token payload is invalid.');
  }
  return data;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function fetchProfile(role, id) {
  const table = role === 'judge' ? 'adjudicators' : 'teams';
  const rows = await selectRows(table, `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function validateTokenProfile(tokenData) {
  const profile = await fetchProfile(tokenData.role, tokenData.id);
  if (!profile || String(profile.tournament_id) !== String(tokenData.tournamentId)) {
    throw new Error('This private portal token no longer matches an approved participant.');
  }
  return profile;
}

export async function fetchPairingBundle(pairingId) {
  const pairings = await selectRows('draw_pairings', `?id=eq.${encodeURIComponent(pairingId)}&select=*`);
  const pairing = pairings[0];
  if (!pairing) throw new Error('Pairing not found.');

  const [rounds, ballots, allocations] = await Promise.all([
    selectRows('rounds', `?id=eq.${encodeURIComponent(pairing.round_id)}&select=*`),
    selectRows('ballots', `?pairing_id=eq.${encodeURIComponent(pairing.id)}&select=*`),
    selectRows('adjudicator_allocations', `?pairing_id=eq.${encodeURIComponent(pairing.id)}&select=*`)
  ]);

  return { pairing, round: rounds[0] || null, ballots, allocations };
}

export function judgeRoleForPairing(pairing, allocations, judgeId) {
  if (pairing.chair_id === judgeId) return 'CHAIR';
  return allocations.find(allocation => allocation.adjudicator_id === judgeId)?.role || null;
}

export function teamIsInPairing(pairing, teamId) {
  return ['og_team_id', 'oo_team_id', 'cg_team_id', 'co_team_id'].some(key => pairing[key] === teamId);
}

export function feedbackTargetsForParticipant({ role, participantId, pairing, allocations }) {
  if (!pairing.chair_id) return [];

  if (role === 'team') {
    return [{ targetId: pairing.chair_id, targetRole: 'CHAIR', label: 'Chair adjudicator' }];
  }

  const judgeRole = judgeRoleForPairing(pairing, allocations, participantId);
  if (!judgeRole) return [];

  if (judgeRole === 'CHAIR') {
    return allocations
      .filter(allocation => ['WING', 'TRAINEE'].includes(allocation.role) && allocation.adjudicator_id !== participantId)
      .map(allocation => ({
        targetId: allocation.adjudicator_id,
        targetRole: allocation.role,
        label: allocation.role === 'TRAINEE' ? 'Trainee adjudicator' : 'Wing adjudicator'
      }));
  }

  return [{ targetId: pairing.chair_id, targetRole: 'CHAIR', label: 'Chair adjudicator' }];
}

export function assertCanAccessPairing({ tokenData, pairing, allocations }) {
  if (String(pairing.tournament_id) !== String(tokenData.tournamentId)) {
    throw new Error('This pairing belongs to another tournament.');
  }

  if (tokenData.role === 'judge') {
    const role = judgeRoleForPairing(pairing, allocations, tokenData.id);
    if (!role) throw new Error('This adjudicator is not assigned to that room.');
    return role;
  }

  if (!teamIsInPairing(pairing, tokenData.id)) {
    throw new Error('This team is not assigned to that room.');
  }
  return 'TEAM';
}
