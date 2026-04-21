import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';
import { isFeedbackBlocked } from '../lib/feedback-lock.js';

export async function renderMyJourney(container) {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.split('?')[1]);
  const speakerId = urlParams.get('speaker_id');
  const judgeId = urlParams.get('judge_id');
  const userId = speakerId || judgeId;

  let profile = null;
  let blocked = false;
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';

  if (speakerId) {
    const { data } = await supabase.from('teams').select('*').eq('id', speakerId).single();
    profile = data ? { id: data.id, name: data.speaker1_name || data.speaker2_name, role: 'TEAM', inst: data.institution } : null;
  } else if (judgeId) {
    const { data } = await supabase.from('adjudicators').select('*').eq('id', judgeId).single();
    profile = data ? { id: data.id, name: data.name, role: 'JUDGE', inst: data.institution } : null;
  }

  if (profile) {
    blocked = await isFeedbackBlocked(profile.id, tournamentId, profile.role);
  }

  const renderEmpty = () => `
    <div class="empty-state">
      <div class="empty-state__icon">🧗</div>
      <h3 class="empty-state__title">Your journey is just beginning</h3>
      <p class="empty-state__text">Participate in tournaments to build your history.</p>
    </div>
  `;

  window.tcSubmitFeedback = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const score = parseInt(formData.get('score'));
    const comments = formData.get('comments');
    const targetId = formData.get('target_id');
    const pairingId = formData.get('pairing_id');

    const { error } = await supabase.from('judge_feedback').insert({
      tournament_id: tournamentId,
      submitted_by_id: profile.id,
      target_judge_id: targetId,
      pairing_id: pairingId,
      score,
      comments
    });

    if (error) alert(error.message);
    else {
      alert('Feedback submitted! Unlocking your next round...');
      renderMyJourney(container);
    }
  };

  const renderFeedbackLock = () => `
    <div style="max-width:600px; margin:40px auto;" class="card">
      <div style="text-align:center; margin-bottom:32px;">
        <div style="font-size:48px; margin-bottom:16px;">🔐</div>
        <h2 style="font-weight:900; font-size:24px;">Feedback Required</h2>
        <p style="color:#64748b;">The Tab Room requires your evaluation for the previous round before you can see the new draw.</p>
      </div>

      <form onsubmit="window.tcSubmitFeedback(event)" style="display:flex; flex-direction:column; gap:20px;">
        <!-- Logic to fetch the target judge based on role would go here -->
        <input type="hidden" name="pairing_id" value="PREVIOUS_PAIRING_ID">
        <input type="hidden" name="target_id" value="CHAIR_ID">
        
        <div>
          <label style="display:block; font-size:12px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:8px;">How was the Chair's adjudication? (1-10)</label>
          <input type="number" name="score" min="1" max="10" required class="form-input" placeholder="Enter score...">
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:8px;">Comments / Reasoning</label>
          <textarea name="comments" class="form-input" style="min-height:100px;" placeholder="Optional context for the Tab Room..."></textarea>
        </div>

        <button type="submit" class="btn btn--primary" style="width:100%; py:12px;">Submit & Unlock Draw</button>
      </form>
    </div>
  `;

  const renderProfile = (p) => `
    <div style="max-width:800px; margin:0 auto;">
      <div class="card" style="padding:40px; margin-bottom:24px; background:linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%); color:white; border:none;">
        <div style="font-size:14px; opacity:0.8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Welcome back, ${p.role}</div>
        <h1 style="font-size:32px; font-weight:900; margin-bottom:4px;">${p.name}</h1>
        <div style="display:flex; align-items:center; gap:16px; margin-top:20px;">
          <div style="background:rgba(255,255,255,0.1); padding:8px 16px; border-radius:8px;">
            <div style="font-size:11px; opacity:0.7;">Institution</div>
            <div style="font-weight:700;">${p.inst || 'Unaffiliated'}</div>
          </div>
        </div>
      </div>

      <h3 style="font-weight:800; font-size:18px; margin-bottom:16px;">Tournament History</h3>
      <!-- History rows would follow -->
    </div>
  `;

  const content = blocked ? renderFeedbackLock() : (profile ? renderProfile(profile) : renderEmpty());

  renderAppLayout(container, '/my-journey', 'My Journey', '', content);
}
