import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { getCurrentUser } from '../lib/auth-utils.js';
import { supabase } from '../lib/supabase.js';

export async function renderProfile(container) {
  const user = await getCurrentUser();
  
  // 1. Fetch Tournaments Owned
  const { data: ownedTournaments } = await supabase.from('tournaments').select('id').eq('owner_id', user.id);
  
  // 2. Fetch Team Memberships
  const { data: s1Teams } = await supabase.from('teams').select('id, tournament_id').eq('speaker1_email', user.email);
  const { data: s2Teams } = await supabase.from('teams').select('id, tournament_id').eq('speaker2_email', user.email);
  const { data: adjRoles } = await supabase.from('adjudicators').select('id, tournament_id').eq('email', user.email);

  const teamIds = [...(s1Teams || []), ...(s2Teams || [])].map(t => t.id);
  const myTournamentIds = new Set([
     ...(ownedTournaments || []).map(t => t.id),
     ...(s1Teams || []).map(t => t.tournament_id),
     ...(s2Teams || []).map(t => t.tournament_id),
     ...(adjRoles || []).map(t => t.tournament_id)
  ]);

  // 3. Fetch Ballots for speaks
  let totalSpeaks = 0;
  let roundsCount = 0;
  if (teamIds.length > 0) {
    const { data: ballots } = await supabase.from('ballots').select('s1_points, s2_points, team_id').in('team_id', teamIds);
    (ballots || []).forEach(b => {
      roundsCount++;
      if (s1Teams?.find(t => t.id === b.team_id)) totalSpeaks += (b.s1_points || 0);
      else totalSpeaks += (b.s2_points || 0);
    });
  }

  // 4. Calculate Breaks (Participation in Elims)
  let breakCount = 0;
  if (myTournamentIds.size > 0) {
    const { data: elimRounds } = await supabase.from('rounds')
      .select('id')
      .in('tournament_id', Array.from(myTournamentIds))
      .not('round_num', 'is', null) // Crude way to filter if needed, but better check type
      .or('name.ilike.%Final%,name.ilike.%Break%');
    breakCount = elimRounds?.length || 0;
  }

  const avgSpeaks = roundsCount > 0 ? (totalSpeaks / roundsCount).toFixed(1) : '0.0';

  const content = `
    <div class="card mb-xl anim-fade-in">
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,68,179,0.2);">
          ${user.initials}
        </div>
        <div style="flex: 1;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin-bottom: 4px;">Account Details</h2>
          <p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 20px;">Manage your personal profile and account settings</p>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="profile-name" class="form-input" value="${user.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (Read Only)</label>
              <input type="email" class="form-input" value="${user.email}" readonly style="background:var(--color-bg); cursor:not-allowed;">
            </div>
          </div>
          
          <div style="display:flex; justify-content:flex-end;">
            <button id="save-profile" class="btn btn--primary mt-md" style="min-width:140px;">${icon('check', 16)} Save Changes</button>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
       <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--color-text);">Debating Resume</h2>
       <span style="font-size: 11px; font-weight:700; color:var(--color-primary); text-transform:uppercase; letter-spacing:0.5px;">Auto-synced via Email</span>
    </div>

    <div class="grid-4 mb-xl">
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Tournaments</span>
          <div class="stat-card__icon" style="background: #e0f2fe; color: #0ea5e9">${icon('trophy')}</div>
        </div>
        <div class="stat-card__value" style="font-weight:800;">${myTournamentIds.size}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Total Rounds</span>
          <div class="stat-card__icon" style="background: #fef3c7; color: #d97706">${icon('list')}</div>
        </div>
        <div class="stat-card__value" style="font-weight:800;">${roundsCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Avg Speaks</span>
          <div class="stat-card__icon" style="background: #dcfce7; color: #16a34a">${icon('star')}</div>
        </div>
        <div class="stat-card__value" style="font-weight:800;">${avgSpeaks}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Breaks</span>
          <div class="stat-card__icon" style="background: #fee2e2; color: #dc2626">${icon('award')}</div>
        </div>
        <div class="stat-card__value" style="font-weight:800;">${breakCount}</div>
      </div>
    </div>

    <div class="card" style="border: 1px solid #fee2e2; background: #fffcfc;">
      <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 8px; color: var(--color-danger);">Danger Zone</h3>
      <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 20px;">Once you delete your account, there is no going back. This will revoke all access and sign you out permanently.</p>
      <div style="display:flex; justify-content:flex-start;">
        <button id="delete-account" class="btn btn--danger" style="background:#ef4444; border:none; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">${icon('trash', 16)} Delete Account & Sign Out</button>
      </div>
    </div>
  `;

  await renderAppLayout(
    container,
    '/profile',
    'Your Profile',
    'Manage your personal details and debate resume',
    content
  );

  // Wire Save Changes
  const saveBtn = container.querySelector('#save-profile');
  saveBtn.addEventListener('click', async () => {
    const newName = container.querySelector('#profile-name').value;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = 'Saving...';
    saveBtn.disabled = true;

    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName }
    });
    
    if (error) {
      alert(error.message);
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    } else {
      alert('Profile updated! Local session refreshing...');
      window.location.reload();
    }
  });

  // Wire Delete Account
  const deleteBtn = container.querySelector('#delete-account');
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Are you absolutely sure? This will sign you out and you will legacy-lose access to this account profile.')) {
      deleteBtn.innerHTML = 'Signing out...';
      deleteBtn.disabled = true;
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert(error.message);
        deleteBtn.innerHTML = 'Delete Account & Sign Out';
        deleteBtn.disabled = false;
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.hash = '/';
        window.location.reload();
      }
    }
  });
}
