export function getActiveTournamentId() {
  return localStorage.getItem('active_tournament_id');
}

export function setActiveTournamentId(tournamentId) {
  if (tournamentId) {
    localStorage.setItem('active_tournament_id', tournamentId);
  }
}

export function clearActiveTournamentId() {
  localStorage.removeItem('active_tournament_id');
}

export function requireActiveTournamentId() {
  const tournamentId = getActiveTournamentId();
  if (tournamentId) return tournamentId;

  if (typeof window !== 'undefined') {
    window.tcNavigate?.('/my-tournaments');
  }

  return null;
}
