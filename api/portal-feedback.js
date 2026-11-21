import {
  assertCanAccessPairing,
  collectBody,
  feedbackTargetsForParticipant,
  fetchPairingBundle,
  insertRows,
  selectRows,
  sendJson,
  validateTokenProfile,
  verifyPortalToken
} from '../api-shared/portal-utils.js';

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

    const { pairing, round, ballots, allocations } = await fetchPairingBundle(payload.pairingId);
    const participantRole = assertCanAccessPairing({ tokenData, pairing, allocations });
    if (!ballots.length && String(round?.status || '').toLowerCase() !== 'completed') {
      throw new Error('Feedback opens after the ballot is confirmed or the round is completed.');
    }

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

    const existing = await selectRows(
      'judge_feedback',
      `?pairing_id=eq.${encodeURIComponent(pairing.id)}&submitted_by_id=eq.${encodeURIComponent(tokenData.id)}&target_judge_id=eq.${encodeURIComponent(payload.targetId)}&select=id`
    );
    if (existing.length) {
      throw new Error('Feedback has already been submitted for this judge.');
    }

    const feedbackRow = {
      tournament_id: pairing.tournament_id,
      pairing_id: pairing.id,
      submitted_by_id: tokenData.id,
      submitted_role: participantRole,
      target_judge_id: payload.targetId,
      score,
      comments: payload.comments || null,
      is_anonymous: Boolean(payload.anonymous)
    };

    try {
      await insertRows('judge_feedback', [feedbackRow]);
    } catch (insertError) {
      const message = String(insertError?.message || '');
      const staleAnonymousColumn = message.includes('is_anonymous') && message.toLowerCase().includes('schema cache');
      if (!staleAnonymousColumn) throw insertError;

      // Backward compatibility while older tournaments receive the schema migration.
      // Preserve the anonymity choice in a machine-readable marker instead of failing submission.
      const { is_anonymous: _unused, ...legacyRow } = feedbackRow;
      legacyRow.comments = payload.anonymous
        ? `[[ANONYMOUS]]${legacyRow.comments ? `\n${legacyRow.comments}` : ''}`
        : legacyRow.comments;
      await insertRows('judge_feedback', [legacyRow]);
    }

    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not submit feedback.' });
  }
}
