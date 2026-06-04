import { selectRows, sendJson } from './portal-utils.js';

const REQUIRED_TABLES = [
  'rounds',
  'draw_pairings',
  'adjudicator_allocations',
  'ballots',
  'judge_feedback',
  'portal_check_ins',
  'push_subscriptions'
];

function hasEnv(name) {
  return Boolean(String(process.env[name] || '').trim());
}

async function checkTable(table) {
  try {
    await selectRows(table, '?select=id&limit=1');
    return { table, ok: true };
  } catch (error) {
    return { table, ok: false, error: error.message };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const env = {
    supabaseUrl: hasEnv('VITE_SUPABASE_URL'),
    serviceRoleKey: hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
    pushPublicKey: hasEnv('WEB_PUSH_PUBLIC_KEY') || hasEnv('VITE_WEB_PUSH_PUBLIC_KEY'),
    pushPrivateKey: hasEnv('WEB_PUSH_PRIVATE_KEY')
  };

  const tables = await Promise.all(REQUIRED_TABLES.map(checkTable));
  const ok = Object.values(env).every(Boolean) && tables.every(table => table.ok);

  sendJson(response, ok ? 200 : 500, {
    ok,
    env,
    tables
  });
}
