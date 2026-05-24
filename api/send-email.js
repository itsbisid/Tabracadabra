const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
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

function buildRegistrationApprovedEmail(payload) {
  const name = escapeHtml(payload.name || 'there');
  const tournamentName = escapeHtml(payload.tournamentName || 'your tournament');
  const role = escapeHtml(payload.role || 'participant');
  const dashboardUrl = escapeHtml(payload.dashboardUrl || '');

  return {
    subject: `Registration approved for ${tournamentName}`,
    text: [
      `Hi ${payload.name || 'there'},`,
      '',
      `Your registration as a ${payload.role || 'participant'} for ${payload.tournamentName || 'your tournament'} has been approved.`,
      dashboardUrl ? `Access your dashboard here: ${payload.dashboardUrl}` : '',
      '',
      'See you at the tournament,',
      'TabraCadabra'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif; color:#0f172a; line-height:1.6;">
        <h1 style="font-size:22px; margin:0 0 12px;">Registration approved</h1>
        <p>Hi ${name},</p>
        <p>Your registration as a <strong>${role}</strong> for <strong>${tournamentName}</strong> has been approved.</p>
        ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="color:#0044b3; font-weight:700;">Open your dashboard</a></p>` : ''}
        <p style="margin-top:24px;">See you at the tournament,<br>TabraCadabra</p>
      </div>
    `
  };
}

function buildEmail(payload) {
  if (payload.template === 'registration-approved') {
    return buildRegistrationApprovedEmail(payload);
  }

  throw new Error('Unsupported email template.');
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

  const tournamentUrl = `${supabaseUrl}/rest/v1/tournaments?id=eq.${encodeURIComponent(tournamentId)}&select=owner_id`;
  const tournamentResponse = await fetch(tournamentUrl, { headers });
  const tournaments = tournamentResponse.ok ? await tournamentResponse.json() : [];
  if (tournaments.some(tournament => tournament.owner_id === user.id)) return true;

  const membershipUrl = `${supabaseUrl}/rest/v1/tournament_memberships?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role`;
  const membershipResponse = await fetch(membershipUrl, { headers });
  const memberships = membershipResponse.ok ? await membershipResponse.json() : [];

  return memberships.some(membership => ADMIN_ROLES.has(membership.role));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey || !from || !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    sendJson(response, 500, { error: 'Missing email or auth environment variables.' });
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

  if (!(await canAdministerTournament(session, payload.tournamentId))) {
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

  const resendPayload = {
    from,
    to: recipients,
    subject: email.subject,
    html: email.html,
    text: email.text
  };

  if (replyTo) resendPayload.reply_to = replyTo;

  const resendResponse = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': payload.idempotencyKey || `tabracadabra-${Date.now()}`
    },
    body: JSON.stringify(resendPayload)
  });

  const data = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    sendJson(response, resendResponse.status, {
      error: data.message || data.error || 'Resend failed to send the email.'
    });
    return;
  }

  sendJson(response, 200, { id: data.id });
}
