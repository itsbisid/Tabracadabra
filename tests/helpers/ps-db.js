// Spins up an in-memory Postgres (PGlite) with the PS migrations applied,
// mirroring the Supabase roles the migrations reference.
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const MIGRATIONS = ['supabase/public-speaking.sql', 'supabase/ps-v2.sql'];

export async function createPSDatabase({ tournamentId = '4a16320d-5ccc-4e53-aaca-b9033af9371c' } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.tournaments(id uuid primary key, name text not null default 'Synthetic test tournament');
  `);
  for (const file of MIGRATIONS) await db.exec(fs.readFileSync(file, 'utf8'));
  await db.query('insert into public.tournaments(id) values($1)', [tournamentId]);
  return { db, tournamentId };
}

export async function v2Commit(db, { eventId, tournamentId, version, state, actor = 'admin:test', action = 'test', reason = '', requestKey = null, payloadHash = '' }) {
  const { rows } = await db.query(
    'select public.ps_v2_commit($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9) as row',
    [eventId, tournamentId, version, JSON.stringify(state), actor, action, reason, requestKey, payloadHash]
  );
  return rows[0].row;
}

export async function v2Load(db, eventId) {
  const { rows } = await db.query('select public.ps_v2_load($1) as row', [eventId]);
  return rows[0].row;
}

// Emulates a PostgREST RPC call: returns [body, status].
export async function callRpc(db, name, args) {
  const keys = Object.keys(args);
  const params = keys.map((k, i) => `${k} => $${i + 1}${args[k] !== null && typeof args[k] === 'object' ? '::jsonb' : ''}`);
  const values = keys.map(k => args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]);
  try {
    const { rows } = await db.query(`select public.${name}(${params.join(', ')}) as result`, values);
    return [rows[0].result, 200];
  } catch (error) {
    return [{ code: error.code, message: error.message }, error.code === '40001' ? 409 : 400];
  }
}
