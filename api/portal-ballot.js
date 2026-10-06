import {
  assertCanAccessPairing,
  collectBody,
  fetchPairingBundle,
  selectRows,
  sendJson,
  upsertRows,
  validateTokenProfile,
  verifyPortalToken
} from '../api-shared/portal-utils.js';
import { debateScoringFor, speakerScore } from '../api-shared/debate-scoring.js';

// Speaker scores follow the tournament's debate scoring settings (legacy tournaments: 60–80).
function validateBallotRows(pairing, rows, scoring) {
  const teamIds = [pairing.og_team_id, pairing.oo_team_id, pairing.cg_team_id, pairing.co_team_id].filter(Boolean);
  if (!Array.isArray(rows) || rows.length !== teamIds.length) {
    throw new Error('A complete ballot is required for every team in the room.');
  }

  const ranks = rows.map(row => Number(row.rank));
  if (new Set(ranks).size !== rows.length || ranks.some(rank => rank < 1 || rank > 4)) {
    throw new Error('Each team must have a unique rank from 1 to 4.');
  }

  rows.forEach(row => {
    if (!teamIds.includes(row.team_id)) throw new Error('Ballot contains a team outside this room.');
    row.s1_points = speakerScore(scoring, { total: row.s1_points, marks: row.s1_marks }, 'Speaker 1');
    row.s2_points = speakerScore(scoring, { total: row.s2_points, marks: row.s2_marks }, 'Speaker 2');
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = JSON.parse(await collectBody(request));
    const tokenData = verifyPortalToken(payload.token);
    await validateTokenProfile(tokenData);
    if (tokenData.role !== 'judge') throw new Error('Only an adjudicator can submit a ballot.');

    const { pairing, round, ballots: existingBallots, allocations } = await fetchPairingBundle(payload.pairingId);
    const judgeRole = assertCanAccessPairing({ tokenData, pairing, allocations });
    if (judgeRole !== 'CHAIR') throw new Error('Only the chair for this room can submit the ballot.');
    if (round?.status !== 'Released') throw new Error('Ballots can only be submitted after the draw is released.');
    if ((existingBallots || []).some(ballot => ballot.status === 'LOCKED')) {
      throw new Error('A confirmed ballot already exists for this room. Ask the tab room to unlock it before resubmitting.');
    }

    const [tournament] = await selectRows('tournaments', `?id=eq.${encodeURIComponent(pairing.tournament_id)}&select=settings`);
    validateBallotRows(pairing, payload.ballots, debateScoringFor(tournament?.settings));
    const ballots = payload.ballots.map(row => {
      const rank = Number(row.rank);
      const s1 = Number(row.s1_points);
      const s2 = Number(row.s2_points);
      return {
        tournament_id: pairing.tournament_id,
        pairing_id: pairing.id,
        team_id: row.team_id,
        rank,
        points: 4 - rank,
        s1_points: s1,
        s2_points: s2,
        speaker_points: s1 + s2,
        status: 'LOCKED',
        submitted_by_id: tokenData.id,
        submitted_at: new Date().toISOString()
      };
    });

    await upsertRows('ballots', ballots, 'pairing_id,team_id');
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not submit ballot.' });
  }
}
