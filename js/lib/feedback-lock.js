import { supabase } from './supabase.js';

/**
 * Checks if a user (judge or team) is blocked from viewing the next round.
 */
export async function isFeedbackBlocked(userId, tournamentId, role) {
  // 1. Check if the tournament has bypassed the lock
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('bypass_feedback_lock')
    .eq('id', tournamentId)
    .single();
  
  if (tournament?.bypass_feedback_lock) return false;

  // 2. Identify the most recent COMPLETED round for this user
  // (where a ballot has been confirmed for their room)
  const { data: previousAssignments } = await supabase
    .from('draw_pairings')
    .select('*, rounds!inner(*)')
    .eq('rounds.tournament_id', tournamentId)
    .or(`chair_id.eq.${userId},og_team_id.eq.${userId},oo_team_id.eq.${userId},cg_team_id.eq.${userId},co_team_id.eq.${userId}`)
    .order('rounds(round_num)', { ascending: false });

  if (!previousAssignments || previousAssignments.length === 0) return false;

  // Find the latest pairing that HAD a ballot (meaning round is over)
  const latestFinishedPairing = previousAssignments.find(p => p.ballots && p.ballots.length > 0);
  if (!latestFinishedPairing) return false;

  // 3. Check if feedback exists for this pairing from this user
  const { data: feedback } = await supabase
    .from('judge_feedback')
    .select('id')
    .eq('pairing_id', latestFinishedPairing.id)
    .eq('submitted_by_id', userId)
    .limit(1);

  // If no feedback found, they are blocked!
  return (!feedback || feedback.length === 0);
}
