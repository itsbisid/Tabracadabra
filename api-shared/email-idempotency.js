// Best-effort email idempotency backed by a Supabase table.
//
// claimIdempotencyKey attempts to atomically insert the key. It returns true
// when the key is newly claimed (caller should send) and false when the key was
// already claimed (caller should skip — a prior send handled it).
//
// It fails OPEN: if the service role or table is unavailable, it returns true so
// that a missing idempotency store never blocks a legitimate email.
//
// Requires a table:
//   create table if not exists public.sent_emails (
//     idempotency_key text primary key,
//     created_at timestamptz not null default now()
//   );

function env(name) {
  return String(process.env[name] || '').trim();
}

function getConfig() {
  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

export async function claimIdempotencyKey(key) {
  if (!key) return true;

  const config = getConfig();
  if (!config) return true; // No store configured — fail open.

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/sent_emails?on_conflict=idempotency_key`, {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify([{ idempotency_key: key }])
    });

    // Missing table or any server error — fail open so mail still goes out.
    if (!response.ok) return true;

    const body = await response.json().catch(() => null);
    // Non-empty array => our row was inserted (newly claimed).
    // Empty array => the key already existed (duplicate — skip sending).
    return Array.isArray(body) ? body.length > 0 : true;
  } catch {
    return true; // Network error — fail open.
  }
}
