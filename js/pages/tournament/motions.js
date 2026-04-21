import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderMotions(container) {
  window.renderMotionsRefresh = () => renderMotions(container);

  window.openMotionCSVModal = () => {
    // Reusing the generic dash overlay if needed, or simple alert
    alert('Import CSV workflow not hooked up to a file parser yet.');
  };

  window.submitAddMotion = (e) => {
    e.preventDefault();
    const info = document.getElementById('motion-info').value;
    const text = document.getElementById('motion-text').value;
    
    if(!tournamentDetail.motions) tournamentDetail.motions = [];
    tournamentDetail.motions.push({ text, info, id: Date.now() });
    
    document.getElementById('add-motion-modal').style.display = 'none';
    window.renderMotionsRefresh();
  };

  window.deleteMotion = (idx) => {
    if(confirm('Are you sure you want to delete this motion?')) {
      tournamentDetail.motions.splice(idx, 1);
      window.renderMotionsRefresh();
    }
  };

  const motionsHtml = (tournamentDetail.motions || []).map((m, i) => `
    <div style="background:white; border:1px solid var(--color-border); border-radius:12px; margin-bottom:16px; padding:20px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-size:12px; font-weight:700; color:var(--color-primary); margin-bottom:8px; text-transform:uppercase;">Motion ${i + 1}</div>
        <div style="font-size:18px; font-weight:700; color:var(--color-text); margin-bottom:12px;">${m.text}</div>
        ${m.info ? `<div style="font-size:14px; color:var(--color-text-muted); background:#f8fafc; padding:12px; border-radius:8px; border-left:3px solid var(--color-primary);">${m.info}</div>` : ''}
      </div>
      <button onclick="window.deleteMotion(${i})" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; padding:8px;" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--color-text-muted)'">
        ${icon('trash', 20)}
      </button>
    </div>
  `).join('');

  const content = `
    <!-- Top Custom Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
      <div>
        <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px; line-height:1.2;">Motions</h1>
        <div style="font-size:16px; color:var(--color-text-muted);">Manage debate motions for each round</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <button style="background:white; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; color:var(--color-text); cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
          ${icon('monitor', 18)} Projection
        </button>
        <button onclick="window.openMotionCSVModal()" style="background:white; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; color:var(--color-text); cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
          ${icon('upload', 18)} Import CSV
        </button>
        <button onclick="document.getElementById('add-motion-modal').style.display='flex'" style="background:#0044b3; color:white; border:none; border-radius:8px; padding:10px 20px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
          ${icon('plus', 18)} Add Motion
        </button>
      </div>
    </div>

    <!-- Import CSV Banner -->
    <div style="background:#eff6ff; border:1px dashed #93c5fd; border-radius:12px; padding:24px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div style="display:flex; gap:16px; align-items:flex-start;">
        <div style="color:#2563eb;">${icon('fileText', 24)}</div>
        <div>
          <div style="font-weight:700; font-size:16px; color:var(--color-text); margin-bottom:4px;">Import motions from a CSV file</div>
          <div style="font-size:14px; color:var(--color-text-muted);">Download the template, fill in your motions, and upload it</div>
        </div>
      </div>
      <div style="display:flex; gap:12px;">
        <button style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:8px 16px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--color-text);">
          ${icon('download', 16)} Download Template
        </button>
        <button onclick="window.openMotionCSVModal()" style="background:#0044b3; color:white; border:none; border-radius:8px; padding:8px 16px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px; cursor:pointer;">
          ${icon('upload', 16)} Upload CSV
        </button>
      </div>
    </div>

    ${(!tournamentDetail.motions || tournamentDetail.motions.length === 0) ? `
      <!-- Empty State -->
      <div style="min-height:300px; background:white; border:1px solid var(--color-border); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <div style="color:var(--color-text-light); margin-bottom:16px; transform:scale(1.5);">${icon('fileText', 32)}</div>
        <div style="font-size:18px; font-weight:700; color:var(--color-text-muted); margin-bottom:8px;">No motions added</div>
        <div style="font-size:14px; color:var(--color-text-muted);">Add motions and assign them to rounds</div>
      </div>
    ` : `
      <!-- Motions List -->
      <div style="margin-top: 24px;">
        ${motionsHtml}
      </div>
    `}

    <!-- Add Motion Modal -->
    <div id="add-motion-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(2px);" onclick="if(event.target.id === 'add-motion-modal') this.style.display='none'">
      <div style="background:white; border-radius:12px; padding:24px 32px; width:560px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); font-family:var(--font-family);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
          <h2 style="font-size:20px; font-weight:700; color:var(--color-text); margin:0;">Add Motion</h2>
          <button onclick="document.getElementById('add-motion-modal').style.display='none'" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);">${icon('x', 20)}</button>
        </div>
        
        <form onsubmit="window.submitAddMotion(event)" style="display:flex; flex-direction:column; gap:20px;">
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; font-size:14px; color:var(--color-text);">Motion InfoSlide (Optional)</label>
            <textarea id="motion-info" rows="3" placeholder="Context or definitions..." style="width:100%; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:14px; outline:none; resize:vertical; font-family:var(--font-family);" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border-strong)'"></textarea>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; font-size:14px; color:var(--color-text);">Motion Text</label>
            <textarea id="motion-text" required rows="4" placeholder="THBT..." style="width:100%; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:14px; outline:none; resize:vertical; font-family:var(--font-family);" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border-strong)'"></textarea>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button type="button" onclick="document.getElementById('add-motion-modal').style.display='none'" style="background:white; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; color:var(--color-text); cursor:pointer;">Cancel</button>
            <button type="submit" style="background:#0044b3; border:none; border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; color:white; cursor:pointer; display:flex; align-items:center; gap:8px;">${icon('check', 16)} Save Motion</button>
          </div>
          
        </form>
      </div>
    </div>
  `;

  renderAppLayout(
    container,
    '/tournament/motions',
    '',
    '',
    content
  );
}
