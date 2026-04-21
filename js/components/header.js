import { icon } from './icons.js';
import { currentUser } from '../data/mock-data.js';

export function createHeader(title, subtitle = '') {
  return `
    <header style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid #E5E7EB; background:var(--color-bg-white);">
      <div>
        <h1 style="font-size:18px; font-weight:700; color:var(--color-text); margin-bottom:4px;">${title}</h1>
        ${subtitle ? `<div style="font-size:13px; color:var(--color-text-muted);">${subtitle}</div>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <a href="#/create-tournament" class="btn btn--primary btn--sm" style="height:36px; padding:0 16px; border-radius:6px; font-weight:600; font-size:13px;">
          ${icon('plus', 14)} New Tournament
        </a>
        <button style="width:36px; height:36px; border-radius:50%; border:1px solid var(--color-border); background:var(--color-bg-white); color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer;" class="hover:bg-gray-50">
          ${icon('search', 16)}
        </button>
        <button style="width:36px; height:36px; border-radius:50%; border:1px solid var(--color-border); background:var(--color-bg-white); color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer;" class="hover:bg-gray-50">
          ${icon('bell', 16)}
        </button>
        <div style="width:36px; height:36px; border-radius:50%; background:#0F2B5B; color:white; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; cursor:pointer;" title="${currentUser.name}">
          ${currentUser.initials}
        </div>
      </div>
    </header>
  `;
}
