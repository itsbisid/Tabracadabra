import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderTeamLOC(container) {
  if (!window.locRoles) {
    window.locRoles = [
      { id: 'tab_director', iconName: 'crown', bg: '#f3e8ff', color: '#9333ea', title: 'Tab Director', desc: 'Oversees tabulation, draw generation, and results integrity', 
        assigned: [{ id: 1, name: 'Awinbisid Desmond-Bugbilla', email: 'awinbisid951@gmail.com' }], expanded: true },
      { id: 'tab_staff', iconName: 'clipboard', bg: '#f3e8ff', color: '#9333ea', title: 'Tab Staff', desc: 'Assist with ballot entry, data verification, and tab operations', assigned: [], expanded: false },
      { id: 'ps_director', iconName: 'mic', bg: '#fce7f3', color: '#db2777', title: 'Public Speaking Director', desc: 'Runs public speaking rounds and PS participants; in hybrid events, no access to debate tab', assigned: [], expanded: false },
      { id: 'convenor', iconName: 'star', bg: '#dbeafe', color: '#2563eb', title: 'Convenor', desc: 'Lead tournament organizer responsible for overall coordination', assigned: [], expanded: false },
      { id: 'deputy_convenor', iconName: 'userCog', bg: '#eff6ff', color: '#3b82f6', title: 'Deputy Convenor', desc: 'Supports the convenor with tournament logistics and decisions', assigned: [], expanded: false },
      { id: 'chief_adj', iconName: 'gavel', bg: '#fef3c7', color: '#d97706', title: 'Chief Adjudicator', desc: 'Sets motions, manages adjudicator allocation and feedback', assigned: [], expanded: false },
      { id: 'deputy_chief_adj', iconName: 'gavel', bg: '#fef3c7', color: '#d97706', title: 'Deputy Chief Adjudicator', desc: 'Assists CA with motions, allocation, and adjudicator training', assigned: [], expanded: false },
      { id: 'equity_officer', iconName: 'scales', bg: '#fee2e2', color: '#dc2626', title: 'Equity Officer', desc: 'Handles equity complaints, ensures safe and inclusive environment', assigned: [], expanded: false },
      { id: 'equity_committee', iconName: 'scales', bg: '#fee2e2', color: '#dc2626', title: 'Equity Committee', desc: 'Supports equity officer in handling complaints and policy', assigned: [], expanded: false },
      { id: 'registration_officer', iconName: 'clipboardCheck', bg: '#d1fae5', color: '#059669', title: 'Registration Officer', desc: 'Manages participant registration, check-in, and credentials', assigned: [], expanded: false }
    ];
  }

  window.renderTeamLOCRefresh = () => renderTeamLOC(container);

  window.toggleRoleExpanded = (idx) => {
    window.locRoles[idx].expanded = !window.locRoles[idx].expanded;
    window.renderTeamLOCRefresh();
  };

  window.removeAssignedPerson = (roleIdx, personIdx) => {
    if(confirm('Are you sure you want to remove this person from the role?')) {
      window.locRoles[roleIdx].assigned.splice(personIdx, 1);
      window.renderTeamLOCRefresh();
    }
  };

  window.submitAssignRole = (e) => {
    e.preventDefault();
    const name = document.getElementById('assign-name').value || 'Unnamed Person';
    const email = document.getElementById('assign-email').value || 'No email provided';
    const roleId = document.getElementById('assign-role-select').value;
    
    // Find the role and push assignment
    const roleIdx = window.locRoles.findIndex(r => r.id === roleId);
    if(roleIdx > -1) {
      window.locRoles[roleIdx].assigned.push({ id: Date.now(), name, email });
      window.locRoles[roleIdx].expanded = true; // Auto expand so they see it
    }
    
    document.getElementById('assign-role-modal').style.display = 'none';
    window.renderTeamLOCRefresh();
  };

  const rolesHtml = window.locRoles.map((role, idx) => `
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; display:flex; flex-direction:column; overflow:hidden;">
      <div onclick="if(${role.assigned.length} > 0) window.toggleRoleExpanded(${idx})" style="padding:16px; display:flex; gap:16px; align-items:flex-start; flex:1; cursor:${role.assigned.length > 0 ? 'pointer' : 'default'}">
        <div style="width:32px; height:32px; border-radius:50%; background:${role.bg}; color:${role.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${icon(role.iconName, 16)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:14px; margin-bottom:2px; color:var(--color-text);">${role.title}</div>
          <div style="font-size:12px; color:var(--color-text-muted); line-height:1.4;">${role.desc}</div>
        </div>
        ${role.assigned.length > 0 ? `
          <div style="background:#f1f5f9; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; color:var(--color-text); display:flex; align-items:center; gap:4px; border:1px solid var(--color-border);">
            ${role.assigned.length} <div style="display:flex; align-items:center; justify-content:center; width:14px; height:14px; color:var(--color-text-muted);">${role.expanded ? icon('chevronUp', 14) : icon('chevronDown', 14)}</div>
          </div>
        ` : ''}
      </div>
      
      ${role.expanded && role.assigned.length > 0 ? `
        <div style="border-top:1px solid var(--color-border);">
          ${role.assigned.map((person, pIdx) => `
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:${pIdx === role.assigned.length - 1 ? 'none' : '1px solid var(--color-border)'}; background:white;">
              <div>
                <div style="font-weight:600; font-size:13px; color:var(--color-text); display:flex; align-items:center; gap:6px;">
                  ${person.name} <span style="color:var(--color-text-muted); cursor:pointer;">${icon('pen', 12)}</span>
                </div>
                <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">${person.email}</div>
              </div>
              <button onclick="window.removeAssignedPerson(${idx}, ${pIdx})" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; padding:4px;" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--color-text-muted)'">
                ${icon('trash', 16)}
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${role.assigned.length === 0 ? `
        <div style="padding:10px 16px; border-top:1px solid var(--color-border); font-size:11px; font-style:italic; color:var(--color-text-muted); background:white;">
          No one assigned yet
        </div>
      ` : ''}
    </div>
  `).join('');

  const content = `
    <!-- Top Custom Header -->
    <div style="margin-bottom:24px;">
      <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px; line-height:1.2;">Team / LOC</h1>
      <div style="font-size:14px; color:var(--color-text-muted); margin-bottom:24px;">Manage organizing committee roles and assignments</div>
      
      <div style="display:flex; gap:24px; align-items:center; color:var(--color-text-muted); font-size:12px; font-weight:600;">
        <div style="display:flex; align-items:center; gap:6px;">${icon('shield', 14)} 1 role assignments</div>
        <div style="display:flex; align-items:center; gap:6px;">${icon('users', 14)} 1 unique people</div>
      </div>
    </div>

    <!-- Grid -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; padding-bottom:100px;">
      ${rolesHtml}
    </div>

    <!-- Floating Action Button -->
    <div onclick="document.getElementById('assign-role-modal').style.display='flex'" style="position:fixed; bottom:32px; right:32px; height:56px; border-radius:28px; background:#0044b3; color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); cursor:pointer; padding:0 24px; font-weight:600; font-size:15px; gap:8px; transition:transform 0.2s; z-index:100;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'">
      ${icon('userPlus', 18)} Assign Role
    </div>

    <!-- Assign Role Modal -->
    <div id="assign-role-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(2px);" onclick="if(event.target.id === 'assign-role-modal') this.style.display='none'">
      <div style="background:white; border-radius:12px; padding:24px 32px; width:460px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); font-family:var(--font-family);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
          <h2 style="font-size:20px; font-weight:700; color:var(--color-text); margin:0;">Assign Role</h2>
          <button onclick="document.getElementById('assign-role-modal').style.display='none'" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);">${icon('x', 20)}</button>
        </div>
        
        <form onsubmit="window.submitAssignRole(event)" style="display:flex; flex-direction:column; gap:20px;">
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; font-size:14px; color:var(--color-text);">Email (optional)</label>
            <input id="assign-email" type="email" placeholder="person@example.com" style="width:100%; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:14px; outline:none;" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border-strong)'">
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">Leave empty to create a temporary account and add email later.</div>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; font-size:14px; color:var(--color-text);">Name (optional)</label>
            <input id="assign-name" type="text" placeholder="Jane Smith" style="width:100%; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:14px; outline:none;" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border-strong)'">
          </div>
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; font-size:14px; color:var(--color-text);">Role</label>
            <div style="position:relative;">
              <select id="assign-role-select" style="width:100%; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:14px; outline:none; appearance:none; background:white; color:var(--color-text);" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border-strong)'">
                ${window.locRoles.map(r => `<option value="${r.id}">${r.title}</option>`).join('')}
              </select>
              <div style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--color-text);">
                ${icon('chevronDown', 16)}
              </div>
            </div>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button type="button" onclick="document.getElementById('assign-role-modal').style.display='none'" style="background:white; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; color:var(--color-text); cursor:pointer;">Cancel</button>
            <button type="submit" style="background:#0044b3; border:none; border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; color:white; cursor:pointer; display:flex; align-items:center; gap:8px;">${icon('userPlus', 16)} Assign Role</button>
          </div>
          
        </form>
      </div>
    </div>
  `;

  renderAppLayout(
    container,
    '/tournament/team-loc',
    '', 
    '',
    content
  );
}
