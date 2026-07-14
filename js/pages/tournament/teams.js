import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml, escapeJsString } from '../../lib/html.js';
import { DEFAULT_TEAM_EMOJI, getTeamEmoji, teamLabelHtml } from '../../lib/team-display.js';
import { isAdmin } from '../../lib/auth-helpers.js';

const EMOJI_CATEGORIES = {
  Default: [DEFAULT_TEAM_EMOJI],
  Animals: ['🦁', '🐯', '🐺', '🦊', '🦅', '🦉', '🐉', '🦈', '🐝', '🦋'],
  Symbols: ['⚡', '🔥', '✨', '🌟', '💎', '🛡️', '🏹', '🎯', '👑', '🚀'],
  Nature: ['🌊', '🌋', '🌙', '☀️', '🌴', '🌵', '🍀', '🌻', '❄️', '🌈'],
  Objects: ['🏆', '🎲', '🎭', '🎸', '📚', '🧠', '🪄', '🧭', '🔮', '📣']
};

const RECENT_EMOJI_KEY = 'tc_recent_team_emojis';

function getRecentEmojis() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || '[]').filter(Boolean).slice(0, 12);
  } catch {
    return [];
  }
}

function rememberEmoji(emoji) {
  const next = [emoji, ...getRecentEmojis().filter(item => item !== emoji)].slice(0, 12);
  localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(next));
}

function isMissingEmojiColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('emoji') || message.includes('schema cache') || message.includes('could not find');
}

export async function renderTeams(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;
  let isUserAdmin = false;

  async function insertTeamsWithEmoji(rows) {
    let { error } = await supabase.from('teams').insert(rows);
    if (error && isMissingEmojiColumn(error)) {
      const fallbackRows = rows.map(({ emoji, ...row }) => row);
      ({ error } = await supabase.from('teams').insert(fallbackRows));
      if (!error) {
        alert('Team saved, but the database is missing teams.emoji. Run supabase/rounds-and-team-mascots.sql to persist mascots.');
      }
    }
    return { error };
  }

  window.tcShareTeamURL = (id, name, speakerName) => {
    const url = `${window.location.origin}/#/portal/team/${id}?speaker=${encodeURIComponent(speakerName || '')}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Progress URL for ${speakerName} copied to clipboard!`);
    });
  };

  window.tcUpdateTeamField = async (id, field, currentVal) => {
    if (!isUserAdmin) { alert('Only tournament admins can edit team details.'); return; }
    const newVal = prompt(`Update ${field}:`, currentVal);
    if (newVal !== null && newVal !== currentVal) {
      await supabase.from('teams').update({ [field]: newVal }).eq('id', id);
      fetchAndRender();
    }
  };

  window.tcCopyProgressLink = (id, name) => {
    const url = `${window.location.origin}/#/portal/team/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Progress URL for ${name} copied to clipboard!`);
    });
  };

  window.tcImportCSV = () => {
    if (!isUserAdmin) { alert('Only tournament admins can import teams.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      // Skip header: Team Name, Institution, S1 Name, S1 Email, S2 Name, S2 Email, Division
      const rows = lines.slice(1);
      const newTeams = rows.map(row => {
        const [name, inst, s1, s1e, s2, s2e, div] = row.split(',').map(s => s.trim());
        return {
          tournament_id: tournamentId,
          name,
          emoji: DEFAULT_TEAM_EMOJI,
          institution: inst,
          speaker1_name: s1,
          speaker1_email: s1e,
          speaker2_name: s2,
          speaker2_email: s2e,
          division: div || 'Open'
        };
      });

      const { error } = await insertTeamsWithEmoji(newTeams);
      if (error) alert(error.message);
      else fetchAndRender();
    };
    input.click();
  };

  window.tcOpenEmojiPicker = (teamId = '', currentEmoji = DEFAULT_TEAM_EMOJI) => {
    if (teamId && !isUserAdmin) { alert('Only tournament admins can edit team mascots.'); return; }
    const modalRoot = document.getElementById('modal-root');
    const selected = currentEmoji || DEFAULT_TEAM_EMOJI;
    const recent = getRecentEmojis();
    const categories = recent.length ? { Recent: recent, ...EMOJI_CATEGORIES } : EMOJI_CATEGORIES;
    modalRoot.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; width:min(560px,100%); max-height:86vh; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,.24);">
          <div style="padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
            <div>
              <h3 style="margin:0; font-size:18px; font-weight:900;">Choose team mascot</h3>
              <p style="margin:4px 0 0; color:#64748b; font-size:13px;">Search, pick a category, or use the default mascot.</p>
            </div>
            <button onclick="document.getElementById('modal-root').innerHTML=''" style="border:0; background:transparent; color:#64748b; cursor:pointer;">${icon('x', 20)}</button>
          </div>
          <div style="padding:18px 20px;">
            <input id="emoji-search" class="form-input" placeholder="Search emojis or categories..." oninput="window.tcFilterEmojiPicker(this.value)" style="margin-bottom:14px;">
            <div id="emoji-picker-body" style="display:grid; gap:14px; max-height:52vh; overflow:auto;">
              ${Object.entries(categories).map(([category, emojis]) => `
                <section class="emoji-category" data-category="${escapeHtml(category.toLowerCase())}">
                  <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:900; margin-bottom:8px;">${escapeHtml(category)}</div>
                  <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(42px, 1fr)); gap:8px;">
                    ${emojis.map(emoji => `
                      <button
                        type="button"
                        class="emoji-choice"
                        data-emoji="${escapeHtml(emoji)}"
                        data-search="${escapeHtml(`${category} ${emoji}`.toLowerCase())}"
                        onclick="window.tcChooseTeamEmoji('${escapeJsString(teamId)}', '${escapeJsString(emoji)}')"
                        style="height:42px; border:1px solid ${emoji === selected ? '#0044b3' : '#e2e8f0'}; background:${emoji === selected ? '#eff6ff' : 'white'}; border-radius:8px; cursor:pointer; font-size:22px;"
                      >${escapeHtml(emoji)}</button>
                    `).join('')}
                  </div>
                </section>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  window.tcFilterEmojiPicker = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    document.querySelectorAll('.emoji-category').forEach(section => {
      let anyVisible = false;
      section.querySelectorAll('.emoji-choice').forEach(button => {
        const visible = !normalized || button.dataset.search.includes(normalized) || section.dataset.category.includes(normalized);
        button.style.display = visible ? 'block' : 'none';
        anyVisible = anyVisible || visible;
      });
      section.style.display = anyVisible ? 'block' : 'none';
    });
  };

  window.tcChooseTeamEmoji = async (teamId, emoji) => {
    rememberEmoji(emoji);

    if (!teamId) {
      const input = document.getElementById('team-emoji-input');
      const preview = document.getElementById('team-emoji-preview');
      if (input) input.value = emoji;
      if (preview) preview.textContent = emoji;
      document.getElementById('modal-root').innerHTML = '';
      return;
    }

    const { error } = await supabase.from('teams').update({ emoji }).eq('id', teamId);
    if (error) {
      alert(isMissingEmojiColumn(error)
        ? 'Could not save the mascot because the database is missing teams.emoji. Run supabase/rounds-and-team-mascots.sql.'
        : error.message);
      return;
    }
    document.getElementById('modal-root').innerHTML = '';
    fetchAndRender();
  };

  window.tcDeleteTeam = async (id) => {
    if (!isUserAdmin) { alert('Only tournament admins can remove teams.'); return; }
    if (confirm('Permanently remove this team from the tournament?')) {
      await supabase.from('teams').delete().eq('id', id);
      fetchAndRender();
    }
  };

  window.tcToggleTeamActive = async (id, currentStatus) => {
    if (!isUserAdmin) { alert('Only tournament admins can change team status.'); return; }
    const nextStatus = (currentStatus || 'Active') === 'Inactive' ? 'Active' : 'Inactive';
    const { error } = await supabase.from('teams').update({ status: nextStatus }).eq('id', id);
    if (error) alert(error.message);
    else fetchAndRender();
  };

  // Inline form handler (attached at parse time, so no render/timing race).
  window.tcSaveTeam = async (e) => {
    e.preventDefault();
    if (!isUserAdmin) { alert('Only tournament admins can create teams.'); return false; }
    const form = e.target;
    const saveBtn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { alert('Please enter a team name.'); return false; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    const { error } = await supabase.from('teams').insert({
      tournament_id: tournamentId,
      name,
      emoji: String(fd.get('emoji') || DEFAULT_TEAM_EMOJI).trim() || DEFAULT_TEAM_EMOJI,
      institution: String(fd.get('institution') || '').trim() || null,
      speaker1_name: String(fd.get('s1') || '').trim() || null,
      speaker2_name: String(fd.get('s2') || '').trim() || null,
      status: 'Active'
    }).then(async result => {
      if (!result.error || !isMissingEmojiColumn(result.error)) return result;
      return supabase.from('teams').insert({
        tournament_id: tournamentId,
        name,
        institution: String(fd.get('institution') || '').trim() || null,
        speaker1_name: String(fd.get('s1') || '').trim() || null,
        speaker2_name: String(fd.get('s2') || '').trim() || null,
        status: 'Active'
      });
    });

    if (error) {
      const msg = /row-level security/i.test(error.message)
        ? 'You do not have permission to edit this tournament (are you signed in as the tournament owner?).'
        : error.message;
      alert('Could not add team: ' + msg);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Team'; }
    } else {
      const modal = document.getElementById('add-team-modal');
      if (modal) modal.style.display = 'none';
      form.reset();
      fetchAndRender();
    }
    return false;
  };

  const fetchAndRender = async () => {
    isUserAdmin = await isAdmin(tournamentId);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching teams:', error);
      return;
    }
    renderUI(data || []);
  };

  const renderUI = (teams) => {
    const tableHTML = `
      <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:16px; width:40px;"><input type="checkbox"></th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Team</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Institution</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Speakers</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Division</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Status</th>
              <th style="padding:16px;"></th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => {
              const teamId = escapeJsString(team.id);
              const teamName = escapeHtml(team.name);
              const teamNameJs = escapeJsString(team.name);
              const teamEmoji = escapeHtml(getTeamEmoji(team));
              const institution = escapeHtml(team.institution || '-');
              const speaker1Name = escapeHtml(team.speaker1_name || '-');
              const speaker1NameJs = escapeJsString(team.speaker1_name || '');
              const speaker2Name = escapeHtml(team.speaker2_name || '-');
              const speaker2NameJs = escapeJsString(team.speaker2_name || '');
              const speaker1Eligibility = escapeHtml(team.speaker1_eligibility || 'OPEN');
              const speaker2Eligibility = escapeHtml(team.speaker2_eligibility || 'OPEN');
              const division = escapeHtml(team.division || 'Open');
              const manualCategory = escapeHtml(team.manual_category_override || 'Auto');
              const status = escapeHtml(team.status || 'Active');
              const speakers = [team.speaker1_name, team.speaker2_name].filter(Boolean).map(escapeHtml).join(', ');
              return `
              <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.2s;">
                <td style="padding:16px;"><input type="checkbox"></td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <button onclick="window.tcOpenEmojiPicker('${teamId}', '${escapeJsString(getTeamEmoji(team))}')" title="Choose mascot" style="width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:white; cursor:pointer; font-size:18px;" class="google-emoji">${teamEmoji}</button>
                    <div>
                      <div style="font-weight:700; color:var(--color-text);">${teamLabelHtml(team)}</div>
                      <div style="font-size:11px; color:#64748b;">${speakers}</div>
                    </div>
                    <span onclick="window.tcUpdateTeamField('${teamId}', 'name', '${teamNameJs}')" style="color:#94a3b8; cursor:pointer;">${icon('pencil', 12)}</span>
                  </div>
                </td>
                <td style="padding:16px; color:#64748b;">${institution}</td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:13px; color:var(--color-text);">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span>${speaker1Name}</span>
                        <span onclick="window.tcUpdateTeamField('${teamId}', 'speaker1_eligibility', '${escapeJsString(team.speaker1_eligibility || 'OPEN')}')" style="background:#f1f5f9; color:#64748b; font-size:9px; padding:2px 4px; border-radius:4px; font-weight:700; cursor:pointer;" title="Set Eligibility">${speaker1Eligibility}</span>
                        <span onclick="window.tcCopyProgressLink('${teamId}', '${speaker1NameJs}')" style="color:var(--color-primary); cursor:pointer;" title="Copy S1 Progress Link">${icon('link', 10)}</span>
                      </div>
                      <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                        <span>${speaker2Name}</span>
                        <span onclick="window.tcUpdateTeamField('${teamId}', 'speaker2_eligibility', '${escapeJsString(team.speaker2_eligibility || 'OPEN')}')" style="background:#f1f5f9; color:#64748b; font-size:9px; padding:2px 4px; border-radius:4px; font-weight:700; cursor:pointer;" title="Set Eligibility">${speaker2Eligibility}</span>
                        <span onclick="window.tcCopyProgressLink('${teamId}', '${speaker2NameJs}')" style="color:var(--color-primary); cursor:pointer;" title="Copy S2 Progress Link">${icon('link', 10)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.tcUpdateTeamField('${teamId}', 'division', '${escapeJsString(team.division || '')}')">
                      <span style="color:#64748b; font-size:12px;">Div: ${division}</span>
                      <span style="color:#94a3b8;">${icon('pencil', 10)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.tcUpdateTeamField('${teamId}', 'manual_category_override', '${escapeJsString(team.manual_category_override || '')}')">
                      <span style="color:var(--color-primary); font-size:11px; font-weight:700;">Logic: ${manualCategory}</span>
                      <span style="color:#94a3b8;">${icon('pencil', 10)}</span>
                    </div>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    ${(team.status || 'Active') === 'Inactive'
                      ? `<span style="background:#f1f5f9; color:#64748b; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700;">Inactive</span>`
                      : `<span style="background:#ECFDF5; color:#10B981; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700;">${status}</span>`}
                    <button onclick="window.tcShareTeamURL('${teamId}', '${teamNameJs}', '${speaker1NameJs}')" class="btn btn--outline btn--sm" style="font-size:10px; padding:4px 8px; height:auto; background:white; color:var(--color-primary); border:1px solid #bfdbfe;">
                      ${icon('link', 12)} URL: S1
                    </button>
                    <button onclick="window.tcShareTeamURL('${teamId}', '${teamNameJs}', '${speaker2NameJs}')" class="btn btn--outline btn--sm" style="font-size:10px; padding:4px 8px; height:auto; background:white; color:var(--color-primary); border:1px solid #bfdbfe;">
                      ${icon('link', 12)} URL: S2
                    </button>
                    <button onclick="window.tcToggleTeamActive('${teamId}', '${escapeJsString(team.status || 'Active')}')" class="btn btn--outline btn--sm" style="font-size:11px; padding:4px 12px; height:auto; background:white; color:#64748b; border:1px solid #e2e8f0;">${(team.status || 'Active') === 'Inactive' ? 'Reactivate' : 'Deactivate'}</button>
                    <button onclick="window.tcDeleteTeam('${teamId}')" style="color:#ef4444; border:none; background:none; cursor:pointer; padding:4px;">
                      ${icon('trash', 16)}
                    </button>
                  </div>
                </td>
                <td style="padding:16px;"></td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; flex-wrap:wrap;">
        <div style="position:relative; width:300px; max-width:100%;">
          <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8;">${icon('search', 16)}</div>
          <input type="text" placeholder="Search teams..." style="width:100%; padding:10px 12px 10px 40px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; outline:none; transition:border 0.2s;">
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          ${isUserAdmin ? `
            <button onclick="window.tcImportCSV()" class="btn btn--outline" style="display:flex; align-items:center; gap:8px; background:white;">${icon('upload', 18)} Import CSV</button>
            <button onclick="document.getElementById('add-team-modal').style.display='flex'" class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">${icon('plus', 18)} Add Team</button>
          ` : `<span style="font-size:13px; color:#64748b;">Read-only: admin permissions required for changes.</span>`}
        </div>
      </div>

      <!-- Add Team Modal -->
      <div id="add-team-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(2px);">
        <div style="background:white; border-radius:12px; padding:24px 32px; width:500px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px; font-weight:700; margin-bottom:24px;">Manual Team Entry</h2>
          <form id="manual-team-form" onsubmit="return window.tcSaveTeam(event)" style="display:flex; flex-direction:column; gap:16px;">
            <div class="form-group">
              <label class="form-label">Emoji Mascot</label>
              <input id="team-emoji-input" type="hidden" name="emoji" value="${DEFAULT_TEAM_EMOJI}">
              <button type="button" onclick="window.tcOpenEmojiPicker('', document.getElementById('team-emoji-input').value)" style="height:44px; width:100%; border:1px solid var(--color-border-strong); border-radius:8px; background:white; display:flex; align-items:center; justify-content:space-between; padding:0 12px; cursor:pointer;">
                <span style="display:flex; align-items:center; gap:10px;"><span id="team-emoji-preview" class="google-emoji" style="font-size:22px;">${DEFAULT_TEAM_EMOJI}</span><span>Choose mascot</span></span>
                ${icon('chevronDown', 16)}
              </button>
            </div>
            <div class="form-group"><label class="form-label">Team Name</label><input name="name" required class="form-input"></div>
            <div class="form-group"><label class="form-label">Institution</label><input name="institution" class="form-input"></div>
            <div class="grid-2">
              <div class="form-group"><label class="form-label">Speaker 1</label><input name="s1" required class="form-input"></div>
              <div class="form-group"><label class="form-label">Speaker 2</label><input name="s2" required class="form-input"></div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
              <button type="button" onclick="document.getElementById('add-team-modal').style.display='none'" class="btn btn--outline">Cancel</button>
              <button type="submit" class="btn btn--primary">Save Team</button>
            </div>
          </form>
        </div>
      </div>

      ${teams.length === 0 ? `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:64px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">👥</div>
          <h3 style="font-weight:700; margin-bottom:8px;">No teams registered</h3>
          <p style="color:#64748b; font-size:14px;">Accepted registrations will appear here automatically.</p>
        </div>
      ` : tableHTML}
    `;

    renderAppLayout(container, '/tournament/teams', 'Teams', 'Manage teams participating in this tournament', content);
  };

  fetchAndRender();
}
