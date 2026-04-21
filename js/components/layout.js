import { createSidebar } from './sidebar.js';
import { createHeader } from './header.js';
import { icon } from './icons.js';
import { getCurrentUser } from '../lib/auth-utils.js';

export async function renderAppLayout(container, activePath, title, subtitle, contentHtml) {
  const user = await getCurrentUser();
  
  container.innerHTML = `
    <div class="layout-app anim-fade-in">
      <div class="layout-app__sidebar" id="app-sidebar">
        ${createSidebar(activePath, user)}
      </div>
      <main class="layout-app__main" id="app-main">
        ${createHeader(title, subtitle, user)}
        <div class="layout-app__content relative">
          ${contentHtml}
        </div>
      </main>

      <!-- Global Floating Action Button -> Triggers Quickbot -->
      <div id="global-quickbot-trigger" style="position:fixed; bottom:32px; right:32px; width:56px; height:56px; border-radius:50%; background:#0044b3; color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,0,0,0.2); cursor:pointer; transition:transform 0.2s; z-index:9000;" 
           onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'"
           onclick="window.tcToggleQuickbot()">
        ${icon('zap', 24)}
      </div>

      <!-- Global QuickBot Overlay Container -->
      <div id="quickbot-overlay" style="display:none; position:fixed; right:32px; bottom:100px; width:340px; background:white; border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,0.15); border:1px solid var(--color-border); overflow:hidden; z-index:9999; font-family:var(--font-family);">
        <div style="background:#0044b3; padding:20px; color:white; display:flex; align-items:center; justify-content:space-between; position:relative;">
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
              ${icon('zap', 20)}
            </div>
            <div>
              <div style="font-weight:700; font-size:16px; margin-bottom:2px;">QuickBot</div>
              <div style="font-size:12px; opacity:0.8;">SDFG</div>
            </div>
          </div>
          <button onclick="document.getElementById('quickbot-overlay').style.display='none'" style="background:none; border:none; color:white; cursor:pointer; opacity:0.8;">${icon('x', 18)}</button>
          
          <div style="position:absolute; bottom:-12px; left:20px; background:white; color:var(--color-primary); font-size:11px; font-weight:700; padding:2px 10px; border-radius:12px; border:1px solid #0044b3;">
            Tab Director
          </div>
        </div>
        
        <div style="padding:24px 16px 16px 16px; display:flex; flex-direction:column; gap:12px;">
          <!-- Round Status -->
          <div style="border:1px solid var(--color-border); border-radius:8px; padding:12px; display:flex; gap:12px; align-items:center;">
            <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted);">
              ${icon('activity', 20)}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--color-text);">Round 2 Status</div>
              <div style="font-size:12px; color:var(--color-text-muted);">0/0 ballots - draft</div>
            </div>
          </div>

          <!-- Post Announcement -->
          <div onclick="window.tcNavigate('/tournament/announcements'); document.getElementById('quickbot-overlay').style.display='none';" style="border:1px solid var(--color-border); border-radius:8px; padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted);">
              ${icon('megaphone', 20)}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--color-text);">Post Announcement</div>
              <div style="font-size:12px; color:var(--color-text-muted);">Send a message to all participants</div>
            </div>
          </div>

          <!-- Manage Rounds -->
          <div onclick="window.tcNavigate('/tournament/debate-rounds'); document.getElementById('quickbot-overlay').style.display='none';" style="border:1px solid var(--color-border); border-radius:8px; padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted);">
              ${icon('layers', 20)}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--color-text);">Manage Rounds</div>
              <div style="font-size:12px; color:var(--color-text-muted);">Create, draw, allocate, and complete rounds</div>
            </div>
          </div>

          <!-- Tournament Chat -->
          <div onclick="window.tcNavigate('/tournament/chat'); document.getElementById('quickbot-overlay').style.display='none';" style="border:1px solid var(--color-border); border-radius:8px; padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted);">
              ${icon('messageCircle', 20)}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--color-text);">Tournament Chat</div>
              <div style="font-size:12px; color:var(--color-text-muted);">Open the chat room</div>
            </div>
          </div>
        </div>
        
        <div style="padding:12px; border-top:1px solid var(--color-border); font-size:11px; text-align:center; color:var(--color-text-muted);">
          Refreshes automatically · Powered by Xtension
        </div>
      </div>
    </div>
  `;

  // Global Quickbot toggler hook! Overrides native clickers on .zap buttons in specific pages
  window.tcToggleQuickbot = () => {
    const p = document.getElementById('quickbot-overlay');
    if(p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  if (!window.quickbotHooked) {
    document.addEventListener('click', (e) => {
      // Find closest absolute/fixed button container with zap in it
      const btn = e.target.closest('div[style*="z-index"]');
      if (btn && (btn.style.bottom === '32px' || btn.style.zIndex === '100') && btn.innerHTML.includes('zap')) {
        window.tcToggleQuickbot();
      }
    });
    window.quickbotHooked = true;
  }
}
