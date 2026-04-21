import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';

export function renderAnalytics(container) {
  const content = `
    <!-- Top Divider (from screenshot spacing) -->
    <div style="height:1px; background:var(--color-border); margin:-16px -24px 24px -24px; display:none;"></div>
    
    <!-- KPI Grid -->
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:24px;">
      
      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:400; color:var(--color-text-muted);">Avg Speaker Score</div>
          <div style="color:#2563eb;">${icon('trendingUp', 16)}</div>
        </div>
        <div style="font-size:24px; font-weight:800; color:var(--color-text);">--</div>
      </div>

      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:400; color:var(--color-text-muted);">Score Std Dev</div>
          <div style="color:#059669;">${icon('barChart2', 16)}</div>
        </div>
        <div style="font-size:24px; font-weight:800; color:var(--color-text);">--</div>
      </div>

      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:400; color:var(--color-text-muted);">Institutions</div>
          <div style="color:#ea580c;">${icon('users', 16)}</div>
        </div>
        <div style="font-size:24px; font-weight:800; color:var(--color-text);">0</div>
      </div>

      <div style="background:white; border:1px solid var(--color-border); border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:400; color:var(--color-text-muted);">Position Balance</div>
          <div style="color:#9333ea;">${icon('award', 16)}</div>
        </div>
        <div style="font-size:24px; font-weight:800; color:var(--color-text);">--</div>
      </div>

    </div>

    <!-- Empty State -->
    <div style="min-height:200px; background:white; border:1px solid var(--color-border); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
      <div style="color:var(--color-text-light); margin-bottom:16px; transform:scale(1.2);">${icon('barChart', 32)}</div>
      <div style="font-size:14px; color:var(--color-text-muted); margin-bottom:4px;">No analytics available yet</div>
      <div style="font-size:12px; color:var(--color-text-muted);">Analytics will populate after rounds are completed</div>
    </div>
  `;

  renderAppLayout(container, '/tournament/analytics', 'Tournament Analytics', 'Performance insights and statistics', content);
}
