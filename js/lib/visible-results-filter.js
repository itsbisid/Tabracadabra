export function filterVisibleStandingsBallots(ballots = [], pairings = [], rounds = []) {
  const roundById = new Map(rounds.map(round => [round.id, round]));
  const roundIdByPairing = new Map(pairings.map(pairing => [pairing.id, pairing.round_id]));

  return ballots.filter(ballot => {
    if (ballot.status && String(ballot.status).toUpperCase() !== 'LOCKED') return false;

    const roundId = roundIdByPairing.get(ballot.pairing_id);
    if (!roundId) return true;

    const round = roundById.get(roundId);
    if (!round) return true;

    const isBlind = round.is_blind !== false;
    return !isBlind || round.results_released === true;
  });
}
