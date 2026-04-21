import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderAnnouncements(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  window.tcCreateAnnouncement = async () => {
    const title = prompt('Announcement Title:');
    if (!title) return;
    const content = prompt('Announcement Content:');
    if (!content) return;

    const { error } = await supabase
      .from('announcements')
      .insert([{ tournament_id: tournamentId, title, content }]);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      fetchAnnouncements();
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    renderUI(data || []);
  };

  const renderUI = (list) => {
    const announcementsHTML = list.length === 0
      ? `
        <div class="empty-state" style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:64px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">📢</div>
          <h3 style="font-weight:700; font-size:18px; margin-bottom:8px;">No announcements yet</h3>
          <p style="color:var(--color-text-muted); font-size:14px;">Broadcast important messages, delays, or updates to all participants.</p>
        </div>
      `
      : `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${list.map(a => `
            <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <div style="font-weight:700; font-size:16px;">${a.title}</div>
                <div style="font-size:12px; color:var(--color-text-muted);">${new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div style="font-size:14px; color:var(--color-text); line-height:1.5;">${a.content}</div>
            </div>
          `).join('')}
        </div>
      `;

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-weight:800; font-size:24px;">Announcements</h2>
        <button onclick="window.tcCreateAnnouncement()" class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">
          ${icon('plus', 16)} New Announcement
        </button>
      </div>
      ${announcementsHTML}
    `;

    renderAppLayout(
      container,
      '/tournament/announcements',
      'Announcements',
      'Broadcast messages to participants',
      content
    );
  };

  fetchAnnouncements();
}
