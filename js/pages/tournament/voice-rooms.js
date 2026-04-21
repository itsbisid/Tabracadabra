import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderVoiceRooms(container) {
  const tournamentId = localStorage.getItem('active_tournament_id');
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name, short_name')
    .eq('id', tournamentId)
    .single();

  const standardRooms = [
    { name: 'General Assembly', desc: 'Main hall for announcements and social gathering', icon: 'mic' },
    { name: 'Tab Office', desc: 'Direct support for directors and adjudicators', icon: 'shield' },
    { name: 'Social Lounge', desc: 'Casual hangout between rounds', icon: 'coffee' }
  ];

  const roomsHtml = standardRooms.map(r => `
    <div class="voice-card">
      <div class="voice-card__left">
        <div class="voice-card__icon bg-gray-100 rounded-md" style="padding: 10px; background: #f1f5f9; border-radius: 8px; color: var(--color-primary);">${icon(r.icon, 20)}</div>
        <div style="margin-left: 12px;">
          <div class="voice-card__name" style="font-weight: 700; font-size: 14px;">${r.name}</div>
          <div class="voice-card__desc" style="font-size: 12px; color: var(--color-text-muted);">${r.desc}</div>
        </div>
      </div>
      <button class="btn btn--outline btn--sm" style="font-size: 12px; padding: 6px 12px; height: auto;">${icon('phone', 14)} Join</button>
    </div>
  `).join('');

  const content = `
    <div style="margin-top: 12px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 16px;">General Tournament Rooms</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
        ${roomsHtml}
        </div>

        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 16px;">Active Round Rooms</h3>
        <div style="background: white; border: 1px solid var(--color-border); border-radius: 12px; padding: 48px; text-align: center; border: 1px dashed var(--color-border-strong);">
        <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🎧</div>
        <h3 style="font-weight: 700; margin-bottom: 8px;">No active debate rounds</h3>
        <p style="color: var(--color-text-muted); font-size: 14px;">Individual debate rooms will appear here automatically when a round is live.</p>
        </div>
    </div>
  `;

  renderAppLayout(
    container,
    '/tournament/voice-rooms',
    'Voice Rooms',
    tournament?.short_name || tournament?.name || 'Tournament Infrastructure',
    content
  );
}
