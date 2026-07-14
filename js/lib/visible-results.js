import { supabase } from './supabase.js';
import { filterVisibleStandingsBallots } from './visible-results-filter.js';

export { filterVisibleStandingsBallots } from './visible-results-filter.js';

export async function fetchVisibleStandingsBallots(tournamentId) {
  const [ballotResult, pairingResult, roundResult] = await Promise.all([
    supabase.from('ballots').select('*').eq('tournament_id', tournamentId),
    supabase.from('draw_pairings').select('id,round_id').eq('tournament_id', tournamentId),
    supabase.from('rounds').select('id,is_blind,results_released').eq('tournament_id', tournamentId)
  ]);

  if (ballotResult.error) throw ballotResult.error;
  if (pairingResult.error) throw pairingResult.error;
  if (roundResult.error) throw roundResult.error;

  return filterVisibleStandingsBallots(
    ballotResult.data || [],
    pairingResult.data || [],
    roundResult.data || []
  );
}
