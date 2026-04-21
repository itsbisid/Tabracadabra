import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderChat(container) {
  const content = `
    <div style="display:flex; flex-direction:column; height:100vh; font-family:var(--font-family); background:white;">
      
      <!-- Custom Top Header -->
      <div style="padding:16px 24px; border-bottom:1px solid var(--color-border); flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--color-text-muted); cursor:pointer; margin-bottom:12px;" onclick="window.tcNavigate('/my-tournaments')">
          <span>${icon('arrowLeft', 12)}</span>
          <span>My tournaments</span>
        </div>
        <div style="font-size:24px; font-weight:700; color:var(--color-text); margin-bottom:8px;">
          ${tournamentDetail.shortName || tournamentDetail.name || 'SDFG'}
        </div>
        <div style="font-size:14px; color:var(--color-text-muted); margin-bottom:24px;">
          April 3, 2026 – April 8, 2026 · ASDB
        </div>
        
        <!-- Top Nav Tabs -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:-16px;">
          <div onclick="window.tcNavigate('/tournament/dashboard')" style="padding:8px 16px; font-size:14px; color:var(--color-text-muted); cursor:pointer; font-weight:500;">Overview</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:600; color:var(--color-primary); background:var(--color-info-bg); border-radius:8px; cursor:pointer;">Chat</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:500; color:var(--color-text-muted); cursor:pointer;">Voice rooms</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:500; color:var(--color-text-muted); cursor:pointer;">Feedback</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:500; color:var(--color-text-muted); cursor:pointer;">Rounds & draws</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:500; color:var(--color-text-muted); cursor:pointer;">Team standings</div>
          <div style="padding:8px 16px; font-size:14px; font-weight:500; color:var(--color-text-muted); cursor:pointer;">Motions</div>
        </div>
      </div>

      <!-- Main Body Grid -->
      <div style="display:flex; flex:1; overflow:hidden;">
        
        <!-- Left Sidebar for Chat -->
        <div style="width:260px; background:#f8fafc; border-right:1px solid var(--color-border); display:flex; flex-direction:column;">
          <div style="padding:24px 16px 16px;">
            <div style="font-weight:700; font-size:14px; color:var(--color-text);">${tournamentDetail.shortName || tournamentDetail.name || 'SDFG'}</div>
            <div style="font-size:12px; color:var(--color-text-muted);">Chat rooms</div>
          </div>
          
          <div style="flex:1; padding:8px; display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; background:#dbeafe; color:#1e40af; font-weight:600; font-size:14px; cursor:pointer;">
              <span style="font-size:16px;">💭</span> General
            </div>
            <div style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; color:var(--color-text); font-weight:500; font-size:14px; cursor:pointer;">
              <span style="font-size:16px;">📢</span> Announcements
            </div>
            <div style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; color:var(--color-text); font-weight:500; font-size:14px; cursor:pointer;">
              <span style="font-size:16px;">🚐</span> Logistics
            </div>
            <div style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; color:var(--color-text); font-weight:500; font-size:14px; cursor:pointer;">
              <span style="font-size:16px;">🎉</span> Socials
            </div>
          </div>

          <!-- Action Bottom -->
          <div style="padding:16px; border-top:1px solid var(--color-border); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; align-items:center; gap:8px; color:var(--color-text-muted); font-size:13px; font-weight:500; cursor:pointer;">
              ${icon('plus', 14)} Create text room
            </div>
            <div style="display:flex; align-items:center; gap:8px; color:var(--color-text-muted); font-size:13px; font-weight:500; cursor:pointer;">
              ${icon('plus', 14)} Create voice room
            </div>
          </div>
        </div>

        <!-- Main Chat Area -->
        <div style="flex:1; display:flex; flex-direction:column; position:relative;">
          <!-- Chat Header -->
          <div style="padding:16px 24px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="font-size:24px;">💭</div>
              <div>
                <div style="font-weight:700; font-size:16px; color:var(--color-text);">General</div>
                <div style="font-size:12px; color:var(--color-text-muted);">General conversation</div>
              </div>
            </div>
            <div style="color:var(--color-text-muted);">
              ${icon('lock', 16)}
            </div>
          </div>
          
          <!-- Chat Messages Scroll -->
          <div style="flex:1; overflow-y:auto; padding:24px; background:white;">
            <!-- Matches the empty chat layout in screenshot -->
          </div>
          
          <!-- Chat Input Field -->
          <div style="padding:24px; background:white;">
            <input type="text" placeholder="Message #General — type @ to mention" style="width:100%; border:1px solid var(--color-border); border-radius:8px; padding:14px 16px; font-size:14px; font-family:var(--font-family); outline:none;" />
          </div>

          <!-- Floating Bottom Right Button -->
          <div style="position:absolute; bottom:24px; right:24px; width:48px; height:48px; border-radius:50%; background:var(--color-primary); color:white; display:flex; justify-content:center; align-items:center; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); cursor:pointer; pointer-events:auto; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'">
            ${icon('zap', 20)}
          </div>

        </div>
      </div>
    </div>
  `;

  // Explicitly taking over the container DOM skipping layout wrapper
  container.innerHTML = content;
}
