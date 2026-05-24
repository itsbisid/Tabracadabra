import { supabase } from './supabase.js';

async function fetchMembershipRows(userId) {
  const primary = await supabase
    .from('tournament_memberships')
    .select('role, tournaments(*)')
    .eq('user_id', userId);

  if (!primary.error) return primary;

  return supabase
    .from('tournament_memberships')
    .select('role, tournament:tournaments(*)')
    .eq('user_id', userId);
}

export async function fetchUserTournaments(userId) {
  const { data: owned = [], error: ownedError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  const { data: memberships = [], error: membershipError } = await fetchMembershipRows(userId);
  const byId = new Map();

  owned.forEach((tournament) => {
    byId.set(tournament.id, { ...tournament, userRole: 'Director' });
  });

  memberships.forEach((membership) => {
    const tournament = membership.tournaments || membership.tournament;
    if (!tournament?.id) return;

    byId.set(tournament.id, {
      ...tournament,
      userRole: membership.role || byId.get(tournament.id)?.userRole || 'Member'
    });
  });

  return {
    data: Array.from(byId.values()).sort((a, b) => {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }),
    error: ownedError && membershipError ? ownedError : null
  };
}
