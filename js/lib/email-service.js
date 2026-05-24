import { supabase } from './supabase.js';

export async function sendRegistrationApprovedEmail({ to, name, role, tournamentId, tournamentName, idempotencyKey }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to send email.');

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      template: 'registration-approved',
      to,
      name,
      role,
      tournamentId,
      tournamentName,
      dashboardUrl: `${window.location.origin}/#/dashboard`,
      idempotencyKey
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Email could not be sent.');
  }

  return data;
}
