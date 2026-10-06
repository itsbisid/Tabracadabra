import { supabase } from './supabase.js';

export async function psRequest(payload, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in to manage public speaking.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const response = await fetch('/api/public-speaking', { method: 'POST', headers, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({ error: 'Public speaking could not connect. Please try again.' }));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Request failed.'), { status: response.status });
  return body;
}
