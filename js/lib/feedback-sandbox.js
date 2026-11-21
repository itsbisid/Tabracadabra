const STORAGE_KEY = 'tc_feedback_sandbox_v1';

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export function loadFeedbackSandbox() {
  const sandbox = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!sandbox) return null;
  if (Date.now() >= new Date(sandbox.expiresAt).getTime()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return sandbox;
}

export function saveFeedbackSandbox(sandbox) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sandbox));
  return sandbox;
}

export function deleteFeedbackSandbox() {
  localStorage.removeItem(STORAGE_KEY);
}

export function createFeedbackSandbox(tournamentId) {
  const id = globalThis.crypto?.randomUUID?.() || `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return saveFeedbackSandbox({
    id,
    tournamentId,
    testOnly: true,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    speaker: { id: `speaker-${id}`, name: 'TEST Speaker', team: 'TEST ONLY Demo Team', institution: 'Sandbox Institution' },
    round: {
      id: `round-${id}`,
      name: 'TEST ONLY Mock Round',
      room: 'TEST ONLY Room',
      motion: 'This House would prioritize preventive public health over curative healthcare.',
      position: 'Opening Government',
      opponents: ['TEST OO', 'TEST CG', 'TEST CO']
    },
    judges: [
      { id: `judge-chair-${id}`, name: 'TEST Judge Ama', role: 'Chair', adminEvaluation: 7.5, roundsJudged: 3, chairRounds: 2 },
      { id: `judge-wing-${id}`, name: 'TEST Judge Kojo', role: 'Wing', adminEvaluation: 6.8, roundsJudged: 2, chairRounds: 0 },
      { id: `judge-trainee-${id}`, name: 'TEST Judge Sena', role: 'Trainee', adminEvaluation: 6.0, roundsJudged: 1, chairRounds: 0 }
    ],
    feedback: []
  });
}

export function feedbackSandboxUrl(sandbox) {
  return `${window.location.origin}/#/sandbox/speaker-feedback/${sandbox.id}`;
}

export function calculateSandboxBreak(judge, feedback) {
  const scores = feedback.filter(item => item.judgeId === judge.id).map(item => Number(item.rating)).sort((a, b) => a - b);
  const robust = scores.length >= 5 ? scores.slice(1, -1) : scores;
  const average = robust.length ? robust.reduce((sum, score) => sum + score, 0) / robust.length : null;
  const adjustedAverage = average == null ? 5.5 : ((average * robust.length) + 11) / (robust.length + 2);
  const volumeScore = Math.min(10, judge.roundsJudged * 2);
  const panelRounds = Math.max(0, judge.roundsJudged - judge.chairRounds);
  const experienceScore = judge.roundsJudged ? Math.min(10, ((judge.chairRounds * 2 + panelRounds) / judge.roundsJudged) * 5) : 0;
  const score = (adjustedAverage * 0.5) + (volumeScore * 0.15) + (experienceScore * 0.15) + (judge.adminEvaluation * 0.2);
  return { average, adjustedAverage, volumeScore, experienceScore, score, count: scores.length };
}
