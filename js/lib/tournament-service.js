import { supabase } from './supabase.js';

function isMissingSchemaObject(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('schema cache') || message.includes('could not find');
}

async function fetchAllTournamentRows() {
  const ordered = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  if (!ordered.error) return ordered;

  return supabase
    .from('tournaments')
    .select('*');
}

async function fetchOwnedTournamentRows(userId) {
  const owned = await supabase
    .from('tournaments')
    .select('*')
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .order('created_at', { ascending: false });

  if (!owned.error) return owned;

  return supabase
    .from('tournaments')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
}

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
  const { data: owned, error: ownedError } = await fetchOwnedTournamentRows(userId);

  const { data: memberships, error: membershipError } = await fetchMembershipRows(userId);
  if (isMissingSchemaObject(ownedError) && isMissingSchemaObject(membershipError)) {
    const { data, error } = await fetchAllTournamentRows();
    return {
      data: (data || []).map((tournament) => ({ ...tournament, userRole: 'Director' })),
      error
    };
  }

  const byId = new Map();
  const ownedRows = Array.isArray(owned) ? owned : [];
  const membershipRows = Array.isArray(memberships) ? memberships : [];

  ownedRows.forEach((tournament) => {
    byId.set(tournament.id, {
      ...tournament,
      userRole: tournament.owner_id ? 'Director' : 'Unclaimed director'
    });
  });

  membershipRows.forEach((membership) => {
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
