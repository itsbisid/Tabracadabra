import { hasEmailTransportConfig, sendMail } from './email-transport.js';

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
      if (body.length > 1024 * 16) {
        request.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
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

function buildRegistrationSubmittedEmail(payload) {
  const name = escapeHtml(payload.name || 'there');
  const role = escapeHtml(payload.role || 'participant');
  const tournamentName = escapeHtml(payload.tournamentName || 'the tournament');

  return {
    subject: `Registration received — ${payload.tournamentName || 'the tournament'}`,
    text: [
      `Hi ${payload.name || 'there'},`,
      '',
      `We've received your registration as a ${payload.role || 'participant'} for ${payload.tournamentName || 'the tournament'}.`,
      '',
      "Your submission is currently under review. You'll receive another email once it's been approved, with a link to your tournament portal.",
      '',
      'TabraCadabra'
    ].join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;line-height:1.6;">
        <div style="background:#0038A8;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">TabraCadabra</div>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;">Registration received.</h1>
          <p style="color:#475569;margin:0 0 24px;">Hi ${name}, we've received your registration as a <strong>${role}</strong> for <strong>${tournamentName}</strong>.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Status</div>
            <div style="font-weight:700;color:#f59e0b;font-size:15px;">Under review</div>
          </div>
          <p style="color:#475569;margin:0;">You'll receive another email once your registration has been approved, with a link to your tournament portal.</p>
          <p style="color:#94a3b8;font-size:13px;margin-top:40px;">TabraCadabra</p>
        </div>
      </div>
    `
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!hasEmailTransportConfig()) {
    sendJson(response, 500, { error: 'Missing SMTP email environment variables.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await collectBody(request));
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid JSON payload.' });
    return;
  }

  const to = String(payload.to || '').trim();
  if (!to || !isValidEmail(to)) {
    sendJson(response, 400, { error: 'A valid recipient email is required.' });
    return;
  }

  const email = buildRegistrationSubmittedEmail(payload);

  try {
    const data = await sendMail({
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: payload.idempotencyKey || `tabracadabra-sub-${Date.now()}`
    });
    sendJson(response, 200, {
      id: data.id,
      accepted: data.accepted,
      rejected: data.rejected
    });
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || 'SMTP failed to send the email.'
    });
  }
}
