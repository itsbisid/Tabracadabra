import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { getCurrentUser } from '../lib/auth-utils.js';
import { clearActiveTournamentId, getActiveTournamentId, setActiveTournamentId } from '../lib/tournament-context.js';
import { deleteTournament, fetchUserTournaments } from '../lib/tournament-service.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export async function renderMyTournaments(container) {
  const user = await getCurrentUser();
  if (!user) {
    window.tcNavigate('/');
    return;
  }

  const fetchTournaments = async () => {
    const { data, error } = await fetchUserTournaments(user.id);

    if (error) {
      console.error('Error fetching:', error);
      renderUI([]);
    } else {
      renderUI(data || []);
    }
  };

  window.tcSelectTournament = (id) => {
    setActiveTournamentId(id);
    window.tcNavigate('/tournament/dashboard');
  };

  window.tcDeleteTournamentFromList = async (event, id, name) => {
    event.stopPropagation();
    const confirmed = confirm(`Delete "${name}" permanently? This removes only this tournament and its data. Your account and other tournaments will remain active.`);
    if (!confirmed) return;

    const button = event.currentTarget;
    const originalText = button.innerHTML;
    button.innerHTML = 'Deleting...';
    button.disabled = true;

    try {
      await deleteTournament(id);
      if (getActiveTournamentId() === id) clearActiveTournamentId();
      alert(`"${name}" was deleted. Your account and other tournaments are unchanged.`);
      await fetchTournaments();
    } catch (error) {
      alert(error.message || 'Could not delete this tournament.');
      button.innerHTML = originalText;
      button.disabled = false;
    }
  };

  const renderUI = (tournaments) => {
    const tournamentCards = tournaments.map(t => {
      let badgeClass = 'badge--draft';
      if (t.status === 'active') badgeClass = 'badge--active';
      if (t.status === 'completed') badgeClass = 'badge--completed';
      const canDelete = ['director', 'unclaimed director', 'convenor', 'tab_director', 'deputy_convenor'].includes(String(t.userRole || '').toLowerCase());
      const displayName = t.short_name || t.name || 'Untitled tournament';
      
      return `
        <div class="tournament-card" onclick="window.tcSelectTournament('${t.id}')">
          <div class="tournament-card__header">
            <div class="tournament-card__name">${escapeHtml(displayName)}</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${badgeClass}">${escapeHtml((t.status || 'draft').toUpperCase())}</span>
              ${canDelete ? `
                <button
                  type="button"
                  title="Delete tournament"
                  aria-label="Delete ${escapeHtml(displayName)}"
                  onclick="window.tcDeleteTournamentFromList(event, '${escapeJsString(t.id)}', '${escapeJsString(displayName)}')"
                  style="width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #fecaca; border-radius:8px; color:#dc2626; background:#fff5f5; cursor:pointer;"
                >${icon('trash', 16)}</button>
              ` : ''}
            </div>
          </div>
          <div class="tournament-card__meta">
            <div class="tournament-card__meta-item">
              ${icon('calendar', 14)} ${escapeHtml(t.start_date || 'TBD')}
            </div>
            <div class="tournament-card__meta-item">
              <span class="badge badge--role">${escapeHtml(t.userRole || 'Member')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const content = `
      <div class="mb-xl" style="display: flex; gap: 16px;">
        <div style="flex:1; position:relative;">
          <div style="position:absolute; left:12px; top:12px; color:var(--color-text-light);">
            ${icon('search', 20)}
          </div>
          <input type="text" class="form-input" placeholder="Search your tournaments..." style="padding-left: 40px;">
        </div>
      </div>

      ${tournaments.length > 0 ? `
        <div class="grid-3">
          ${tournamentCards}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state__icon">🏆</div>
          <h3 class="empty-state__title">No tournaments yet</h3>
          <p class="empty-state__text">You aren't participating in or managing any tournaments right now.</p>
          <div class="flex gap-md mt-lg">
            <button class="btn btn--primary" onclick="window.tcNavigate('/create-tournament')">Create Tournament</button>
          </div>
        </div>
      `}
    `;

    renderAppLayout(
      container,
      '/my-tournaments',
      'My Tournaments',
      'Tournaments you are organizing, judging, or speaking in',
      content
    );
  };

  fetchTournaments();
}
