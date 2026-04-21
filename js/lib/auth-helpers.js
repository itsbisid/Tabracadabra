import { supabase } from './supabase.js';

/**
 * Roles Enum
 */
export const ROLES = {
  TAB_DIRECTOR: 'TAB_DIRECTOR',
  CONVENOR: 'CONVENOR',
  ADJUDICATOR: 'ADJUDICATOR',
  PARTICIPANT: 'PARTICIPANT'
};

/**
 * Checks the current user's role in a specific tournament
 */
export async function getTournamentRole(tournamentId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('tournament_memberships')
    .select('role')
    .eq('tournament_id', tournamentId)
    .eq('user_id', session.user.id)
    .single();

  if (error || !data) return null;
  return data.role;
}

/**
 * Checks if the current user has administrative permissions
 */
export async function isAdmin(tournamentId) {
  const role = await getTournamentRole(tournamentId);
  return role === ROLES.TAB_DIRECTOR || role === ROLES.CONVENOR;
}

/**
 * Checks if the tab is visible to the public/participants
 */
export async function isTabVisible(tournamentId) {
  // Check if tab is published
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('is_tab_released')
    .eq('id', tournamentId)
    .single();

  if (tournament?.is_tab_released) return true;

  // Otherwise, only admins can see it
  return await isAdmin(tournamentId);
}
