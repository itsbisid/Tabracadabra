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
 * Roles that grant administrative permissions. Includes the legacy/display
 * variants ('Director', 'Convenor') actually written by create-tournament,
 * matched case-insensitively so both vocabularies are accepted.
 */
const ADMIN_ROLE_NAMES = new Set(['tab_director', 'convenor', 'director', 'deputy_convenor']);

function isAdminRole(role) {
  return ADMIN_ROLE_NAMES.has(String(role || '').trim().toLowerCase());
}

/**
 * Checks if the current user has administrative permissions.
 * The tournament owner is always an admin, regardless of membership role.
 */
export async function isAdmin(tournamentId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('owner_id')
    .eq('id', tournamentId)
    .single();
  if (tournament?.owner_id && tournament.owner_id === session.user.id) return true;

  const role = await getTournamentRole(tournamentId);
  return isAdminRole(role);
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
