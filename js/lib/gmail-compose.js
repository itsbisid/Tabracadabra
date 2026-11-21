import { supabase } from './supabase.js';
import { escapeHtml } from './html.js';
import { icon } from '../components/icons.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function gmailComposeUrl({ to, subject, body }) {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

async function getTournamentName(tournamentId) {
  try {
    const { data } = await supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle();
    return data?.name || 'the tournament';
  } catch {
    return 'the tournament';
  }
}

function buildMessage(recipient, tournamentName) {
  const isJudge = recipient.role === 'adjudicator';
  const subject = isJudge
    ? `Your private judge link - ${tournamentName}`
    : `Your private team link - ${tournamentName}${recipient.teamName ? ` | ${recipient.teamName}` : ''}`;
  const body = [
    `Hi ${recipient.name || 'there'},`,
    '',
    isJudge
      ? `Here is your personal adjudicator portal for ${tournamentName}:`
      : `Here is your personal portal for ${tournamentName}${recipient.teamName ? ` (team ${recipient.teamName})` : ''}:`,
    '',
    recipient.dashboardUrl,
    '',
    isJudge
      ? 'Use it to check in, see your room allocations, submit ballots and feedback, and receive announcements.'
      : 'Use it to check in, see draws and room allocations, give feedback, and receive announcements.',
    '',
    'Please keep this link private - it is unique to you.',
    '',
    'Best regards,',
    'Tab Team'
  ].join('\n');
  return { subject, body };
}

// Opens a queue of Gmail compose windows, one per participant, each with
// their own private URL. Browsers allow one new tab per click, so the admin
// clicks "Open next" (or a row's button) and presses Send in Gmail.
export async function openGmailPrivateUrlQueue({ tournamentId, recipients, title }) {
  const tournamentName = await getTournamentName(tournamentId);
  const items = recipients.map(recipient => {
    const email = String(recipient.email || '').trim();
    const valid = EMAIL_RE.test(email);
    return {
      ...recipient,
      email,
      valid,
      opened: false,
      url: valid ? gmailComposeUrl({ to: email, ...buildMessage(recipient, tournamentName) }) : ''
    };
  });

  const modalRoot = document.getElementById('modal-root');
  const close = () => { modalRoot.innerHTML = ''; modalRoot.onclick = null; };

  const render = () => {
    const sendable = items.filter(item => item.valid);
    const openedCount = sendable.filter(item => item.opened).length;
    const next = sendable.find(item => !item.opened);
    modalRoot.innerHTML = `
      <div data-gmail-overlay style="position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:white; width:min(620px,100%); max-height:90vh; display:flex; flex-direction:column; border-radius:12px; box-shadow:0 24px 48px rgba(0,0,0,.2);">
          <div style="padding:20px 24px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; gap:16px;">
            <div>
              <h3 style="margin:0; font-size:17px; font-weight:800;">${escapeHtml(title)}</h3>
              <p style="margin:6px 0 0; font-size:13px; color:#64748b;">Each click opens a Gmail draft addressed to one person with their own private URL. Press <strong>Send</strong> in Gmail, then come back for the next one.</p>
            </div>
            <button type="button" data-gmail-close aria-label="Close" style="border:0; background:none; cursor:pointer; color:#94a3b8; align-self:flex-start;">${icon('x', 20)}</button>
          </div>
          <div style="padding:16px 24px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <span style="font-size:13px; font-weight:700; color:#334155;">${openedCount} of ${sendable.length} opened${items.length > sendable.length ? ` · ${items.length - sendable.length} without email` : ''}</span>
            ${next
              ? `<button type="button" data-gmail-next class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">${icon('mail', 16)} Open next in Gmail: ${escapeHtml(next.name || next.email)}</button>`
              : `<span style="font-size:13px; font-weight:700; color:#047857;">${sendable.length ? 'All drafts opened.' : 'Nobody has an email address saved.'}</span>`}
          </div>
          <div style="overflow:auto; padding:8px 24px 20px;">
            ${items.map((item, index) => `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:14px;">${escapeHtml(item.name || 'Unnamed')}${item.teamName ? ` <span style="font-weight:500; color:#64748b;">· ${escapeHtml(item.teamName)}</span>` : ''}</div>
                  <div style="font-size:12px; color:${item.valid ? '#64748b' : '#b45309'}; word-break:break-all;">${item.valid ? escapeHtml(item.email) : 'No valid email saved'}</div>
                </div>
                ${item.valid
                  ? `<button type="button" data-gmail-open="${index}" class="btn btn--outline btn--sm" style="white-space:nowrap; ${item.opened ? 'color:#047857; border-color:#a7f3d0;' : ''}">${item.opened ? 'Opened ✓ Reopen' : 'Open in Gmail'}</button>`
                  : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  };

  const openItem = item => {
    window.open(item.url, '_blank', 'noopener');
    item.opened = true;
    render();
  };

  modalRoot.onclick = event => {
    const target = event.target.closest('[data-gmail-close], [data-gmail-next], [data-gmail-open]');
    if (!target) {
      if (event.target.matches('[data-gmail-overlay]')) close();
      return;
    }
    if (target.hasAttribute('data-gmail-close')) { close(); return; }
    if (target.hasAttribute('data-gmail-next')) {
      const next = items.find(item => item.valid && !item.opened);
      if (next) openItem(next);
      return;
    }
    const item = items[Number(target.dataset.gmailOpen)];
    if (item) openItem(item);
  };

  render();
}
