// Local test harness only: a fake Supabase that serves auth/REST stubs and runs the real
// PS SQL functions in PGlite. Never used in production. All data is synthetic.
// Usage: node scripts/ps-fake-supabase.mjs [port]
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createPSDatabase, callRpc } from '../tests/helpers/ps-db.js';

export const TOURNAMENT_ID = '4a16320d-5ccc-4e53-aaca-b9033af9371c';
export const OWNER = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic-owner@example.test', user_metadata: { full_name: 'Synthetic Owner' } };

export async function startFakeSupabase(port = 54321) {
  const { db } = await createPSDatabase({ tournamentId: TOURNAMENT_ID });
  const tournaments = new Map([[TOURNAMENT_ID, { id: TOURNAMENT_ID, owner_id: OWNER.id, name: 'Synthetic Test Tournament', status: 'active', settings: {} }]]);
  const server = http.createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, 'http://x');
    let body = ''; for await (const chunk of req) body += chunk;
    const send = (status, payload) => { res.writeHead(status, cors); res.end(JSON.stringify(payload)); };
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(ps_v2_[a-z_]+)$/);
    if (rpc) { const [result, status] = await callRpc(db, rpc[1], JSON.parse(body || '{}')); return send(status, result); }
    if (url.pathname === '/auth/v1/user') return send(200, OWNER);
    if (url.pathname === '/rest/v1/tournaments') {
      // Minimal PostgREST emulation for tournaments: insert, update and select by id.
      const single = String(req.headers.accept || '').includes('vnd.pgrst.object');
      const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (req.method === 'POST') {
        const row = { id: randomUUID(), owner_id: OWNER.id, status: 'draft', ...JSON.parse(body || '{}') };
        tournaments.set(row.id, row);
        await db.query('insert into public.tournaments(id, name) values($1, $2)', [row.id, row.name || 'Synthetic']);
        return send(201, single ? row : [row]);
      }
      if (req.method === 'PATCH') { const row = tournaments.get(idFilter); Object.assign(row, JSON.parse(body || '{}')); return send(200, single ? row : [row]); }
      const rows = idFilter ? [tournaments.get(idFilter)].filter(Boolean) : [...tournaments.values()];
      return send(200, single ? rows[0] || null : rows);
    }
    if (url.pathname.startsWith('/rest/v1/')) return send(200, []);
    return send(404, { message: 'Not found in fake Supabase' });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { server, db };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 54321);
  await startFakeSupabase(port);
  console.log(`Fake Supabase (synthetic data) on http://127.0.0.1:${port}`);
}
