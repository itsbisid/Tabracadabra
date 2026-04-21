import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderVoiceRooms(container) {
  const roomsHtml = tournamentDetail.voiceRooms.map(r => `
    <div class="voice-card">
      <div class="voice-card__left">
        <div class="voice-card__icon bg-gray-100 rounded-md">${icon(r.icon)}</div>
        <div>
          <div class="voice-card__name">${r.name}</div>
          <div class="voice-card__desc">${r.desc}</div>
        </div>
      </div>
      <button class="btn btn--outline btn--sm">${icon('mic', 14)} Join</button>
    </div>
  `).join('');

  const content = `
    <h3 class="font-bold mb-md mt-sm">General Rooms</h3>
    <div class="grid-2 mb-xl">
      ${roomsHtml}
    </div>

    <h3 class="font-bold mb-md">Debate Rooms</h3>
    <div class="empty-state">
      <div class="empty-state__icon">🎧</div>
      <h3 class="empty-state__title">No active debate rooms</h3>
      <p class="empty-state__text">Voice rooms for individual debates will appear here automatically when a round draw is released and doors are open.</p>
    </div>
  `;

  renderAppLayout(
    container,
    '/tournament/voice-rooms',
    'Voice Rooms',
    'Jitsi-powered voice/video channels',
    content
  );
}
