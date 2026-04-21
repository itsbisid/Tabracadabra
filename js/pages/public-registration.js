import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';

export async function renderPublicRegistration(container, token) {
  let selectedRole = ''; // 'team', 'adjudicator', 'captain'
  let tournamentName = '...';
  let linkData = null;

  // Initialize UI
  container.innerHTML = `
    <div style="min-height: 100vh; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 40px 20px; font-family: 'Inter', sans-serif;">
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 20px; width: 100%; max-width: 800px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <div id="loading-state" style="text-align: center; padding: 40px;">
           <div style="color: #64748b; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
             ${icon('activity', 32)}
             Loading registration magic...
           </div>
        </div>

        <div id="content-row" style="display: none;">
           <div style="font-size: 14px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;" id="tournament-short-name">SDFG</div>
           <h1 style="font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 32px;" id="link-title">SDFG Registration</h1>
           
           <div style="font-weight: 700; font-size: 16px; color: #334155; margin-bottom: 24px;">I am registering as <span style="color: #ef4444;">*</span></div>

           <!-- Role Selection Cards -->
           <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;" id="role-cards">
             <!-- Team -->
             <div onclick="window.tcSetRole('team')" id="card-team" class="reg-card">
               <div class="reg-card__icon">${icon('users', 24)}</div>
               <div class="reg-card__title">Team of Speakers</div>
               <div class="reg-card__desc">Register as a debate team with two speakers</div>
             </div>

             <!-- Adjudicator -->
             <div onclick="window.tcSetRole('adjudicator')" id="card-adjudicator" class="reg-card">
               <div class="reg-card__icon">${icon('gavel', 24)}</div>
               <div class="reg-card__title">Adjudicator</div>
               <div class="reg-card__desc">Register as a judge for the tournament</div>
             </div>

             <!-- Captain Crunch -->
             <div onclick="window.tcSetRole('captain')" id="card-captain" class="reg-card">
               <div class="reg-card__icon">${icon('share', 24)}</div>
               <div class="reg-card__title">Captain Crunch</div>
               <div class="reg-card__desc">Register as a Captain Crunch team to fill empty slots</div>
             </div>
           </div>

           <!-- Dynamic Form Fields -->
           <div id="form-container" style="display: none; border-top: 1px solid #e2e8f0; padding-top: 32px;">
              <form id="reg-form" style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Fields injected here -->
              </form>
           </div>

           <!-- Status Placeholder -->
           <div id="status-bar" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; color: #64748b; font-size: 14px; margin-top: 24px;">
              Select your registration type above to continue.
           </div>
        </div>
      </div>
    </div>

    <style>
      .reg-card {
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: white;
      }
      .reg-card:hover {
        border-color: #3b82f6;
        background: #f0f7ff;
      }
      .reg-card.active {
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        background: white;
      }
      .reg-card.active-adjudicator {
        border-color: #10b981;
        background: #ecfdf5;
      }
      .reg-card.active-captain {
        border-color: #f59e0b;
        background: #fffbeb;
      }
      .reg-card__icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px auto;
        color: #64748b;
        transition: all 0.2s ease;
      }
      .reg-card.active .reg-card__icon {
        background: #3b82f6;
        color: white;
      }
      .reg-card.active-adjudicator .reg-card__icon {
        background: #10b981;
        color: white;
      }
      .reg-card.active-captain .reg-card__icon {
        background: #f59e0b;
        color: white;
      }
      .reg-card__title {
        font-weight: 700;
        font-size: 16px;
        color: #1e293b;
        margin-bottom: 4px;
      }
      .reg-card__desc {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .form-label {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
      }
      .form-label span { color: #ef4444; }
      .reg-input {
        height: 44px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        padding: 0 16px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
        background: #fff;
      }
      .reg-input:focus {
        border-color: #3b82f6;
      }
      .reg-input::placeholder { color: #94a3b8; }
      .submit-btn {
        background: #0044b3;
        color: white;
        height: 48px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 15px;
        margin-top: 12px;
        transition: opacity 0.2s;
      }
      .submit-btn:hover { opacity: 0.9; }
      .checkbox-group {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .checkbox-group input { width: 18px; height: 18px; cursor: pointer; }
    </style>
  `;

  // Helper: Get form fields HTML
  function getFieldsHTML(role) {
    if (role === 'team' || role === 'captain') {
      const teamLabel = role === 'captain' ? 'Captain Crunch team name' : 'Team name';
      return `
        <div class="form-group">
          <label class="form-label">${teamLabel} <span>*</span></label>
          <input type="text" name="team_name" class="reg-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Institution <span>*</span></label>
          <input type="text" name="institution" class="reg-input" placeholder="Start typing institution name..." required>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label">Speaker 1 name <span>*</span></label>
            <input type="text" name="speaker1_name" class="reg-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Speaker 1 email <span>*</span></label>
            <input type="email" name="speaker1_email" class="reg-input" required>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label">Speaker 2 name <span>*</span></label>
            <input type="text" name="speaker2_name" class="reg-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Speaker 2 email <span>*</span></label>
            <input type="email" name="speaker2_email" class="reg-input" required>
          </div>
        </div>
        <button type="submit" class="submit-btn" style="${role === 'captain' ? 'background: #f59e0b' : 'background: #0044b3'}">Submit Registration</button>
      `;
    }

    if (role === 'adjudicator') {
      return `
        <div class="form-group">
          <label class="form-label">Full name <span>*</span></label>
          <input type="text" name="full_name" class="reg-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email <span>*</span></label>
          <input type="email" name="email" class="reg-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Institution <span>*</span></label>
          <input type="text" name="institution" class="reg-input" placeholder="Start typing institution name..." required>
        </div>
        <div>
          <label class="form-label" style="display:block; margin-bottom: 8px;">Trainee</label>
          <label class="checkbox-group">
            <input type="checkbox" name="is_trainee">
            <span style="font-size: 14px; color: #475569;">Yes</span>
          </label>
        </div>
        <div>
          <label class="form-label" style="display:block; margin-bottom: 8px;">Independent</label>
          <label class="checkbox-group">
            <input type="checkbox" name="is_independent">
            <span style="font-size: 14px; color: #475569;">Yes</span>
          </label>
        </div>
        <button type="submit" class="submit-btn" style="background: #10b981">Submit Registration</button>
      `;
    }
    return '';
  }

  // Global handler for role switching
  window.tcSetRole = (role) => {
    selectedRole = role;
    
    // UI Visuals
    const cards = ['team', 'adjudicator', 'captain'];
    cards.forEach(c => {
      const el = document.getElementById(`card-${c}`);
      el.classList.remove('active', 'active-adjudicator', 'active-captain');
      if (c === role) {
        if (role === 'team') el.classList.add('active');
        if (role === 'adjudicator') el.classList.add('active-adjudicator');
        if (role === 'captain') el.classList.add('active-captain');
      }
    });

    // Form Update
    const formContainer = document.getElementById('form-container');
    const form = document.getElementById('reg-form');
    const statusBar = document.getElementById('status-bar');

    formContainer.style.display = 'block';
    form.innerHTML = getFieldsHTML(role);
    statusBar.style.display = 'none';

    // Scroll to form
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Handle Submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.submit-btn');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Submitting...';

      const formData = new FormData(form);
      const submission = {
        tournament_id: linkData.tournament_id,
        registration_link_id: linkData.id,
        role: role,
        data: Object.fromEntries(formData.entries()),
        status: 'pending'
      };

      const { error } = await supabase
        .from('registration_submissions')
        .insert([submission]);

      if (error) {
        alert('Error submitting registration: ' + error.message);
      } else {
        container.innerHTML = `
           <div style="min-height: 100vh; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 40px; font-family: 'Inter', sans-serif;">
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 20px; width: 100%; max-width: 600px; padding: 60px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
               <div style="width: 80px; height: 80px; background: #f0fdf4; color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
                 ${icon('check', 40)}
               </div>
               <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Registration Submitted</h2>
               <p style="color: #64748b; margin-bottom: 32px;">Your registration for ${tournamentName} has been received. The tournament directors will review and confirm your entry shortly.</p>
               <button onclick="location.hash = '/'" style="color: #0044b3; font-weight: 700; font-size: 14px; background: none; border: none; cursor: pointer;">Return to home</button>
            </div>
          </div>
        `;
      }
      btn.disabled = false;
      btn.innerHTML = originalText;
    };
  };

  // Initial Fetch Data
  const { data, error } = await supabase
    .from('registration_links')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    container.innerHTML = `<div style="padding: 100px; text-align: center; color: #ef4444; font-weight: 700;">Invalid or expired registration link magic.</div>`;
    return;
  }

  linkData = data;
  tournamentName = data.tournament?.name || 'SDFG';
  
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('content-row').style.display = 'block';
  document.getElementById('link-title').innerText = data.label;
  document.getElementById('tournament-short-name').innerText = tournamentName;
}
