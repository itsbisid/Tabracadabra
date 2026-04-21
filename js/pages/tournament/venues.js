import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderVenues(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  window.tcAddVenue = async () => {
    const name = prompt('Venue Name (e.g. Room 101):');
    if (!name) return;

    const { error } = await supabase
      .from('venues')
      .insert([{ tournament_id: tournamentId, name }]);
    
    if (error) alert(error.message);
    else fetchVenues();
  };

  window.tcDeleteVenue = async (id) => {
    if (confirm('Remove this venue?')) {
      await supabase.from('venues').delete().eq('id', id);
      fetchVenues();
    }
  };

  const fetchVenues = async () => {
    const { data } = await supabase
      .from('venues')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true });

    renderUI(data || []);
  };

  const renderUI = (list) => {
    const venuesHTML = list.length === 0
      ? `
        <div style="min-height:300px; background:white; border:1px solid var(--color-border); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
          <div style="color:var(--color-text-light); margin-bottom:16px; transform:scale(1.5);">${icon('mapPin', 32)}</div>
          <div style="font-size:18px; font-weight:700; color:var(--color-text-muted); margin-bottom:8px;">No venues registered</div>
          <div style="font-size:14px; color:var(--color-text-muted);">Add rooms manually or import from CSV</div>
        </div>
      `
      : `
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">
          ${list.map(v => `
            <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:14px;">${v.name}</div>
                <div style="font-size:11px; color:#10B981;">AVAILABLE</div>
              </div>
              <button onclick="window.tcDeleteVenue('${v.id}')" style="color:var(--color-text-light); hover:color:var(--color-danger); transition:color 0.2s;">
                ${icon('trash', 16)}
              </button>
            </div>
          `).join('')}
        </div>
      `;

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
        <div>
          <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px;">Venues</h1>
          <div style="font-size:16px; color:var(--color-text-muted);">Manage rooms for this tournament</div>
        </div>
        <button onclick="window.tcAddVenue()" class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">
          ${icon('plus', 18)} Add Venue
        </button>
      </div>
      ${venuesHTML}
    `;

    renderAppLayout(container, '/tournament/venues', '', '', content);
  };

  fetchVenues();
}
