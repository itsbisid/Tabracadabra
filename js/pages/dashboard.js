import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { getCurrentUser } from '../lib/auth-utils.js';
import { supabase } from '../lib/supabase.js';

export async function renderDashboard(container) {
  const user = await getCurrentUser();
  
  // Fetch real tournaments
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const activeCount = tournaments?.filter(t => t.status === 'active' || t.status === 'registration').length || 0;

  const content = `
    <!-- Top Greeting Box -->
    <div style="background: linear-gradient(120deg, #F9FBFF 0%, #F0F4FD 100%); border: 1px solid var(--color-border); border-radius: 12px; padding: 32px 32px; margin-bottom: 24px; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 8px;">Your Hub</div>
      <h2 style="font-size: 28px; font-weight: 800; color: var(--color-text); margin-bottom: 8px;">Hi, ${user.name}</h2>
      <p style="color: var(--color-text-muted); font-size: 14px; margin-bottom: 16px;">Manage your tournaments and tab operations.</p>
      <div>
        <span style="display:inline-block; padding:4px 12px; background:var(--color-bg); border:1px solid var(--color-border-strong); border-radius:16px; font-size:12px; font-weight:600; color:var(--color-text);">${user.role}</span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
      
      <div class="card" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div style="font-size:13px; color:var(--color-text-muted); font-weight:500;">Active tournaments</div>
          <div style="width:32px; height:32px; border-radius:8px; background:#EFF6FF; color:#3B82F6; display:flex; align-items:center; justify-content:center;">
            ${icon('trophy', 16)}
          </div>
        </div>
        <div style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:4px; line-height:1;">${activeCount}</div>
        <div style="font-size:11px; color:var(--color-text-muted);">Registration, live, or on break</div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div style="font-size:13px; color:var(--color-text-muted); font-weight:500;">Institutions</div>
          <div style="width:32px; height:32px; border-radius:8px; background:#ECFDF5; color:#10B981; display:flex; align-items:center; justify-content:center;">
            ${icon('building', 16)}
          </div>
        </div>
        <div style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:4px; line-height:1;">0</div>
        <div style="font-size:11px; color:var(--color-text-muted);">Societies you belong to</div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div style="font-size:13px; color:var(--color-text-muted); font-weight:500;">Role context</div>
          <div style="width:32px; height:32px; border-radius:8px; background:#F3E8FF; color:#9333EA; display:flex; align-items:center; justify-content:center;">
            ${icon('fingerprint', 16)}
          </div>
        </div>
        <div style="margin-top:20px;">
          <span style="display:inline-block; padding:4px 12px; background:var(--color-bg); border:1px solid var(--color-border-strong); border-radius:16px; font-size:12px; font-weight:600; color:var(--color-text);">${user.role}</span>
        </div>
      </div>
      
    </div>

    <!-- Quick Actions -->
    <div style="margin-bottom:32px;">
      <h3 style="font-size:18px; font-weight:700; margin-bottom:4px;">Quick actions</h3>
      <p style="font-size:13px; color:var(--color-text-muted); margin-bottom:16px;">Shortcuts to what you do most often in TabraCadabra</p>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        
        <div class="card card--clickable" style="padding:16px; display:flex; align-items:center; gap:16px;" onclick="tcNavigate('/create-tournament')">
          <div style="width:40px; height:40px; border-radius:8px; background:#EFF6FF; color:#3B82F6; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon('plus', 18)}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600; color:var(--color-text);">Create Tournament</div>
            <div style="font-size:11px; color:var(--color-text-muted);">Set up a new BP debate tournament</div>
          </div>
          <div style="color:var(--color-text-muted);">${icon('arrowRight', 16)}</div>
        </div>
        
        <div class="card card--clickable" style="padding:16px; display:flex; align-items:center; gap:16px;" onclick="alert('Institutions feature coming soon!')">
          <div style="width:40px; height:40px; border-radius:8px; background:#ECFDF5; color:#10B981; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon('building', 18)}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600; color:var(--color-text);">Manage Institutions</div>
            <div style="font-size:11px; color:var(--color-text-muted);">View and manage your debate societies</div>
          </div>
          <div style="color:var(--color-text-muted);">${icon('arrowRight', 16)}</div>
        </div>
        
        <div class="card card--clickable" style="padding:16px; display:flex; align-items:center; gap:16px;" onclick="tcNavigate('/tournaments')">
          <div style="width:40px; height:40px; border-radius:8px; background:#F3F4F6; color:#4B5563; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon('globe', 18)}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600; color:var(--color-text);">Browse Tournaments</div>
            <div style="font-size:11px; color:var(--color-text-muted);">Find and register for upcoming events</div>
          </div>
          <div style="color:var(--color-text-muted);">${icon('arrowRight', 16)}</div>
        </div>
        
      </div>
    </div>
    
    <!-- My Tournaments List -->
    <div>
      <h3 style="font-size:18px; font-weight:700; margin-bottom:4px;">My tournaments</h3>
      <p style="font-size:13px; color:var(--color-text-muted); margin-bottom:16px;">Jump back into tab, draws, or your participant view</p>
      
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${tournaments?.length > 0 ? tournaments.map(t => `
          <div class="card card--clickable" style="padding:20px 24px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--color-border);" onclick="tcNavigate('/tournament/dashboard')">
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="font-weight:700; font-size:16px;">${t.short_name || t.name}</div>
            </div>
            <div>
               <span style="font-size:10px; font-weight:700; letter-spacing:0.5px; padding:4px 8px; border-radius:4px; background:#F3F4F6; color:#4B5563; border:1px solid var(--color-border-strong); text-transform:uppercase;">${t.status}</span>
            </div>
          </div>
        `).join('') : `
          <div class="card" style="padding:32px; text-align:center; color:var(--color-text-muted); background:rgba(0,0,0,0.02); border:1px dashed var(--color-border-strong);">
            <div style="margin-bottom:12px; opacity:0.5;">${icon('layers', 32)}</div>
            <div style="font-size:14px;">You haven't created or joined any tournaments yet.</div>
            <a href="#/create-tournament" style="display:inline-block; margin-top:12px; color:var(--color-primary); font-weight:600; font-size:13px;">Create your first tournament</a>
          </div>
        `}
      </div>
    </div>
  `;

  await renderAppLayout(
    container,
    '/dashboard',
    'Dashboard',
    'Welcome back, ' + user.name,
    content
  );
}
