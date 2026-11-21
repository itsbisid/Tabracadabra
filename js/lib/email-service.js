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
  if (!dashboardUrl) throw new Error('A personal portal URL is required for approval emails.');

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
      dashboardUrl,
      idempotencyKey
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Email could not be sent.');
  return data;
}

async function getTournamentName(tournamentId) {
  const { data } = await supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle();
  return data?.name || 'your tournament';
}

// Emails each participant their own private portal URL, one at a time.
// recipients: [{ email, name, role: 'speaker' | 'adjudicator', teamName?, dashboardUrl }]
// Returns { sent: [...], skipped: [...no email], failed: [{ recipient, error }] }.
export async function sendPrivateUrlsToAll({ tournamentId, recipients, onProgress }) {
  const tournamentName = await getTournamentName(tournamentId);
  const batchId = Date.now();
  const valid = recipients.filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email || '').trim()));
  const skipped = recipients.filter(r => !valid.includes(r));
  const sent = [];
  const failed = [];

  for (let i = 0; i < valid.length; i += 1) {
    const recipient = valid[i];
    onProgress?.(i + 1, valid.length);
    try {
      await sendRegistrationApprovedEmail({
        to: String(recipient.email).trim(),
        name: recipient.name,
        role: recipient.role,
        teamName: recipient.teamName,
        tournamentId,
        tournamentName,
        dashboardUrl: recipient.dashboardUrl,
        idempotencyKey: `portal-bulk:${tournamentId}:${batchId}:${recipient.role}:${recipient.dashboardUrl}`
      });
      sent.push(recipient);
    } catch (error) {
      failed.push({ recipient, error: error.message || 'Email could not be sent.' });
    }
  }

  return { sent, skipped, failed };
}

export function summarizeBulkSend({ sent, skipped, failed }) {
  const lines = [`Private URLs sent: ${sent.length}`];
  if (skipped.length) lines.push(`Skipped (no valid email): ${skipped.length}\n  ${skipped.map(r => r.name || 'Unnamed').join(', ')}`);
  if (failed.length) lines.push(`Failed: ${failed.length}\n  ${failed.map(f => `${f.recipient.name || f.recipient.email}: ${f.error}`).join('\n  ')}`);
  return lines.join('\n\n');
}
