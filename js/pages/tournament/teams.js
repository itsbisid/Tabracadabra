import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderTeams(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  window.tcShareTeamURL = (id, name, speakerName) => {
    const url = `${window.location.origin}/#/team/${id}/progress?speaker=${encodeURIComponent(speakerName)}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Progress URL for ${speakerName} copied to clipboard!`);
    });
  };

  window.tcUpdateTeamField = async (id, field, currentVal) => {
    const newVal = prompt(`Update ${field}:`, currentVal);
    if (newVal !== null && newVal !== currentVal) {
      await supabase.from('teams').update({ [field]: newVal }).eq('id', id);
      fetchAndRender();
    }
  };

  window.tcCopyProgressLink = (id, name) => {
    const url = `${window.location.origin}/#/my-journey?speaker_id=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Progress URL for ${name} copied to clipboard!`);
    });
  };

  window.tcImportCSV = () => {
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
          institution: inst,
          speaker1_name: s1,
          speaker1_email: s1e,
          speaker2_name: s2,
          speaker2_email: s2e,
          division: div || 'Open'
        };
      });

      const { error } = await supabase.from('teams').insert(newTeams);
      if (error) alert(error.message);
      else fetchAndRender();
    };
    input.click();
  };

  window.tcDeleteTeam = async (id) => {
    if (confirm('Permanently remove this team from the tournament?')) {
      await supabase.from('teams').delete().eq('id', id);
      fetchAndRender();
    }
  };

  const fetchAndRender = async () => {
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
              const speakers = [team.speaker1_name, team.speaker2_name].filter(Boolean).join(', ');
              return `
              <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.2s;">
                <td style="padding:16px;"><input type="checkbox"></td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div>
                      <div style="font-weight:700; color:var(--color-text);">${team.name}</div>
                      <div style="font-size:11px; color:#64748b;">${speakers}</div>
                    </div>
                    <span onclick="window.tcUpdateTeamField('${team.id}', 'name', '${team.name}')" style="color:#94a3b8; cursor:pointer;">${icon('pencil', 12)}</span>
                  </div>
                </td>
                <td style="padding:16px; color:#64748b;">${team.institution || '-'}</td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:13px; color:var(--color-text);">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span>${team.speaker1_name || '-'}</span>
                        <span onclick="window.tcUpdateTeamField('${team.id}', 'speaker1_eligibility', '${team.speaker1_eligibility || 'OPEN'}')" style="background:#f1f5f9; color:#64748b; font-size:9px; padding:2px 4px; border-radius:4px; font-weight:700; cursor:pointer;" title="Set Eligibility">${team.speaker1_eligibility || 'OPEN'}</span>
                        <span onclick="window.tcCopyProgressLink('${team.id}', '${team.speaker1_name}')" style="color:var(--color-primary); cursor:pointer;" title="Copy S1 Progress Link">${icon('link', 10)}</span>
                      </div>
                      <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                        <span>${team.speaker2_name || '-'}</span>
                        <span onclick="window.tcUpdateTeamField('${team.id}', 'speaker2_eligibility', '${team.speaker2_eligibility || 'OPEN'}')" style="background:#f1f5f9; color:#64748b; font-size:9px; padding:2px 4px; border-radius:4px; font-weight:700; cursor:pointer;" title="Set Eligibility">${team.speaker2_eligibility || 'OPEN'}</span>
                        <span onclick="window.tcCopyProgressLink('${team.id}', '${team.speaker2_name}')" style="color:var(--color-primary); cursor:pointer;" title="Copy S2 Progress Link">${icon('link', 10)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.tcUpdateTeamField('${team.id}', 'division', '${team.division || ''}')">
                      <span style="color:#64748b; font-size:12px;">Div: ${team.division || 'Open'}</span>
                      <span style="color:#94a3b8;">${icon('pencil', 10)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.tcUpdateTeamField('${team.id}', 'manual_category_override', '${team.manual_category_override || ''}')">
                      <span style="color:var(--color-primary); font-size:11px; font-weight:700;">Logic: ${team.manual_category_override || 'Auto'}</span>
                      <span style="color:#94a3b8;">${icon('pencil', 10)}</span>
                    </div>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="background:#ECFDF5; color:#10B981; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700;">${team.status || 'Active'}</span>
                    <button onclick="window.tcShareTeamURL('${team.id}', '${team.name}', '${team.speaker1_name}')" class="btn btn--outline btn--sm" style="font-size:10px; padding:4px 8px; height:auto; background:white; color:var(--color-primary); border:1px solid #bfdbfe;">
                      ${icon('link', 12)} URL: S1
                    </button>
                    <button onclick="window.tcShareTeamURL('${team.id}', '${team.name}', '${team.speaker2_name}')" class="btn btn--outline btn--sm" style="font-size:10px; padding:4px 8px; height:auto; background:white; color:var(--color-primary); border:1px solid #bfdbfe;">
                      ${icon('link', 12)} URL: S2
                    </button>
                    <button class="btn btn--outline btn--sm" style="font-size:11px; padding:4px 12px; height:auto; background:white; color:#64748b; border:1px solid #e2e8f0;">Deactivate</button>
                    <button onclick="window.tcDeleteTeam('${team.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; padding:4px;">
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
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <button onclick="window.tcImportCSV()" class="btn btn--outline" style="display:flex; align-items:center; gap:8px; background:white;">${icon('upload', 18)} Import CSV</button>
          <button onclick="document.getElementById('add-team-modal').style.display='flex'" class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">${icon('plus', 18)} Add Team</button>
        </div>
      </div>

      <!-- Add Team Modal -->
      <div id="add-team-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(2px);">
        <div style="background:white; border-radius:12px; padding:24px 32px; width:500px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
          <h2 style="font-size:20px; font-weight:700; margin-bottom:24px;">Manual Team Entry</h2>
          <form id="manual-team-form" style="display:flex; flex-direction:column; gap:16px;">
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
        <div style="position:relative; width:300px;">
          <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8;">${icon('search', 16)}</div>
          <input type="text" placeholder="Search teams..." style="width:100%; padding:10px 12px 10px 40px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; outline:none; transition:border 0.2s; focus:border:var(--color-primary);">
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn btn--outline" style="color:#64748b; font-size:13px; padding:8px 16px; border-color:#e2e8f0;">Delete Selected (0)</button>
          <button class="btn btn--outline" style="color:#ef4444; border-color:#fee2e2; font-size:13px; padding:8px 16px;">Delete All Teams</button>
        </div>
      </div>

      ${teams.length === 0 ? `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:64px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">👥</div>
          <h3 style="font-weight:700; margin-bottom:8px;">No teams registered</h3>
          <p style="color:#64748b; font-size:14px;">Accepted registrations will appear here automatically.</p>
        </div>
      ` : tableHTML}
    renderAppLayout(container, '/tournament/teams', 'Teams', 'Manage teams participating in this tournament', content);
  };

  fetchAndRender();

  // Wire manual form
  setTimeout(() => {
    const form = document.getElementById('manual-team-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const { error } = await supabase.from('teams').insert({
          tournament_id: tournamentId,
          name: fd.get('name'),
          institution: fd.get('institution'),
          speaker1_name: fd.get('s1'),
          speaker2_name: fd.get('s2')
        });
        if (error) {
          alert(error.message);
        } else {
          document.getElementById('add-team-modal').style.display = 'none';
          form.reset();
          fetchAndRender();
        }
      };
    }
  }, 100);
}
