const PUSH_TABLE = 'push_subscriptions';
const ADMIN_ROLES = new Set(['TAB_DIRECTOR', 'CONVENOR']);

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

function env(name) {
  return String(process.env[name] || '').trim();
}

export function getPushEnv() {
  return {
    publicKey: env('WEB_PUSH_PUBLIC_KEY') || env('VITE_WEB_PUSH_PUBLIC_KEY'),
    privateKey: env('WEB_PUSH_PRIVATE_KEY'),
    subject: env('WEB_PUSH_SUBJECT') || 'mailto:admin@tabracadabra.app',
    supabaseUrl: env('VITE_SUPABASE_URL'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export function assertPushConfigured() {
  const config = getPushEnv();
  if (!config.publicKey || !config.privateKey) {
    throw new Error('Missing WEB_PUSH_PUBLIC_KEY or WEB_PUSH_PRIVATE_KEY.');
  }
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return config;
}

function supabaseHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

function pushTableUrl(config, query = '') {
  return `${config.supabaseUrl}/rest/v1/${PUSH_TABLE}${query}`;
}

export async function upsertPushSubscription(record) {
  const config = assertPushConfigured();
  const response = await fetch(pushTableUrl(config, '?on_conflict=endpoint'), {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(record)
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || 'Could not save push subscription.');
  }
  return Array.isArray(body) ? body[0] : body;
}

export async function listPushSubscriptions(tournamentId) {
  const config = assertPushConfigured();
  const query = `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=*`;
  const response = await fetch(pushTableUrl(config, query), {
    headers: supabaseHeaders(config)
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || 'Could not load push subscriptions.');
  }
  return Array.isArray(body) ? body : [];
}

export async function deletePushSubscription(endpoint) {
  const config = assertPushConfigured();
  const response = await fetch(pushTableUrl(config, `?endpoint=eq.${encodeURIComponent(endpoint)}`), {
    method: 'DELETE',
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || 'Could not remove expired push subscription.');
  }
}

export async function getSessionContext(request) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = env('VITE_SUPABASE_URL');
  const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY');

  if (!token || !supabaseUrl || !supabaseAnonKey) return null;

  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!sessionResponse.ok) return null;
  return { token, user: await sessionResponse.json() };
}

export async function canAdministerTournament({ token, user }, tournamentId) {
  if (!tournamentId) return false;

  const supabaseUrl = env('VITE_SUPABASE_URL');
  const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY');
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  const tournamentUrl = `${supabaseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(tournamentId)}&select=owner_id`;
  const tournamentResponse = await fetch(tournamentUrl, { headers });
  const tournaments = tournamentResponse.ok ? await tournamentResponse.json() : [];
  if (tournaments.some(tournament => tournament.owner_id === user.id)) return true;

  const membershipUrl = `${supabaseUrl}/rest/v1/tournament_memberships?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role`;
  const membershipResponse = await fetch(membershipUrl, { headers });
  const memberships = membershipResponse.ok ? await membershipResponse.json() : [];

  return memberships.some(membership => ADMIN_ROLES.has(membership.role));
}
