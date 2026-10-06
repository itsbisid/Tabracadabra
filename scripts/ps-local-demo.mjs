// Local Public Speaking demo: one server on http://127.0.0.1:4173 that serves the built app,
// the real PS API, and a fake Supabase running the real PS SQL in an in-memory database.
// Everything is SYNTHETIC demo data and disappears when the window is closed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const ORIGIN = `http://127.0.0.1:${PORT}`;
process.env.VITE_SUPABASE_URL = ORIGIN;
process.env.VITE_SUPABASE_ANON_KEY = 'demo-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'demo-service-key';

const { createPSDatabase, callRpc } = await import('./tests/helpers/ps-db.js');
const { default: psHandler } = await import('./api/public-speaking.js');
const { createEvent, mutateEvent } = await import('./api-shared/ps-engine.js');
const { newToken, hashToken } = await import('./api-shared/ps-access.js');

const TOURNAMENT_ID = '4a16320d-5ccc-4e53-aaca-b9033af9371c';
const OWNER = { id: '11111111-1111-4111-8111-111111111111', email: 'demo-owner@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: 'Demo Organiser' } };
const { db } = await createPSDatabase({ tournamentId: TOURNAMENT_ID });
const tournaments = new Map([[TOURNAMENT_ID, { id: TOURNAMENT_ID, owner_id: OWNER.id, name: 'DEMO Tournament', short_name: 'DEMO', status: 'active', settings: { tracks: 'Debate + Public speaking' }, created_at: new Date().toISOString() }]]);

// ---- Seed a demo event: 12 speakers, 4 judges, Round 1 drawn and open, one ballot submitted.
const admin = { role: 'admin', id: OWNER.id };
let s = createEvent({ name: 'DEMO Prepared Speech', type: 'Prepared speech', rubric: [{ id: 'content', name: 'Content', max: 40, weight: 40 }, { id: 'delivery', name: 'Delivery', max: 35, weight: 35 }, { id: 'language', name: 'Language', max: 25, weight: 25 }], durationSeconds: 300, penalty: { method: 'overtime', pointsPerStep: 1, stepSeconds: 10, cap: 5 }, maxHeat: 6, minHeat: 4, panelSize: 2 });
s = mutateEvent(s, 'add-speakers', { people: Array.from({ length: 12 }, (_, i) => ({ name: `Demo Speaker ${i + 1}`, institution: `Demo School ${String.fromCharCode(65 + (i % 4))}`, category: i % 3 ? 'Open' : 'Novice' })) }, admin);
s = mutateEvent(s, 'add-judges', { people: Array.from({ length: 4 }, (_, i) => ({ name: `Demo Judge ${i + 1}`, institution: `Demo Judging Pool ${i + 1}` })) }, admin);
s = mutateEvent(s, 'create-round', { name: 'Round 1', speakerIds: s.speakers.map(p => p.id) }, admin);
const { proposeDraw } = await import('./api-shared/ps-draw.js');
const proposed = proposeDraw(s, s.rounds[0], { seed: 'demo-round-1', roomNames: ['Room 1', 'Room 2'] });
s = mutateEvent(s, 'save-draw', { roundId: s.rounds[0].id, rooms: proposed.rooms }, admin);
s = mutateEvent(s, 'open-round', { roundId: s.rounds[0].id, reason: 'Demo draw' }, admin);
const room = s.rounds[0].rooms[0];
s = mutateEvent(s, 'ballot', { roundId: s.rounds[0].id, roomId: room.id, status: 'submitted', rows: room.speakers.map((speakerId, i) => ({ speakerId, rank: i + 1, scores: [34 - i * 2, 30 - i * 2, 21 - i], elapsedSeconds: i === 2 ? 330 : 290, worked: 'Demo: clear opening and structure.', improve: 'Demo: slow down in the conclusion.', nextStep: 'Demo: practise with a timer.' })) }, { role: 'judge', id: room.judges[0] });
const eventId = randomUUID();
let version = 0;
for (const state of [s]) { const [row] = await callRpc(db, 'ps_v2_commit', { p_event_id: eventId, p_tournament_id: TOURNAMENT_ID, p_version: version, p_state: state, p_actor: `admin:${OWNER.id}`, p_action: 'demo-seed', p_reason: 'Synthetic demo data', p_request_key: null, p_payload_hash: '' }); version = row.version; }
const judgeLink = newToken('portal'), speakerLink = newToken('portal');
const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
await callRpc(db, 'ps_v2_issue_token', { p_event_id: eventId, p_entry_id: room.judges[1] || room.judges[0], p_hash: hashToken(judgeLink), p_purpose: 'portal', p_expires_at: in14, p_parent_hash: null, p_actor: 'system:demo', p_reason: 'Demo link' });
await callRpc(db, 'ps_v2_issue_token', { p_event_id: eventId, p_entry_id: room.speakers[0], p_hash: hashToken(speakerLink), p_purpose: 'portal', p_expires_at: in14, p_parent_hash: null, p_actor: 'system:demo', p_reason: 'Demo link' });

// ---- Server
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const DIST = path.join(ROOT, 'dist');
const session = { access_token: 'demo-token', refresh_token: 'demo-refresh', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, user: OWNER };
const loginPage = `<!doctype html><meta charset="utf-8"><title>Opening demo…</title><script>
localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});
localStorage.setItem('active_tournament_id', '${TOURNAMENT_ID}');
location.replace(new URLSearchParams(location.search).get('to') === 'new' ? '/#/create-tournament' : '/#/tournament/public-speaking');</script>`;

const startPage = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tabracadabra PS demo</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#0f2b5b;background:#f4f7fb}a{display:block;padding:16px 20px;margin:12px 0;border-radius:10px;background:#0f2b5b;color:#fff;text-decoration:none;font-weight:600}a span{display:block;font-weight:400;opacity:.8;font-size:14px;margin-top:4px}p{color:#526174}</style>
<h1>Public Speaking — local demo</h1><p>All names and scores are made-up demo data. Nothing is saved: closing the black window resets everything.</p>
<a href="/demo?to=new" target="_blank">Create a new tournament<span>Try the setup wizard: Debate only, Public speaking only, or both — each with its own settings.</span></a>
<a href="/demo" target="_blank">Organiser / tab view<span>Set up events, rooms, draws, approve ballots, results and links.</span></a>
<a href="/#/ps/portal/${judgeLink}" target="_blank">Judge portal (Room 1)<span>Score Room 1 on a phone-style ballot. Each link opens once per browser tab.</span></a>
<a href="/#/ps/portal/${speakerLink}" target="_blank">Speaker portal (Demo Speaker 1)<span>Room, speaking order, released results and feedback.</span></a>`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(body)); };
  try {
    if (req.method === 'OPTIONS') return json(204, {});
    if (url.pathname === '/api/public-speaking') return await psHandler(req, res);
    if (url.pathname === '/demo') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(loginPage); }
    if (url.pathname === '/start') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(startPage); }
    let body = ''; if (req.method !== 'GET') for await (const chunk of req) body += chunk;
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(ps_v2_[a-z_]+)$/);
    if (rpc) { const [result, status] = await callRpc(db, rpc[1], JSON.parse(body || '{}')); return json(status, result); }
    if (url.pathname === '/auth/v1/user') return json(200, OWNER);
    if (url.pathname.startsWith('/auth/v1/')) return json(200, {});
    if (url.pathname === '/rest/v1/tournaments') {
      const single = String(req.headers.accept || '').includes('vnd.pgrst.object');
      const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (req.method === 'POST') {
        const row = { id: randomUUID(), owner_id: OWNER.id, status: 'draft', created_at: new Date().toISOString(), ...JSON.parse(body || '{}') };
        tournaments.set(row.id, row);
        await db.query('insert into public.tournaments(id, name) values($1, $2)', [row.id, row.name || 'Demo']);
        return json(201, single ? row : [row]);
      }
      if (req.method === 'PATCH') { const row = tournaments.get(idFilter); if (row) Object.assign(row, JSON.parse(body || '{}')); return json(200, single ? row : [row].filter(Boolean)); }
      const rows = idFilter ? [tournaments.get(idFilter)].filter(Boolean) : [...tournaments.values()];
      return json(200, single ? rows[0] || null : rows);
    }
    if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/realtime/') || url.pathname.startsWith('/api/')) return json(200, []);
    const file = path.join(DIST, decodeURIComponent(url.pathname));
    const target = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(target)] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  } catch (error) { console.error(error); if (!res.headersSent) json(500, { error: 'Demo server error' }); }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  TABRACADABRA PUBLIC SPEAKING - LOCAL DEMO (synthetic data, nothing is saved)\n');
  console.log(`  Start page:       ${ORIGIN}/start`);
  console.log(`  Organiser view:   ${ORIGIN}/demo`);
  console.log(`  Judge portal:     ${ORIGIN}/#/ps/portal/${judgeLink}   (a Room 1 judge)`);
  console.log(`  Speaker portal:   ${ORIGIN}/#/ps/portal/${speakerLink}`);
  console.log('\n  Keep this window open while you use the demo. Close it to stop.\n');
  if (process.platform === 'win32' && !process.env.NO_BROWSER) exec(`start "" "${ORIGIN}/start"`);
});
