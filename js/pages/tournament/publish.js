import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderPublish(container) {
  window.tcAlert = (msg) => alert(msg);
  window.renderPublishRefresh = () => renderPublish(container);

  window.togglePublishSection = (section) => {
    tournamentDetail.publishSections[section] = !tournamentDetail.publishSections[section];
    window.renderPublishRefresh();
  };

  const isChecked = (section) => tournamentDetail.publishSections[section];

  const getToggleCard = (key, title, desc) => `
    <div onclick="window.togglePublishSection('${key}')" style="border:1px solid ${isChecked(key) ? '#c084fc' : 'var(--color-border)'}; background:${isChecked(key) ? '#faf5ff' : 'white'}; border-radius:8px; padding:16px; display:flex; gap:16px; cursor:pointer; align-items:flex-start;">
      <div style="width:18px; height:18px; border-radius:4px; border:1px solid ${isChecked(key) ? '#2563eb' : 'var(--color-border-strong)'}; background:${isChecked(key) ? '#2563eb' : 'white'}; display:flex; align-items:center; justify-content:center; color:white; flex-shrink:0;">
        ${isChecked(key) ? icon('check', 14) : ''}
      </div>
      <div>
        <div style="font-weight:700; font-size:14px; color:var(--color-text); margin-bottom:4px;">${title}</div>
        <div style="font-size:12px; color:var(--color-text-muted); line-height:1.4;">${desc}</div>
      </div>
    </div>
  `;

  const content = `
    <!-- Top Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
      <div>
        <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px; line-height:1.2;">Publish & Live URL</h1>
        <div style="font-size:14px; color:var(--color-text-muted); max-width:800px; line-height:1.5;">
          Generate a public Live URL with selectable tabs—draw, standings, results, motions, check-in, feedback. Linked to the public tournament view. Revoke anytime.
        </div>
      </div>
    </div>

    <!-- Main Container -->
    <div style="border:1px solid var(--color-border); border-radius:12px; padding:24px; background:white; margin-bottom:24px;">
      
      <div style="margin-bottom:24px;">
        <div style="display:flex; align-items:center; gap:8px; color:#9333ea; font-size:16px; font-weight:700; margin-bottom:4px;">
          ${icon('link', 18)} Live URL link
        </div>
        <div style="font-size:13px; color:var(--color-text-muted);">
          Pick exactly what you want on <b>one public page.</b> The audience switches tabs — no login. Use <b>Project</b> for screens.
        </div>
      </div>

      <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Selections on the public page</div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:32px;">
        ${getToggleCard('liveDraw', 'Live draw', 'Pairings — pick one or many rounds on the draw tab')}
        ${getToggleCard('teamStandings', 'Team standings', 'Live tab — tournament-wide table')}
        ${getToggleCard('breakResults', 'Break results', 'Published break lists (including ineligible markers)')}
        ${getToggleCard('motions', 'Motions', 'Motions linked to the selected round')}
        ${getToggleCard('checkIn', 'Check-in', 'Teams and adjudicators checked in for the round')}
        ${getToggleCard('feedback', 'Feedback', 'Confirmed feedback submissions vs active judges')}
        ${getToggleCard('results', 'Results', 'Round by round results with team rankings and speaker scores')}
      </div>

      <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Draw Tab — Which Rounds</div>
      <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:16px;">Audience can switch between these rounds inside the Draw tab (like the internal draw viewer).</div>
      
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <label style="font-size:12px; color:var(--color-text-muted);">Range</label>
        <select style="border:1px solid var(--color-border); border-radius:6px; padding:6px 12px; font-size:13px; outline:none; background:white;">
          <option>From</option>
        </select>
        <span style="color:var(--color-text-muted);">-</span>
        <select style="border:1px solid var(--color-border); border-radius:6px; padding:6px 12px; font-size:13px; outline:none; background:white;">
          <option>To</option>
        </select>
        <button style="border:1px solid var(--color-border); border-radius:6px; background:white; padding:6px 16px; font-size:13px; font-weight:600; color:var(--color-text); cursor:pointer;">Apply range</button>
        <button style="border:1px solid var(--color-border); border-radius:6px; background:white; padding:6px 16px; font-size:13px; font-weight:600; color:var(--color-text); cursor:pointer;">All rounds</button>
        <button style="border:1px solid transparent; background:transparent; font-size:13px; color:var(--color-primary); font-weight:600; cursor:pointer;">Clear</button>
      </div>

      <div style="display:flex; align-items:center; gap:16px; margin-bottom:32px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:14px; color:var(--color-text); background:#f8fafc; border:1px solid var(--color-border); padding:8px 16px; border-radius:8px; flex:1;">
          <input type="checkbox" checked style="accent-color:#2563eb;"> R1 — Round 1
        </label>
        <label style="display:flex; align-items:center; gap:8px; font-size:14px; color:var(--color-text); background:#f8fafc; border:1px solid var(--color-border); padding:8px 16px; border-radius:8px; flex:1;">
          <input type="checkbox" checked style="accent-color:#2563eb;"> R2 — Round 2
        </label>
      </div>

      <label style="display:flex; align-items:center; gap:8px; font-size:14px; color:var(--color-text); margin-bottom:16px;">
        <input type="checkbox" checked style="accent-color:#2563eb;"> Include blind rounds in standings (typical for hall screens)
      </label>

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <label style="font-size:13px; color:var(--color-text);">Optional title (shown at top of public page)</label>
        <input type="text" value="SDFG" style="border:1px solid var(--color-border-strong); border-radius:6px; padding:8px 12px; font-size:14px; width:250px; outline:none;">
      </div>

      <button onclick="window.tcAlert('Hall board link generated!')" style="background:#0044b3; color:white; border:none; border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer;">
        ${icon('plus', 16)} Generate hall board link
      </button>
    </div>

    <!-- Final Tab Section -->
    <div style="border:1px solid var(--color-border); border-radius:12px; padding:24px; background:white; margin-bottom:24px;">
      <h3 style="font-size:16px; font-weight:700; color:var(--color-text); margin-bottom:4px;">Final tab (full package)</h3>
      <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:24px;">
        One public page with overview, official team tab (when the tournament is complete), speaker tab, round-by-round results, break lists, motions, and participant lists. Same audience controls as hall board.
      </div>
      
      <label style="display:flex; align-items:center; gap:8px; font-size:14px; color:var(--color-text); margin-bottom:16px;">
        <input type="checkbox" checked style="accent-color:#2563eb;"> Include blind rounds in tab data (typical for published tabs)
      </label>

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <label style="font-size:13px; color:var(--color-text);">Optional title (shown at top of public page)</label>
        <input type="text" value="SDFG - Final tab" style="border:1px solid var(--color-border-strong); border-radius:6px; padding:8px 12px; font-size:14px; width:250px; outline:none;">
      </div>

      <button onclick="window.tcAlert('Final tab link generated!')" style="background:#0044b3; color:white; border:none; border-radius:8px; padding:10px 16px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer;">
        ${icon('plus', 16)} Generate final tab link
      </button>
    </div>

    <!-- Active Public Links -->
    <div style="margin-bottom:100px;">
      <h3 style="font-size:14px; font-weight:700; color:var(--color-text); margin-bottom:4px;">Active public links</h3>
      <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:12px;">Open for the room, or copy the projector URL. Deep-link a tab with <code>?tab=DRAW</code></div>
      <div style="font-size:13px; color:var(--color-text-muted); font-style:italic;">No links yet.</div>
    </div>
  `;

  renderAppLayout(container, '/tournament/publish', '', '', content);
}
