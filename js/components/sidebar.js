export function createSidebar(activePath, user) {
  const isTournament = activePath.startsWith('/tournament/') && activePath !== '/tournaments';
  
  if (isTournament) {
    return createTournamentSidebar(activePath, user);
  }
  return createMainSidebar(activePath, user);
}

function createMainSidebar(activePath, user) {
  const initials = user?.initials || 'U';
  const name = user?.name || 'User';
  const email = user?.email || '';
  return `
    <aside class="sidebar">
      <div class="sidebar__logo">
        <div class="sidebar__logo-icon" style="color:#0F2B5B; width: 32px; height: 32px;">${icon('logo', 32)}</div>
        <div class="sidebar__logo-text" style="color:#0F2B5B; font-family: 'Poppins', sans-serif; text-transform: lowercase; font-size: 20px; font-weight: 500; letter-spacing: -0.5px;">tabracadabra</div>
      </div>
      
      <div class="sidebar__section">
        <div class="sidebar__section-title">Main</div>
        <a href="#/dashboard" class="sidebar__link ${activePath === '/dashboard' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('dashboard')}</span>
          Dashboard
        </a>
        <a href="#/my-journey" class="sidebar__link ${activePath === '/my-journey' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('journey')}</span>
          My journey
        </a>
        <a href="#/create-tournament" class="sidebar__link ${activePath === '/create-tournament' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('plus')}</span>
          Create Tournament
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Participate</div>
        <a href="#/my-tournaments" class="sidebar__link ${activePath === '/my-tournaments' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('trophy')}</span>
          My Tournaments
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Discover</div>
        <a href="#/tournaments" class="sidebar__link ${activePath === '/tournaments' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('browse')}</span>
          Browse Tournaments
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Account</div>
        <a href="#/profile" class="sidebar__link ${activePath === '/profile' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('user')}</span>
          Profile
        </a>
      </div>

      <div class="sidebar__user">
        <div class="sidebar__user-info">
          <div class="sidebar__user-avatar">${initials}</div>
          <div>
            <div class="sidebar__user-name">${name}</div>
            <div class="sidebar__user-email">${email}</div>
          </div>
        </div>
        <a href="#/" class="sidebar__signout">
          <span class="sidebar__link-icon">${icon('signout')}</span>
          Sign out
        </a>
      </div>
    </aside>
  `;
}

function createTournamentSidebar(activePath) {
  // Extract tournament from path or use generic
  return `
    <aside class="sidebar">
      <div class="sidebar__logo" style="padding: 16px;">
        <a href="#/dashboard" style="display:flex; align-items:center; gap:8px; color:var(--color-text-muted); font-size:14px; font-weight:500;">
          ${icon('arrowLeft')} Back to Dashboard
        </a>
      </div>
      
      <div style="padding: 16px; border-bottom: 1px solid var(--color-border);">
        <div style="font-weight:700; font-size:16px;">KDO26</div>
        <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">Kumasi Debate Open</div>
        <span class="badge badge--active">ACTIVE</span>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Overview</div>
        <a href="#/tournament/dashboard" class="sidebar__link ${activePath === '/tournament/dashboard' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('dashboard')}</span> Dashboard
        </a>
        <a href="#/tournament/announcements" class="sidebar__link ${activePath === '/tournament/announcements' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('megaphone')}</span> Announcements
        </a>
        <a href="#/tournament/chat" class="sidebar__link ${activePath === '/tournament/chat' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('chat')}</span> Chat
        </a>
        <a href="#/tournament/voice-rooms" class="sidebar__link ${activePath === '/tournament/voice-rooms' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('mic')}</span> Voice Rooms
        </a>
        <a href="#/tournament/team-loc" class="sidebar__link ${activePath === '/tournament/team-loc' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('shield')}</span> Team / LOC
        </a>
        <a href="#/tournament/settings" class="sidebar__link ${activePath === '/tournament/settings' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('settings')}</span> Settings
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Debating</div>
        <a href="#/tournament/debate-rounds" class="sidebar__link ${activePath === '/tournament/debate-rounds' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('list')}</span> Debate rounds
        </a>
        <a href="#/tournament/motions" class="sidebar__link ${activePath === '/tournament/motions' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('fileText')}</span> Motions
        </a>
        <a href="#/tournament/team-break" class="sidebar__link ${activePath === '/tournament/team-break' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('award')}</span> Team break
        </a>
        <a href="#/tournament/publish" class="sidebar__link ${activePath === '/tournament/publish' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('share')}</span> Publish & Live URL
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Participants</div>
        <a href="#/tournament/teams" class="sidebar__link ${activePath === '/tournament/teams' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('users')}</span> Teams
        </a>
        <a href="#/tournament/adjudicators" class="sidebar__link ${activePath === '/tournament/adjudicators' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('user')}</span> Adjudicators
        </a>
        <a href="#/tournament/venues" class="sidebar__link ${activePath === '/tournament/venues' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('mapPin')}</span> Venues
        </a>
      </div>
      
      <div class="sidebar__section">
        <div class="sidebar__section-title">Debating Results</div>
        <a href="#/tournament/speaker-tab" class="sidebar__link ${activePath === '/tournament/speaker-tab' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('barChart')}</span> Speaker tab
        </a>
        <a href="#/tournament/team-standings" class="sidebar__link ${activePath === '/tournament/team-standings' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('list')}</span> Team standings
        </a>
      </div>

      <div class="sidebar__section">
        <div class="sidebar__section-title">Insights</div>
        <a href="#/tournament/feedback" class="sidebar__link ${activePath === '/tournament/feedback' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('messageSquare')}</span> Feedback overview
        </a>
        <a href="#/tournament/analytics" class="sidebar__link ${activePath === '/tournament/analytics' ? 'active' : ''}">
          <span class="sidebar__link-icon">${icon('barChart')}</span> Analytics
        </a>
      </div>
      
      <div class="sidebar__section">
        <div class="sidebar__section-title">Safety</div>
        <a href="javascript:void(0)" onclick="alert('Opening support request...')" class="sidebar__link">
          <span class="sidebar__link-icon">${icon('alertCircle')}</span> Report an Issue
        </a>
      </div>
      
      <div style="height:40px;"></div>
    </aside>
  `;
}
