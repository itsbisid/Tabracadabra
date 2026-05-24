import nodemailer from 'nodemailer';

const RETRY_DELAYS_MS = [600, 1500];

function env(name) {
  return String(process.env[name] || '').trim();
}

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 465;
}

function parseSecure(value, port) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return port === 465;
}

export function hasEmailTransportConfig() {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && env('SMTP_FROM'));
}

function normalizeRecipients(to) {
  return (Array.isArray(to) ? to : [to])
    .map(email => String(email || '').trim())
    .filter(Boolean);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(error) {
  const code = String(error?.code || '');
  const responseCode = Number(error?.responseCode || 0);
  return code === 'ETIMEDOUT'
    || code === 'ECONNECTION'
    || code === 'ESOCKET'
    || responseCode === 421
    || responseCode === 450
    || responseCode === 451
    || responseCode === 452;
}

async function sendWithRetry(transporter, message) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await transporter.sendMail(message);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === RETRY_DELAYS_MS.length) break;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export async function sendMail({ to, subject, html, text, idempotencyKey }) {
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const from = env('SMTP_FROM');
  const replyTo = env('SMTP_REPLY_TO');
  const port = parsePort(env('SMTP_PORT'));
  const secure = parseSecure(env('SMTP_SECURE'), port);

  if (!host || !user || !pass || !from) {
    throw new Error('Missing SMTP email environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) throw new Error('A valid recipient email is required.');

  const info = await sendWithRetry(transporter, {
    from,
    to: recipients,
    sender: user,
    subject,
    html,
    text,
    envelope: {
      from: user,
      to: recipients
    },
    replyTo: replyTo || undefined,
    headers: idempotencyKey ? { 'X-TabraCadabra-Idempotency-Key': idempotencyKey } : undefined
  });

  return {
    id: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || []
  };
}

export async function sendMailToEach({ to, subject, html, text, idempotencyKey }) {
  const recipients = normalizeRecipients(to);
  const results = [];

  for (const recipient of recipients) {
    const result = await sendMail({
      to: [recipient],
      subject,
      html,
      text,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-${recipient}` : undefined
    });
    results.push({ recipient, ...result });
    await wait(250);
  }

  return results;
}
