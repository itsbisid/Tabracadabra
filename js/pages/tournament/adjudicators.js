import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderAdjudicators(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  window.tcUpdateJudgeField = async (id, field, currentVal) => {
    const newVal = prompt(`Update ${field}:`, currentVal);
    if (newVal !== null && newVal !== currentVal) {
      await supabase.from('adjudicators').update({ [field]: newVal }).eq('id', id);
      fetchAndRender();
    }
  };

  window.tcCopyProgressLink = (id, name) => {
    const url = `${window.location.origin}/#/my-journey?judge_id=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Progress URL for judge ${name} copied to clipboard!`);
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
      
      // Header: Name, Email, Institution, Division, Score
      const rows = lines.slice(1);
      const newJudges = rows.map(row => {
        const [name, email, inst, div, score] = row.split(',').map(s => s.trim());
        return {
          tournament_id: tournamentId,
          name,
          email,
          institution: inst,
          division: div || 'Open',
          score: score || '0',
          status: 'Active'
        };
      });

      const { error } = await supabase.from('adjudicators').insert(newJudges);
      if (error) alert(error.message);
      else fetchAndRender();
    };
    input.click();
  };

  window.tcShowEmailModal = (name, email) => {
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999;">
        <div style="background:white; width:500px; border-radius:12px; overflow:hidden; box-shadow:0 24px 48px rgba(0,0,0,0.2);">
          <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-weight:800; font-size:16px;">Invitation Email for ${name}</h3>
            <button onclick="document.getElementById('modal-root').innerHTML=''" style="border:none; background:none; cursor:pointer; color:#94a3b8;">${icon('x', 20)}</button>
          </div>
          <div style="padding:24px;">
            <div style="margin-bottom:16px;">
              <label style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px; display:block;">Recipient</label>
              <div style="font-size:14px; color:var(--color-text);">${email}</div>
            </div>
            <div style="background:#f1f5f9; border-radius:8px; padding:16px; font-size:13px; line-height:1.6; color:#334155; margin-bottom:24px;">
              Subject: Welcome to the Tournament Core<br><br>
              Hi ${name},<br><br>
              Your registration as an Adjudicator has been approved! You can now access your tournament dashboard to view draws, check-in for rounds, and receive live announcements.<br><br>
              View your dashboard here: <strong>${window.location.origin}/#/dashboard</strong><br><br>
              Best regards,<br>Tournament Tab Core
            </div>
            <div style="display:flex; gap:12px;">
              <button onclick="navigator.clipboard.writeText('Hi ${name}...').then(() => alert('Copied to clipboard!'))" class="btn btn--primary" style="flex:1; gap:8px;">${icon('copy', 16)} Copy Content</button>
              <a href="mailto:${email}?subject=Tournament Invitation&body=Hi ${name}, Your registration has been approved!" class="btn btn--outline" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;">${icon('mail', 16)} Send via App</a>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  window.tcDeleteAdjudicator = async (id) => {
    if (confirm('Permanently remove this adjudicator from the tournament?')) {
      await supabase.from('adjudicators').delete().eq('id', id);
      fetchAndRender();
    }
  };

  const fetchAndRender = async () => {
    const { data, error } = await supabase
      .from('adjudicators')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching adjudicators:', error);
      return;
    }
    renderUI(data || []);
  };

  const renderUI = (judges) => {
    const tableHTML = `
      <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
          <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Name</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Institution</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Division</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Score</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Flags</th>
              <th style="padding:16px; text-transform:uppercase; font-size:12px; font-weight:700; color:var(--color-text-muted);">Status</th>
              <th style="padding:16px;"></th>
            </tr>
          </thead>
          <tbody>
            ${judges.map(j => `
              <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.2s;">
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-weight:700; color:var(--color-text);">${j.name}</div>
                    <span onclick="window.tcCopyProgressLink('${j.id}', '${j.name}')" style="color:var(--color-primary); cursor:pointer;" title="Copy Judge Progress Link">${icon('link', 10)}</span>
                    <span onclick="window.tcUpdateJudgeField('${j.id}', 'name', '${j.name}')" style="color:#94a3b8; cursor:pointer;">${icon('pencil', 12)}</span>
                  </div>
                  <div style="font-size:12px; color:#64748b;">${j.email || 'no email'}</div>
                </td>
                <td style="padding:16px; color:#64748b;">${j.institution || '-'}</td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:13px; color:var(--color-text);">${j.division || 'Open'}</span>
                    <span onclick="window.tcUpdateJudgeField('${j.id}', 'division', '${j.division || ''}')" style="color:#94a3b8; cursor:pointer;">${icon('pencil', 12)}</span>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#64748b;">${j.score || '-'}</span>
                    <span onclick="window.tcUpdateJudgeField('${j.id}', 'score', '${j.score || ''}')" style="color:#94a3b8; cursor:pointer;">${icon('pencil', 12)}</span>
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; gap:6px;">
                    ${j.is_trainee ? '<span style="background:#FEF3C7; color:#D97706; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700;">Trainee</span>' : ''}
                    ${j.is_independent ? '<span style="background:#F0FDF4; color:#10B981; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700;">Independent</span>' : ''}
                  </div>
                </td>
                <td style="padding:16px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="background:#ECFDF5; color:#10B981; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700;">${j.status || 'Active'}</span>
                    <button onclick="window.tcShowEmailModal('${j.name}', '${j.email}')" class="btn btn--outline btn--sm" style="font-size:11px; padding:4px 12px; height:auto; background:white; color:var(--color-primary); border:1px solid #bfdbfe;">
                      ${icon('mail', 14)} Send Email
                    </button>
                    <button onclick="window.tcDeleteAdjudicator('${j.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; padding:4px;">
                      ${icon('trash', 16)}
                    </button>
                  </div>
                </td>
                <td style="padding:16px; text-align:right;">
                  <button style="color:#94a3b8; background:none; border:none; cursor:pointer;">
                    ${icon('moreHorizontal', 18)}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <button onclick="window.tcImportCSV()" class="btn btn--outline" style="display:flex; align-items:center; gap:8px; background:white;">${icon('upload', 18)} Import CSV</button>
          <button class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">${icon('plus', 18)} Add Adjudicator</button>
        </div>
      </div>
        <div style="position:relative; width:300px;">
          <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8;">${icon('search', 16)}</div>
          <input type="text" placeholder="Search adjudicators..." style="width:100%; padding:10px 12px 10px 40px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; outline:none; transition:border 0.2s; focus:border:var(--color-primary);">
        </div>
      </div>

      ${judges.length === 0 ? `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:64px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">⚖️</div>
          <h3 style="font-weight:700; margin-bottom:8px;">No adjudicators registered</h3>
          <p style="color:#64748b; font-size:14px;">Accepted registrations will appear here automatically.</p>
        </div>
      ` : tableHTML}
    `;

    renderAppLayout(container, '/tournament/adjudicators', 'Adjudicators', 'Manage adjudicators participating in this tournament', content);
  };

  fetchAndRender();
}
