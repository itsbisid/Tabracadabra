import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';

export async function renderTournamentDashboard(container) {
  const tournamentId = localStorage.getItem('active_tournament_id');
  if (!tournamentId) {
    window.tcNavigate('/dashboard');
    return;
  }

  const fetchStats = async () => {
    // Fetch Tournament Info
    const { data: t } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    
    // Fetch Counts
    const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId);
    const { count: judgeCount } = await supabase.from('adjudicators').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId);
    const { count: venueCount } = await supabase.from('venues').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId);
    
    // Registration Stats
    const { count: subTotal } = await supabase.from('registration_submissions').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId);
    const { count: subPending } = await supabase.from('registration_submissions').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId).eq('status', 'pending');
    const { count: subAccepted } = await supabase.from('registration_submissions').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId).eq('status', 'accepted');

    renderUI(t || { name: 'Tournament' }, { 
      teamCount, judgeCount, venueCount, 
      subTotal, subPending, subAccepted 
    });
  };

  const renderUI = (t, stats) => {
    const content = `
      <!-- Top Progress Box -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:24px;">
        <div style="font-weight:700; font-size:13px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">
          Tournament Progress
        </div>
        
        <div style="display:flex; align-items:center; width:100%;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="color:var(--color-primary); display:flex;">${icon('clock', 18)}</div>
            <div style="font-weight:600; font-size:14px; color:var(--color-text);">Setup</div>
          </div>
          <div style="flex:1; height:1px; background:var(--color-border); margin:0 12px;"></div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:16px; height:16px; border-radius:50%; border:2px solid var(--color-border-strong);"></div>
            <div style="font-weight:500; font-size:14px; color:var(--color-text-muted);">Participants</div>
          </div>
          <div style="flex:1; height:1px; background:var(--color-border); margin:0 12px;"></div>

          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:16px; height:16px; border-radius:50%; border:2px solid var(--color-border-strong);"></div>
            <div style="font-weight:500; font-size:14px; color:var(--color-text-muted);">Prelims</div>
          </div>
          <div style="flex:1; height:1px; background:var(--color-border); margin:0 12px;"></div>

          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:16px; height:16px; border-radius:50%; border:2px solid var(--color-border-strong);"></div>
            <div style="font-weight:500; font-size:14px; color:var(--color-text-muted);">Break</div>
          </div>
          <div style="flex:1; height:1px; background:var(--color-border); margin:0 12px;"></div>

          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:16px; height:16px; border-radius:50%; border:2px solid var(--color-border-strong);"></div>
            <div style="font-weight:500; font-size:14px; color:var(--color-text-muted);">Elims</div>
          </div>
          <div style="flex:1; height:1px; background:var(--color-border); margin:0 12px;"></div>

          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:16px; height:16px; border-radius:50%; border:2px solid var(--color-border-strong);"></div>
            <div style="font-weight:500; font-size:14px; color:var(--color-text-muted);">Complete</div>
          </div>
        </div>
      </div>

      <!-- 3 Stat Cards -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px;">
        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; height:100px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="font-size:14px; color:var(--color-text-muted);">Teams</div>
            <div style="color:var(--color-info);">${icon('users', 16)}</div>
          </div>
          <div style="font-size:24px; font-weight:800;">${stats.teamCount || 0}</div>
        </div>

        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; height:100px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="font-size:14px; color:var(--color-text-muted);">Adjudicators</div>
            <div style="color:var(--color-success);">${icon('gavel', 16)}</div>
          </div>
          <div style="font-size:24px; font-weight:800;">${stats.judgeCount || 0}</div>
        </div>

        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; height:100px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="font-size:14px; color:var(--color-text-muted);">Venues</div>
            <div style="color:var(--color-warning);">${icon('mapPin', 16)}</div>
          </div>
          <div style="font-size:24px; font-weight:800;">${stats.venueCount || 0}</div>
        </div>
      </div>

      <!-- Overview Tabs -->
      <div style="background:var(--color-bg); padding:12px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div id="tab-btn-registration" onclick="window.tcSetDashTab('registration')" style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:8px 16px; font-weight:600; font-size:14px; color:var(--color-text); display:flex; align-items:center; gap:8px; cursor:pointer;">
            ${icon('fileText', 16)} Registration
          </div>
          <div id="tab-btn-participants" onclick="window.tcSetDashTab('participants')" style="background:transparent; border:1px solid transparent; border-radius:8px; padding:8px 16px; font-weight:500; font-size:14px; color:var(--color-text-muted); display:flex; align-items:center; gap:8px; cursor:pointer;">
            ${icon('users', 16)} Participants
          </div>
          <div id="tab-btn-rounds" onclick="window.tcSetDashTab('rounds')" style="background:transparent; border:1px solid transparent; border-radius:8px; padding:8px 16px; font-weight:500; font-size:14px; color:var(--color-text-muted); display:flex; align-items:center; gap:8px; cursor:pointer;">
            ${icon('list', 16)} Rounds
          </div>
          <div id="tab-btn-publish" onclick="window.tcSetDashTab('publish')" style="background:transparent; border:1px solid transparent; border-radius:8px; padding:8px 16px; font-weight:500; font-size:14px; color:var(--color-text-muted); display:flex; align-items:center; gap:8px; cursor:pointer;">
            ${icon('share', 16)} Publish
          </div>
        </div>
      </div>
        
      <!-- Reg Overview Content -->
      <div id="dash-tab-registration">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:16px;">
          <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; text-align:center;">
            <div style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:4px;">${stats.subTotal || 0}</div>
            <div style="font-size:13px; color:var(--color-text-muted);">Total</div>
          </div>
          <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; text-align:center;">
            <div style="font-size:32px; font-weight:800; color:#10B981; margin-bottom:4px;">${stats.subAccepted || 0}</div>
            <div style="font-size:13px; color:var(--color-text-muted);">Accepted</div>
          </div>
          <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; text-align:center;">
            <div style="font-size:32px; font-weight:800; color:#F59E0B; margin-bottom:4px;">${stats.subPending || 0}</div>
            <div style="font-size:13px; color:var(--color-text-muted);">Pending</div>
          </div>
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; margin-bottom:24px;">
          <div onclick="window.tcNavigate('/tournament/registration-links')" style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:shadow 0.2s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="color:var(--color-text-muted);">${icon('link', 20)}</div>
            <div style="font-size:13px; font-weight:600;">Create Link</div>
          </div>
          <div onclick="window.tcNavigate('/tournament/registration-links')" style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:shadow 0.2s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="color:var(--color-text-muted);">${icon('checkSquare', 20)}</div>
            <div style="font-size:13px; font-weight:600;">Approve</div>
          </div>
          <div onclick="window.tcNavigate('/tournament/teams')" style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:shadow 0.2s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="color:var(--color-text-muted);">${icon('upload', 20)}</div>
            <div style="font-size:13px; font-weight:600;">Upload CSV</div>
          </div>
          <div onclick="window.tcNavigate('/tournament/adjudicators')" style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:shadow 0.2s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="color:var(--color-text-muted);">${icon('userPlus', 20)}</div>
            <div style="font-size:13px; font-weight:600;">Manual Add</div>
          </div>
        </div>
      </div>

      <!-- Participants Tab -->
      <div id="dash-tab-participants" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-weight:700; font-size:14px;">Participants</div>
            <div style="font-size:13px; color:var(--color-primary); cursor:pointer;" onclick="window.tcNavigate('/tournament/teams')">Manage Teams</div>
          </div>
          <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:32px; text-align:center; font-size:13px; color:var(--color-text-muted);">
            Real roster data synced with Teams/Adjudicators pages.
          </div>
      </div>
    `;

    renderAppLayout(
      container,
      '/tournament/dashboard',
      t.name || 'Tournament',
      'Overview and progress tracking',
      content
    );

    window.tcSetDashTab = (tabName) => {
      ['registration', 'participants', 'rounds', 'publish'].forEach(tab => {
        const contentEl = document.getElementById('dash-tab-' + tab);
        if (contentEl) contentEl.style.display = 'none';
        const btnEl = document.getElementById('tab-btn-' + tab);
        if (btnEl) {
          btnEl.style.background = 'transparent';
          btnEl.style.border = '1px solid transparent';
          btnEl.style.color = 'var(--color-text-muted)';
        }
      });

      const activeContent = document.getElementById('dash-tab-' + tabName);
      if (activeContent) activeContent.style.display = 'block';
      const activeBtn = document.getElementById('tab-btn-' + tabName);
      if (activeBtn) {
        activeBtn.style.background = 'white';
        activeBtn.style.border = '1px solid var(--color-border)';
        activeBtn.style.color = 'var(--color-text)';
      }
    };
  };

  fetchStats();
}
