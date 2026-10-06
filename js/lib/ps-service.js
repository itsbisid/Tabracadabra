import { supabase } from './supabase.js';

export async function psRequest(payload, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in to manage public speaking.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  // Every change carries a request key so a retry after a dropped connection is applied once.
  const READ_ONLY = ['read', 'list', 'public', 'audit', 'plan', 'preview-rules', 'propose-draw'];
  if (!READ_ONLY.includes(payload.action) && !payload.requestKey) payload = { ...payload, requestKey: crypto.randomUUID() };
  const send = () => fetch('/api/public-speaking', { method: 'POST', headers, body: JSON.stringify(payload) });
  let response;
  try { response = await send(); }
  catch {
    if (READ_ONLY.includes(payload.action)) throw new Error('Public speaking could not connect. Check your connection and try again.');
    await new Promise(r => setTimeout(r, 1500));
    try { response = await send(); }
    catch { throw Object.assign(new Error('Connection lost. Nothing has been confirmed as saved. Keep this page open and try again when you are back online.'), { status: 0 }); }
  }
  const body = await response.json().catch(() => ({ error: 'Public speaking could not connect. Please try again.' }));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Request failed.'), { status: response.status });
  return body;
}
