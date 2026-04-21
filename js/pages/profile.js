import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { currentUser } from '../data/mock-data.js';

export function renderProfile(container) {
  const content = `
    <div class="card mb-xl">
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; flex-shrink: 0;">
          ${currentUser.initials}
        </div>
        <div style="flex: 1;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 8px;">Account Details</h2>
          
          <div class="grid-2 mt-md">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" class="form-input" value="${currentUser.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (Read Only)</label>
              <input type="email" class="form-input" value="${currentUser.email}" readonly style="background:var(--color-bg); cursor:not-allowed;">
            </div>
            <div class="form-group">
              <label class="form-label">Primary Institution</label>
              <input type="text" class="form-input" value="Ashesi University">
            </div>
          </div>
          
          <button class="btn btn--primary mt-md">Save Changes</button>
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
        <div class="stat-card__value">12</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Total Rounds</span>
          <div class="stat-card__icon" style="background: var(--color-warning-bg); color: var(--color-warning)">${icon('list')}</div>
        </div>
        <div class="stat-card__value">54</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Avg Speaks</span>
          <div class="stat-card__icon" style="background: var(--color-success-bg); color: var(--color-success)">${icon('star')}</div>
        </div>
        <div class="stat-card__value">78.2</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">Breaks</span>
          <div class="stat-card__icon" style="background: var(--color-danger-bg); color: var(--color-danger)">${icon('award')}</div>
        </div>
        <div class="stat-card__value">4</div>
      </div>
    </div>

    <div class="card border-danger">
      <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; color: var(--color-danger);">Danger Zone</h3>
      <p class="text-muted mb-md">Once you delete your account, there is no going back. Please be certain.</p>
      <button class="btn btn--danger">Delete Account</button>
    </div>
  `;

  renderAppLayout(
    container,
    '/profile',
    'Your Profile',
    'Manage your personal details and debate resume',
    content
  );
}
