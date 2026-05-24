import nodemailer from 'nodemailer';

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

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo: replyTo || undefined,
    headers: idempotencyKey ? { 'X-TabraCadabra-Idempotency-Key': idempotencyKey } : undefined
  });

  return { id: info.messageId };
}
