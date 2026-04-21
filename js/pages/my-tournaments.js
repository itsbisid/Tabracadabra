import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';

export async function renderMyTournaments(container) {
  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching:', error);
      renderUI([]);
    } else {
      renderUI(data || []);
    }
  };

  window.tcSelectTournament = (id) => {
    localStorage.setItem('active_tournament_id', id);
    window.tcNavigate('/tournament/dashboard');
  };

  const renderUI = (tournaments) => {
    const tournamentCards = tournaments.map(t => {
      let badgeClass = 'badge--draft';
      if (t.status === 'active') badgeClass = 'badge--active';
      if (t.status === 'completed') badgeClass = 'badge--completed';
      
      return `
        <div class="tournament-card" onclick="window.tcSelectTournament('${t.id}')">
          <div class="tournament-card__header">
            <div class="tournament-card__name">${t.short_name || t.name}</div>
            <span class="badge ${badgeClass}">${(t.status || 'draft').toUpperCase()}</span>
          </div>
          <div class="tournament-card__meta">
            <div class="tournament-card__meta-item">
              ${icon('calendar', 14)} ${t.start_date || 'TBD'}
            </div>
            <div class="tournament-card__meta-item">
              <span class="badge badge--role">Director</span>
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
