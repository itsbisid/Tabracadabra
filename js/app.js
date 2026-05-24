// TabraCadabra — Main App Router & Initializer
import '../style.css';
import { renderLogin } from './pages/login.js';
import { renderSignup } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderMyJourney } from './pages/my-journey.js';
import { renderCreateTournament } from './pages/create-tournament.js';
import { renderMyTournaments } from './pages/my-tournaments.js';
import { renderBrowseTournaments } from './pages/browse-tournaments.js';
import { renderProfile } from './pages/profile.js';
import { renderTournamentDashboard } from './pages/tournament/dashboard.js';
import { renderAnnouncements } from './pages/tournament/announcements.js';
import { renderChat } from './pages/tournament/chat.js';
import { renderVoiceRooms } from './pages/tournament/voice-rooms.js';
import { renderTeamLOC } from './pages/tournament/team-loc.js';
import { renderSettings } from './pages/tournament/settings.js';
import { renderDebateRounds } from './pages/tournament/debate-rounds.js';
import { renderMotions } from './pages/tournament/motions.js';
import { renderTeamBreak } from './pages/tournament/team-break.js';
import { renderPublish } from './pages/tournament/publish.js';
import { renderTeams } from './pages/tournament/teams.js';
import { renderRegistrationLinks } from './pages/tournament/registration-links.js';
import { renderAdjudicators } from './pages/tournament/adjudicators.js';
import { renderVenues } from './pages/tournament/venues.js';
import { renderSpeakerTab } from './pages/tournament/speaker-tab.js';
import { renderTeamStandings } from './pages/tournament/team-standings.js';
import { renderFeedback } from './pages/tournament/feedback.js';
import { renderAnalytics } from './pages/tournament/analytics.js';
import { supabase } from './lib/supabase.js';
import { signOut } from './lib/auth-utils.js';
import { getActiveTournamentId } from './lib/tournament-context.js';
import { renderPrivatePortal } from './pages/private-portal.js';

const routes = {
  '/': renderLogin,
  '/login': renderLogin,
  '/signup': renderSignup,
  '/dashboard': renderDashboard,
  '/my-journey': renderMyJourney,
  '/create-tournament': renderCreateTournament,
  '/my-tournaments': renderMyTournaments,
  '/tournaments': renderBrowseTournaments,
  '/profile': renderProfile,
  '/tournament/dashboard': renderTournamentDashboard,
  '/tournament/announcements': renderAnnouncements,
  '/tournament/chat': renderChat,
  '/tournament/voice-rooms': renderVoiceRooms,
  '/tournament/team-loc': renderTeamLOC,
  '/tournament/settings': renderSettings,
  '/tournament/debate-rounds': renderDebateRounds,
  '/tournament/motions': renderMotions,
  '/tournament/team-break': renderTeamBreak,
  '/tournament/publish': renderPublish,
  '/tournament/registration-links': renderRegistrationLinks,
  '/tournament/teams': renderTeams,
  '/tournament/adjudicators': renderAdjudicators,
  '/tournament/venues': renderVenues,
  '/tournament/speaker-tab': renderSpeakerTab,
  '/tournament/team-standings': renderTeamStandings,
  '/tournament/feedback': renderFeedback,
  '/tournament/analytics': renderAnalytics,
};

const publicRoutes = new Set(['/', '/login', '/signup', '/tournaments']);

function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  return hash;
}

function navigate(path) {
  window.location.hash = path;
}

async function router() {
  const path = getRoute();
  const routePath = path.split('?')[0];
  const app = document.getElementById('app');

  // Handle dynamic /reg/:token routes
  if (routePath.startsWith('/reg/')) {
    const token = path.split('/reg/')[1];
    import('./pages/public-registration.js').then(module => {
      app.innerHTML = '';
      module.renderPublicRegistration(app, token);
    });
    return;
  }

  if (routePath.startsWith('/portal/team/')) {
    app.innerHTML = '';
    renderPrivatePortal(app, 'team', routePath.split('/portal/team/')[1]);
    return;
  }

  if (routePath.startsWith('/portal/judge/')) {
    app.innerHTML = '';
    renderPrivatePortal(app, 'judge', routePath.split('/portal/judge/')[1]);
    return;
  }

  if (routePath.startsWith('/team/') && routePath.endsWith('/progress')) {
    const teamId = routePath.split('/')[2];
    app.innerHTML = '';
    renderPrivatePortal(app, 'team', teamId);
    return;
  }

  if (routePath === '/my-journey' && path.includes('?')) {
    const params = new URLSearchParams(path.split('?')[1]);
    const speakerId = params.get('speaker_id');
    const judgeId = params.get('judge_id');

    if (speakerId || judgeId) {
      app.innerHTML = '';
      renderPrivatePortal(app, speakerId ? 'team' : 'judge', speakerId || judgeId);
      return;
    }
  }

  const isAuthRedirect = path.includes('access_token=') || path.includes('error=');
  const isProtectedRoute = !publicRoutes.has(routePath) && !isAuthRedirect;

  if (isProtectedRoute) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/');
      return;
    }
  }

  if (routePath.startsWith('/tournament/') && !getActiveTournamentId()) {
    navigate('/my-tournaments');
    return;
  }

  const render = routes[routePath];
  if (render) {
    app.innerHTML = '';
    render(app, navigate);
  } else if (path.includes('access_token=') || path.includes('error=')) {
    // Handle Supabase Auth Redirects that might strip the hash
    navigate('/dashboard');
  } else {
    // Redirect unknown paths to landing instead of showing 404
    navigate('/');
  }

  // Close any open modals
  document.getElementById('modal-root').innerHTML = '';
}

// Global navigate function
window.tcNavigate = navigate;
window.tcSignOut = signOut;

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
// HMR trigger
