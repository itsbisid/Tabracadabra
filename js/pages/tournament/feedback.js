import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';

export function renderFeedback(container) {
  const content = `
    <!-- KPI Grid -->
    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; margin-bottom:16px; margin-top:24px;">
      
      <!-- Submissions -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px; display:flex; flex-direction:column; justify-content:space-between; min-height:120px;">
        <div style="font-size:13px; font-weight:400; color:var(--color-text-muted); margin-bottom:8px;">Confirmed submissions</div>
        <div style="font-size:28px; font-weight:800; color:var(--color-text);">0</div>
      </div>

      <!-- Average Score -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px; display:flex; flex-direction:column; justify-content:space-between; min-height:120px;">
        <div style="font-size:13px; font-weight:400; color:var(--color-text-muted); margin-bottom:8px;">Average score (this sample)</div>
        <div style="font-size:28px; font-weight:800; color:var(--color-text);">—</div>
      </div>

      <!-- Outstanding Teams -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px; display:flex; flex-direction:column;">
        <div style="font-size:14px; font-weight:700; color:var(--color-text); margin-bottom:8px;">Outstanding: teams (speaker→adjudicator)</div>
        <div style="font-size:12px; color:var(--color-text-muted); line-height:1.5; margin-bottom:16px;">
          Cumulative R1-R2: unlocked, non-blind debates only. Each cell is one adjudicator in a room your team must have rated.
        </div>
        <div style="font-size:13px; color:var(--color-text); margin-bottom:16px;">
          Items owed: <span style="color:#059669; font-weight:600;">0</span>
        </div>
        <div style="font-size:13px; color:var(--color-text-muted);">No team backlog.</div>
      </div>

      <!-- Outstanding Adjs -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px; display:flex; flex-direction:column;">
        <div style="font-size:14px; font-weight:700; color:var(--color-text); margin-bottom:8px;">Outstanding: adjudicators (panel feedback)</div>
        <div style="font-size:12px; color:var(--color-text-muted); line-height:1.5; margin-bottom:16px;">
          Chairs rate panellists/trainees; panellists and trainees rate the chair (same panel). Unlocked debates only.
        </div>
        <div style="font-size:13px; color:var(--color-text); margin-bottom:16px;">
          Items owed: <span style="color:#059669; font-weight:600;">0</span>
        </div>
        <div style="font-size:13px; color:var(--color-text-muted);">No adjudicator backlog.</div>
      </div>

    </div>

    <!-- Empty State -->
    <div style="min-height:100px; background:white; border:1px solid var(--color-border); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px;">
      <div style="font-size:13px; color:var(--color-text-muted);">No confirmed feedback in the sample yet.</div>
    </div>
  `;

  renderAppLayout(container, '/tournament/feedback', 'Adjudicator feedback', 'Summary for tab and adjudication (confirmed submissions only)', content);
}
