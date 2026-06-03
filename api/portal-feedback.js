import {
  assertCanAccessPairing,
  collectBody,
  feedbackTargetsForParticipant,
  fetchPairingBundle,
  insertRows,
  sendJson,
  validateTokenProfile,
  verifyPortalToken
} from './portal-utils.js';

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

    const { pairing, ballots, allocations } = await fetchPairingBundle(payload.pairingId);
    const participantRole = assertCanAccessPairing({ tokenData, pairing, allocations });
    if (!ballots.length) throw new Error('Feedback opens after the ballot has been confirmed.');

    const targets = feedbackTargetsForParticipant({
      role: tokenData.role,
      participantId: tokenData.id,
      pairing,
      allocations
    });
    if (!targets.some(target => target.targetId === payload.targetId)) {
      throw new Error('That feedback target is not valid for this participant.');
    }

    const score = Number(payload.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      throw new Error('Feedback score must be between 1 and 10.');
    }

    await insertRows('judge_feedback', [{
      tournament_id: pairing.tournament_id,
      pairing_id: pairing.id,
      submitted_by_id: tokenData.id,
      submitted_role: participantRole,
      target_judge_id: payload.targetId,
      score,
      comments: payload.comments || null
    }]);

    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not submit feedback.' });
  }
}
