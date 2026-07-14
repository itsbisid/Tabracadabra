import { escapeHtml } from './html.js';

export const DEFAULT_TEAM_EMOJI = '⭐';

export function getTeamEmoji(team) {
  const emoji = String(team?.emoji || '').trim();
  return emoji || DEFAULT_TEAM_EMOJI;
}

export function getTeamName(team) {
  return String(team?.name || 'Unnamed team');
}

export function teamLabelText(team) {
  return `${getTeamEmoji(team)} ${getTeamName(team)}`;
}

export function teamLabelHtml(team) {
  return `<span class="google-emoji" aria-hidden="true">${escapeHtml(getTeamEmoji(team))}</span> ${escapeHtml(getTeamName(team))}`;
}

export function teamLabelFromMap(teamMap, teamId) {
  const team = teamMap.get(teamId);
  if (!team) return escapeHtml(teamId || 'TBD');
  return teamLabelHtml(team);
}
