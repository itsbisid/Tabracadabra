import { supabase } from './supabase.js';
import { filterVisibleStandingsBallots } from './visible-results-filter.js';

export { filterVisibleStandingsBallots } from './visible-results-filter.js';

export async function fetchVisibleStandingsBallots(tournamentId, options = {}) {
  const ballotColumns = options.includeSpeakerScores === false
    ? 'id,tournament_id,pairing_id,team_id,points,status'
    : '*';
  const [ballotResult, pairingResult, roundResult] = await Promise.all([
    supabase.from('ballots').select(ballotColumns).eq('tournament_id', tournamentId),
    supabase.from('draw_pairings').select('id,round_id').eq('tournament_id', tournamentId),
    supabase.from('rounds').select('id,is_blind,results_released').eq('tournament_id', tournamentId)
  ]);

  if (ballotResult.error) throw ballotResult.error;
  if (pairingResult.error) throw pairingResult.error;
  if (roundResult.error) throw roundResult.error;

  const visible = filterVisibleStandingsBallots(
    ballotResult.data || [],
    pairingResult.data || [],
    roundResult.data || []
  );
  const roundByPairing = new Map((pairingResult.data || []).map(pairing => [pairing.id, pairing.round_id]));
  return visible.map(ballot => ({ ...ballot, round_id: roundByPairing.get(ballot.pairing_id) || null }));
}
