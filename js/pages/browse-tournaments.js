import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';

export async function renderBrowseTournaments(container) {
  container.className = 'layout-public anim-fade-in';
  
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  const tournamentCards = (tournaments || []).map(t => {
    let badgeClass = 'badge--draft';
    if (t.status === 'active' || t.status === 'registration') badgeClass = 'badge--active';
    if (t.status === 'completed') badgeClass = 'badge--completed';
    
    return `
      <div class="tournament-card" onclick="tcNavigate('/login')">
        <div class="tournament-card__header">
          <div class="tournament-card__name">${t.short_name || t.name}</div>
          <span class="badge ${badgeClass}">${(t.status || 'draft').toUpperCase()}</span>
        </div>
        <div class="tournament-card__meta">
          <div class="tournament-card__meta-item">
            ${icon('calendar', 14)} ${t.start_date || 'TBD'}
          </div>
          <div class="tournament-card__meta-item">
            ${icon('mapPin', 14)} ${t.location || 'Online'}
          </div>
        </div>
        <div style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 16px; min-height: 40px;">
          ${t.description || 'No description provided.'}
        </div>
        <div style="display:flex; gap: 16px; border-top: 1px solid var(--color-border); padding-top: 12px; font-size: 12px; color: var(--color-text-muted);">
          <div style="display:flex; align-items:center; gap: 4px;">
            ${icon('users', 14)} BP Debate
          </div>
          <div style="display:flex; align-items:center; gap: 4px;">
            ${icon('fileText', 14)} 15m Prep
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <header class="landing-header">
      <div class="landing-header__logo" style="cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="tcNavigate('/')">
        <div class="sidebar__logo-icon" style="color:#0F2B5B; width:32px; height:32px;">${icon('logo', 32)}</div>
        <div class="landing-header__logo-text" style="color:#0F2B5B; font-family: 'Poppins', sans-serif; text-transform: lowercase; font-size: 24px; font-weight: 500; letter-spacing: -0.5px;">tabracadabra</div>
      </div>
      <nav class="landing-header__nav">
        <a href="#/login" class="landing-header__nav-link landing-header__nav-link--login">Log in</a>
        <a href="#/signup" class="landing-header__nav-link landing-header__nav-link--signup">Sign up</a>
      </nav>
    </header>

    <main class="anim-stagger" style="max-width: 1000px; margin: 0 auto; padding: 40px 24px;">
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">Explore Tournaments</h1>
        <p class="text-muted">Find and register for debate tournaments happening globally.</p>
      </div>

      <div style="display: flex; gap: 16px; margin-bottom: 32px;">
        <div style="flex:1; position:relative;">
          <div style="position:absolute; left:12px; top:12px; color:var(--color-text-light);">
            ${icon('search', 20)}
          </div>
          <input type="text" class="form-input" placeholder="Search by name, location..." style="padding-left: 40px;">
        </div>
        <select class="form-input form-select" style="width: auto; padding-right: 36px;">
          <option>All Statuses</option>
          <option>Active</option>
          <option>Registration Open</option>
          <option>Completed</option>
        </select>
        <button class="btn btn--primary">Search</button>
      </div>

      <div class="grid-2">
        ${tournaments?.length > 0 ? tournamentCards : `
          <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background: #f9fafb; border-radius: 12px; border: 1px dashed var(--color-border-strong);">
            <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
            <h3 style="font-size:18px; margin-bottom:8px;">No tournaments found</h3>
            <p style="color:var(--color-text-muted);">TabraCadabra is waiting for the first events of the season.</p>
          </div>
        `}
      </div>
    </main>
  `;
}
