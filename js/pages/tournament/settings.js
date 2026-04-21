import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderSettings(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  const fetchSettings = async () => {
    const { data } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    renderUI(data || {});
  };

  window.tcUpdateStatus = async (status) => {
    const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
    if (error) alert(error.message);
    else fetchSettings();
  };

  window.tcToggleFeedbackLock = async (current) => {
    const { error } = await supabase.from('tournaments').update({ bypass_feedback_lock: !current }).eq('id', tournamentId);
    if (error) alert(error.message);
    else fetchSettings();
  };

  window.tcSaveGeneralInfo = async () => {
    const btn = document.getElementById('save-general-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    const updates = {
      name: document.getElementById('set-name').value,
      short_name: document.getElementById('set-short-name').value,
      location: document.getElementById('set-location').value,
      start_date: document.getElementById('set-start').value,
      end_date: document.getElementById('set-end').value,
    };

    const { error } = await supabase.from('tournaments').update(updates).eq('id', tournamentId);
    if (error) alert(error.message);
    else alert('Settings saved successfully!');
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    fetchSettings();
  };

  window.tcDeleteTournament = async () => {
    if (confirm('CRITICAL: This will permanently delete ALL data for this tournament. Truly proceed?')) {
      const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
      if (error) alert(error.message);
      else window.tcNavigate('/dashboard');
    }
  };

  const renderUI = (t) => {
    const status = (t.status || 'draft').toLowerCase();
    
    const content = `
      <div style="display:grid; grid-template-columns:1fr 340px; gap:24px; align-items:start;">
        
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- GENERAL INFO -->
          <div class="card" style="padding:24px;">
            <h3 style="font-weight:800; font-size:16px; margin-bottom:20px; display:flex; align-items:center; gap:8px;">
              <span style="color:var(--color-primary);">${icon('userCog', 20)}</span> General Information
            </h3>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Tournament Name</label>
                <input type="text" id="set-name" class="form-input" value="${t.name || ''}" placeholder="e.g. World Debate Open">
              </div>
              
              <div class="form-group">
                <label class="form-label">Short Name</label>
                <input type="text" id="set-short-name" class="form-input" value="${t.short_name || ''}" placeholder="e.g. WDO 2026">
              </div>

              <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" id="set-location" class="form-input" value="${t.location || ''}" placeholder="e.g. Virtual / Accra">
              </div>

              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input type="date" id="set-start" class="form-input" value="${t.start_date || ''}">
              </div>

              <div class="form-group">
                <label class="form-label">End Date</label>
                <input type="date" id="set-end" class="form-input" value="${t.end_date || ''}">
              </div>
            </div>

            <div style="margin-top:24px; padding-top:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end;">
              <button id="save-general-btn" class="btn btn--primary" onclick="window.tcSaveGeneralInfo()">Save Changes</button>
            </div>
          </div>

          <!-- DANGER ZONE -->
          <div class="card" style="padding:24px; border:1px solid #fee2e2; background:#fffafb;">
            <h3 style="font-weight:800; font-size:16px; color:#ef4444; margin-bottom:8px;">Danger Zone</h3>
            <p style="color:#64748b; font-size:13px; margin-bottom:20px;">Once you delete a tournament, there is no going back. Please be certain.</p>
            <button class="btn" style="background:#ef4444; color:white; font-weight:700; width:100%;" onclick="window.tcDeleteTournament()">Delete Tournament Permanently</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- STATUS SECTION -->
          <div class="card" style="padding:24px;">
             <h4 style="font-weight:700; font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Tournament Status</h4>
             <div style="display:flex; flex-direction:column; gap:8px;">
               <button onclick="window.tcUpdateStatus('draft')" style="text-align:left; border-radius:8px; border:1px solid ${status === 'draft' ? 'var(--color-primary)' : '#e2e8f0'}; background:${status === 'draft' ? '#f0f7ff' : 'white'}; padding:12px; cursor:pointer; width:100%;">
                 <div style="font-weight:700; font-size:13px; color:${status === 'draft' ? 'var(--color-primary)' : '#1a1a2e'};">DRAFT</div>
                 <div style="font-size:11px; color:#64748b;">Internal preview only</div>
               </button>
               <button onclick="window.tcUpdateStatus('active')" style="text-align:left; border-radius:8px; border:1px solid ${status === 'active' ? 'var(--color-success)' : '#e2e8f0'}; background:${status === 'active' ? '#f0fdf4' : 'white'}; padding:12px; cursor:pointer; width:100%;">
                 <div style="font-weight:700; font-size:13px; color:${status === 'active' ? 'var(--color-success)' : '#1a1a2e'};">ACTIVE</div>
                 <div style="font-size:11px; color:#64748b;">Visible to all participants</div>
               </button>
               <button onclick="window.tcUpdateStatus('completed')" style="text-align:left; border-radius:8px; border:1px solid ${status === 'completed' ? '#94a3b8' : '#e2e8f0'}; background:${status === 'completed' ? '#f8fafc' : 'white'}; padding:12px; cursor:pointer; width:100%;">
                 <div style="font-weight:700; font-size:13px; color:${status === 'completed' ? '#1a1a2e' : '#64748b'};">COMPLETED</div>
                 <div style="font-size:11px; color:#64748b;">Archived results/tab</div>
               </button>
             </div>
          </div>
        </div>

      </div>
    `;

    renderAppLayout(container, '/tournament/settings', 'Settings', 'Manage core tournament details and lifecycle.', content);
  };

  fetchSettings();
}
