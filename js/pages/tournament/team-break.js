import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';

export function renderTeamBreak(container) {
  window.tcAlert = (msg) => alert(msg);
  
  const content = `
    <!-- Top Header -->
    <div style="margin-bottom:32px;">
      <h1 style="font-size:32px; font-weight:800; color:var(--color-text); margin-bottom:8px; line-height:1.2;">Team break</h1>
      <div style="font-size:16px; color:var(--color-text-muted); max-width:800px; line-height:1.5;">
        Team break categories, iron-man policy, adjudicator break list, and generation from tab
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px;">
      
      <!-- Iron man & team break card -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px;">
        <div style="display:flex; gap:16px; margin-bottom:24px;">
          <div style="width:36px; height:36px; border-radius:8px; background:#ffedd5; color:#ea580c; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon('shield', 18)}
          </div>
          <div>
            <div style="font-weight:700; font-size:16px; color:var(--color-text); margin-bottom:8px;">Iron man & team break</div>
            <div style="font-size:13px; color:var(--color-text-muted); line-height:1.5;">If set to <b>2</b>, any team with <b>2 or more</b> iron-man prelim rounds (two roster speakers, one person gave both speeches) is skipped when you generate the break; the next eligible team fills the slot.</div>
          </div>
        </div>
        
        <div style="display:flex; align-items:center; gap:12px; padding-left:52px;">
          <label style="font-size:13px; font-weight:600; color:var(--color-text);">Disqualify at (iron rounds ≥)</label>
          <select style="border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 12px; font-size:14px; outline:none; background:white; cursor:pointer; width:80px;">
            <option>Off</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
          </select>
          <button onclick="window.tcAlert('Saved iron man rules!')" style="background:#0044b3; color:white; border:none; border-radius:6px; padding:8px 16px; font-weight:600; font-size:13px; cursor:pointer;">Save</button>
        </div>
      </div>

      <!-- Adjudicator break card -->
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:24px;">
        <div style="display:flex; gap:16px; margin-bottom:20px;">
          <div style="width:36px; height:36px; border-radius:8px; background:#f3e8ff; color:#9333ea; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon('gavel', 18)}
          </div>
          <div>
            <div style="font-weight:700; font-size:16px; color:var(--color-text); margin-bottom:8px;">Adjudicator break</div>
            <div style="font-size:13px; color:var(--color-text-muted); line-height:1.5;">Tab sets who breaks as judges for out-rounds — discretionary order below (not auto-calculated).</div>
          </div>
        </div>
        
        <div style="padding-left:52px; display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <label style="font-size:13px; color:var(--color-text);">Break size</label>
            <input type="number" value="8" style="border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 12px; font-size:14px; outline:none; width:70px;">
            <button onclick="window.tcAlert('Break size saved!')" style="background:white; border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 12px; font-weight:600; font-size:13px; cursor:pointer;">Save size</button>
            <button onclick="window.tcAlert('Auto-selected top rated judges!')" style="background:#0044b3; color:white; border:none; border-radius:6px; padding:8px 16px; font-weight:600; font-size:13px; cursor:pointer;">Auto-select top rated</button>
          </div>
          
          <div style="font-size:12px; color:var(--color-text-muted);">Uses adjudicator rating (dynamic quality score, then test/base score) to pick top judges.</div>
          
          <div style="display:flex; align-items:center; gap:12px;">
            <label style="font-size:13px; color:var(--color-text);">Division filter</label>
            <select style="border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 12px; font-size:14px; outline:none; background:white; cursor:pointer; width:160px;">
              <option>All divisions</option>
            </select>
            <button onclick="window.tcAlert('Filter saved!')" style="background:white; border:1px solid var(--color-border-strong); border-radius:6px; padding:6px 12px; font-weight:600; font-size:13px; cursor:pointer;">Save filter</button>
          </div>
          
          <div style="font-size:12px; color:var(--color-text-muted);">Matches adjudicator division on Participants → Adjudicators. Applies to the candidate list and "Auto-select top rated".</div>
          
          <div style="display:flex; gap:12px; margin-top:8px;">
            <select style="border:1px solid var(--color-border-strong); border-radius:6px; padding:8px 12px; font-size:14px; outline:none; background:white; cursor:pointer; flex:1;">
              <option>Add adjudicator...</option>
            </select>
            <button onclick="window.tcAlert('Adjudicator added!')" style="background:white; border:1px solid var(--color-border-strong); border-radius:6px; padding:8px 16px; font-weight:600; font-size:13px; color:var(--color-text-muted); cursor:pointer;">Add</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Banner -->
    <div style="background:#f8fafc; border:1px solid var(--color-border); border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div style="font-size:14px; color:var(--color-text);">
        View detailed room rankings and scores on <span onclick="window.tcNavigate('/tournament/analytics')" style="color:#2563eb; font-weight:600; cursor:pointer; text-decoration:none;">Round results</span>
      </div>
      <div style="color:var(--color-text-muted);">${icon('arrowRight', 16)}</div>
    </div>

    <!-- Category -->
    <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="width:40px; height:40px; border-radius:12px; background:#ffedd5; color:#ea580c; display:flex; align-items:center; justify-content:center;">
          ${icon('award', 20)}
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <div style="font-weight:700; font-size:16px; color:var(--color-text);">Open</div>
            <div style="background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">Open</div>
          </div>
          <div style="font-size:13px; color:var(--color-text-muted);">0 of 16 slots filled</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:16px;">
        <button onclick="window.tcAlert('Cannot delete the primary Open break category.')" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer;">${icon('trash', 18)}</button>
        <button style="background:none; border:none; color:var(--color-text-muted); cursor:pointer;">${icon('chevronDown', 18)}</button>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div style="display:flex; justify-content:flex-end; gap:16px; margin-bottom:100px;">
      <button onclick="window.tcAlert('Break results published!')" style="background:white; border:1px solid var(--color-border-strong); border-radius:24px; padding:12px 24px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; color:var(--color-text); cursor:pointer;">
        ${icon('award', 18)} Publish break results
      </button>
      <button onclick="window.tcAlert('Navigating to out-rounds...')" style="background:#0044b3; color:white; border:none; border-radius:24px; padding:12px 24px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer;">
        ${icon('arrowRight', 18)} Go to out-round
      </button>
      <button onclick="window.tcAlert('Adding new break category...')" style="background:white; border:1px solid var(--color-border-strong); border-radius:24px; padding:12px 24px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; color:var(--color-text); cursor:pointer;">
        ${icon('plus', 18)} Add Category
      </button>
    </div>
  `;

  renderAppLayout(
    container,
    '/tournament/team-break',
    '',
    '',
    content
  );
}
