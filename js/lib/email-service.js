import { supabase } from './supabase.js';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to send email.');
  return `Bearer ${session.access_token}`;
}

export async function sendWelcomeEmail({ name }) {
  let authorization;
  try {
    authorization = await getAuthHeader();
  } catch {
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({
      template: 'welcome',
      to: session.user.email,
      name,
      dashboardUrl: `${window.location.origin}/#/dashboard`
    })
  });
}

export async function sendRegistrationSubmittedEmail({ to, name, role, tournamentName, idempotencyKey }) {
  const response = await fetch('/api/send-submission-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, name, role, tournamentName, idempotencyKey })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Email could not be sent.');
  return data;
}

export async function sendRegistrationApprovedEmail({ to, name, role, teamName, tournamentId, tournamentName, dashboardUrl, idempotencyKey }) {
  const authorization = await getAuthHeader();
  const template = role === 'adjudicator' ? 'adjudicator-approved' : 'speaker-approved';

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({
      template,
      to,
      name,
      teamName,
      role,
      tournamentId,
      tournamentName,
      dashboardUrl: dashboardUrl || `${window.location.origin}/#/dashboard`,
      idempotencyKey
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Email could not be sent.');
  return data;
}
