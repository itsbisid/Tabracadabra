import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { getCurrentUser } from '../lib/auth-utils.js';
import { supabase } from '../lib/supabase.js';

export async function renderProfile(container) {
  const user = await getCurrentUser();
  
  // Real-time stat fetching
  const { count: tournamentCount } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true });

  const { count: roundCount } = await supabase
    .from('ballots')
    .select('*', { count: 'exact', head: true });

  const content = `
    <div class="card mb-xl">
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; flex-shrink: 0;">
          ${user.initials}
        </div>
        <div style="flex: 1;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 8px;">Account Details</h2>
          
          <div class="grid-2 mt-md">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="profile-name" class="form-input" value="${user.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (Read Only)</label>
              <input type="email" class="form-input" value="${user.email}" readonly style="background:var(--color-bg); cursor:not-allowed;">
            </div>
          </div>
          
          <button id="save-profile" class="btn btn--primary mt-md">Save Changes</button>
        </div>
      </div>
    </div>

    <h2 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px;">Debating Resume</h2>
    <div class="grid-4 mb-xl">
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Tournaments</span>
          <div class="stat-card__icon" style="background: var(--color-info-bg); color: var(--color-info)">${icon('trophy')}</div>
        </div>
        <div class="stat-card__value">${tournamentCount || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Total Rounds</span>
          <div class="stat-card__icon" style="background: var(--color-warning-bg); color: var(--color-warning)">${icon('list')}</div>
        </div>
        <div class="stat-card__value">${roundCount || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Avg Speaks</span>
          <div class="stat-card__icon" style="background: var(--color-success-bg); color: var(--color-success)">${icon('star')}</div>
        </div>
        <div class="stat-card__value">0.0</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Breaks</span>
          <div class="stat-card__icon" style="background: var(--color-danger-bg); color: var(--color-danger)">${icon('award')}</div>
        </div>
        <div class="stat-card__value">0</div>
      </div>
    </div>

    <div class="card border-danger">
      <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; color: var(--color-danger);">Danger Zone</h3>
      <p class="text-muted mb-md">Once you delete your account, there is no going back. Please be certain.</p>
      <button id="delete-account" class="btn btn--danger">Delete Account</button>
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
    saveBtn.innerHTML = 'Saving...';
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName }
    });
    
    if (error) {
      alert(error.message);
    } else {
      alert('Profile updated! Refreshing...');
      window.location.reload();
    }
  });

  // Wire Delete Account
  const deleteBtn = container.querySelector('#delete-account');
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Are you absolutely sure? This will delete your account and all associated data.')) {
      deleteBtn.innerHTML = 'Deleting...';
      const { error } = await supabase.auth.signOut();
      if (!error) {
        alert('Account deleted. Redirecting...');
        window.location.hash = '/';
      }
    }
  });
}
