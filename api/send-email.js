import { hasEmailTransportConfig, sendMailToEach } from './email-transport.js';

const MAX_RECIPIENTS = 5;
const ADMIN_ROLES = new Set(['TAB_DIRECTOR', 'CONVENOR']);

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 64) {
        request.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function normalizeRecipients(to) {
  const recipients = Array.isArray(to) ? to : [to];
  return recipients
    .map(email => String(email || '').trim())
    .filter(Boolean)
    .slice(0, MAX_RECIPIENTS);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildWelcomeEmail(payload) {
  const name = escapeHtml(payload.name || 'there');
  const dashboardUrl = escapeHtml(payload.dashboardUrl || '');

  return {
    subject: 'Welcome to TabraCadabra',
    text: [
      `Hi ${payload.name || 'there'},`,
      '',
      "Welcome to TabraCadabra — your home for managing and competing in debate tournaments.",
      '',
      dashboardUrl ? `Open your dashboard: ${payload.dashboardUrl}` : '',
      '',
      'See you in the tab room,',
      'TabraCadabra'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;line-height:1.6;">
        <div style="background:#0038A8;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">TabraCadabra</div>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;">Welcome, ${name}.</h1>
          <p style="color:#475569;margin:0 0 24px;">You're in. TabraCadabra is your home for managing and competing in debate tournaments — from registration through to results.</p>
          ${dashboardUrl ? `<a href="${dashboardUrl}" style="display:inline-block;background:#0038A8;color:white;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Open your dashboard</a>` : ''}
          <p style="color:#94a3b8;font-size:13px;margin-top:40px;">See you in the tab room,<br>TabraCadabra</p>
        </div>
      </div>
    `
  };
}

function buildAdjudicatorApprovedEmail(payload) {
  const name = escapeHtml(payload.name || 'there');
  const tournamentName = escapeHtml(payload.tournamentName || 'your tournament');
  const dashboardUrl = escapeHtml(payload.dashboardUrl || '');

  return {
    subject: `You're in — ${payload.tournamentName || 'your tournament'} | Adjudicator`,
    text: [
      `Hi ${payload.name || 'there'},`,
      '',
      `Your application to adjudicate at ${payload.tournamentName || 'your tournament'} has been approved.`,
      '',
      dashboardUrl ? `Open your judge portal: ${payload.dashboardUrl}` : '',
      '',
      'Use your portal to check draws, receive feedback assignments, and stay updated throughout the tournament.',
      '',
      'See you in the tab room,',
      'TabraCadabra'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;line-height:1.6;">
        <div style="background:#10b981;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">TabraCadabra</div>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 8px;">You're in.</h1>
          <p style="color:#475569;margin:0 0 24px;">Hi ${name}, your application to adjudicate at <strong>${tournamentName}</strong> has been approved.</p>
          ${dashboardUrl ? `<a href="${dashboardUrl}" style="display:inline-block;background:#10b981;color:white;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Open judge portal</a>` : ''}
          <p style="color:#64748b;font-size:14px;margin-top:24px;">Use your portal to check draws, receive feedback assignments, and stay updated throughout the tournament.</p>
          <p style="color:#94a3b8;font-size:13px;margin-top:40px;">See you in the tab room,<br>TabraCadabra</p>
        </div>
      </div>
    `
  };
}

function buildSpeakerApprovedEmail(payload) {
  const name = escapeHtml(payload.name || 'there');
  const teamName = escapeHtml(payload.teamName || 'your team');
  const tournamentName = escapeHtml(payload.tournamentName || 'your tournament');
  const dashboardUrl = escapeHtml(payload.dashboardUrl || '');

  return {
    subject: `You're in — ${payload.tournamentName || 'your tournament'} | ${payload.teamName || 'Team'}`,
    text: [
      `Hi ${payload.name || 'there'},`,
      '',
      `Your team ${payload.teamName || 'your team'} has been registered for ${payload.tournamentName || 'your tournament'}.`,
      '',
      dashboardUrl ? `Open your team portal: ${payload.dashboardUrl}` : '',
      '',
      'Use your portal to check draws, room allocations, and announcements as the tournament unfolds.',
      '',
      'See you across the floor,',
      'TabraCadabra'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;line-height:1.6;">
        <div style="background:#0038A8;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">TabraCadabra</div>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 8px;">You're in.</h1>
          <p style="color:#475569;margin:0 0 24px;">Hi ${name}, your team <strong>${teamName}</strong> has been registered for <strong>${tournamentName}</strong>.</p>
          ${dashboardUrl ? `<a href="${dashboardUrl}" style="display:inline-block;background:#0038A8;color:white;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Open team portal</a>` : ''}
          <p style="color:#64748b;font-size:14px;margin-top:24px;">Use your portal to check draws, room allocations, and announcements as the tournament unfolds.</p>
          <p style="color:#94a3b8;font-size:13px;margin-top:40px;">See you across the floor,<br>TabraCadabra</p>
        </div>
      </div>
    `
  };
}

function buildEmail(payload) {
  switch (payload.template) {
    case 'welcome': return buildWelcomeEmail(payload);
    case 'adjudicator-approved': return buildAdjudicatorApprovedEmail(payload);
    case 'speaker-approved': return buildSpeakerApprovedEmail(payload);
    default: throw new Error('Unsupported email template.');
  }
}

async function getSessionContext(request) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!token || !supabaseUrl || !supabaseAnonKey) return null;

  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!sessionResponse.ok) return null;

  return {
    token,
    user: await sessionResponse.json()
  };
}

async function canAdministerTournament({ token, user }, tournamentId) {
  if (!tournamentId) return false;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  const isMissingSchemaObject = (body) => {
    const message = String(body?.message || '').toLowerCase();
    return message.includes('schema cache') || message.includes('could not find');
  };

  const tournamentUrl = `${supabaseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(tournamentId)}&select=owner_id`;
  const tournamentResponse = await fetch(tournamentUrl, { headers });
  const tournamentBody = await tournamentResponse.json().catch(() => null);
  const tournaments = tournamentResponse.ok ? tournamentBody : [];
  if (tournaments.some(tournament => tournament.owner_id === user.id)) return true;

  const membershipUrl = `${supabaseUrl}/rest/v1/tournament_memberships?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role`;
  const membershipResponse = await fetch(membershipUrl, { headers });
  const membershipBody = await membershipResponse.json().catch(() => null);
  const memberships = membershipResponse.ok ? membershipBody : [];

  if (memberships.some(membership => ADMIN_ROLES.has(membership.role))) return true;

  if (isMissingSchemaObject(tournamentBody) && isMissingSchemaObject(membershipBody)) {
    const fallbackUrl = `${supabaseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(tournamentId)}&select=id`;
    const fallbackResponse = await fetch(fallbackUrl, { headers });
    const fallbackTournaments = fallbackResponse.ok ? await fallbackResponse.json() : [];
    return fallbackTournaments.some(tournament => tournament.id === tournamentId);
  }

  return false;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!hasEmailTransportConfig() || !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    sendJson(response, 500, { error: 'Missing SMTP email or auth environment variables.' });
    return;
  }

  const session = await getSessionContext(request);
  if (!session) {
    sendJson(response, 401, { error: 'You must be signed in to send email.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await collectBody(request));
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid JSON payload.' });
    return;
  }

  const recipients = normalizeRecipients(payload.to);
  if (recipients.length === 0 || recipients.some(email => !isValidEmail(email))) {
    sendJson(response, 400, { error: 'A valid recipient email is required.' });
    return;
  }

  if (payload.template !== 'welcome' && !(await canAdministerTournament(session, payload.tournamentId))) {
    sendJson(response, 403, { error: 'You do not have permission to send email for this tournament.' });
    return;
  }

  let email;
  try {
    email = buildEmail(payload);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  try {
    const results = await sendMailToEach({
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: payload.idempotencyKey || `tabracadabra-${Date.now()}`
    });
    sendJson(response, 200, {
      id: results.map(result => result.id).filter(Boolean).join(','),
      results
    });
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || 'SMTP failed to send the email.'
    });
  }
}
