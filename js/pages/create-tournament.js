import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';

export function renderCreateTournament(container) {
  const content = `
    <div style="max-width: 900px; margin: 0 auto;">
      
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 4px;">Host Tournament</h2>
          <div style="color:var(--color-text-muted); font-size:14px;">Let's host your new event on TabraCadabra.</div>
        </div>
      </div>

      <!-- Classic Stepper -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 32px; padding: 0 16px;">
        
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div id="step1-circle" style="width:32px; height:32px; border-radius:50%; background:var(--color-primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">1</div>
          <div id="step1-label" style="font-size:12px; font-weight:600; color:var(--color-primary);">Basic Info</div>
        </div>
        
        <div id="step1-trail" style="flex:1; height:2px; background:var(--color-border); margin:0 16px; margin-top:-20px;"></div>
        
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div id="step2-circle" style="width:32px; height:32px; border-radius:50%; background:var(--color-bg-white); border:2px solid var(--color-border-strong); color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">2</div>
          <div id="step2-label" style="font-size:12px; font-weight:500; color:var(--color-text-muted);">Format & Scoring</div>
        </div>
        
        <div id="step2-trail" style="flex:1; height:2px; background:var(--color-border); margin:0 16px; margin-top:-20px;"></div>
        
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div id="step3-circle" style="width:32px; height:32px; border-radius:50%; background:var(--color-bg-white); border:2px solid var(--color-border-strong); color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">3</div>
          <div id="step3-label" style="font-size:12px; font-weight:500; color:var(--color-text-muted);">Break Categories</div>
        </div>
        
        <div id="step3-trail" style="flex:1; height:2px; background:var(--color-border); margin:0 16px; margin-top:-20px;"></div>
        
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div id="step4-circle" style="width:32px; height:32px; border-radius:50%; background:var(--color-bg-white); border:2px solid var(--color-border-strong); color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">4</div>
          <div id="step4-label" style="font-size:12px; font-weight:500; color:var(--color-text-muted);">Review & Create</div>
        </div>
        
      </div>

      <!-- Step 1: Basic Info -->
      <div id="wizard-step-1" class="card">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--color-border); padding-bottom:12px; margin-bottom:20px;">1. Basic Details</h3>
        
        <div style="display:grid; grid-template-columns:1fr; gap:20px;">
          
          <div class="form-group" style="margin:0;">
            <label class="form-label">Tournament Name <span style="color:var(--color-danger)">*</span></label>
            <input type="text" class="form-input" placeholder="Enter tournament name">
          </div>
          
          <div class="form-group" style="margin:0;">
            <label class="form-label">Short Name <span style="color:var(--color-danger)">*</span></label>
            <input type="text" class="form-input" placeholder="e.g. WUDC 2026">
          </div>
          
          <div class="form-group" style="margin:0;">
            <label class="form-label">Description <span style="color:var(--color-danger)">*</span></label>
            <textarea class="form-input form-textarea" placeholder="Tell us more about your tournament"></textarea>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Start Date <span style="color:var(--color-danger)">*</span></label>
              <input type="date" class="form-input">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">End Date <span style="color:var(--color-danger)">*</span></label>
              <input type="date" class="form-input">
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Timezone <span style="color:var(--color-danger)">*</span></label>
              <select class="form-input form-select">
                <option>GMT</option>
                <option>EST</option>
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Location <span style="color:var(--color-danger)">*</span></label>
              <input type="text" class="form-input" placeholder="e.g. Accra, Ghana">
            </div>
          </div>
          
        </div>
        
        <div style="margin-top:32px; display:flex; justify-content:flex-end;">
          <button class="btn btn--primary" onclick="window.setWizardStep(2)">Next</button>
        </div>
      </div>

      <!-- Step 2: Format & Scoring -->
      <div id="wizard-step-2" class="card" style="display:none; padding:32px;">
        <h3 style="font-size:1.4rem; font-weight:800; margin-bottom:24px;">Format & Scoring</h3>
        
        <div style="display:flex; flex-direction:column; gap:24px;">
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-weight:600; font-size:14px;">Competition tracks</label>
            <div style="font-size:13px; color:var(--color-text-muted);">Choose what this tournament runs first — debate tab, public speaking, or both. Options below update to match.</div>
            <select class="form-input form-select" style="margin-top:4px;">
              <option>Debate only</option>
              <option>Debate + Public speaking</option>
              <option>Public speaking only</option>
            </select>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-weight:600; font-size:14px;">Debate format</label>
            <div style="font-size:13px; color:var(--color-text-muted);">Draw and tab logic still assume BP for now; your choice is stored for display and future formats.</div>
            <select class="form-input form-select" style="margin-top:4px;">
              <option>British Parliamentary (BP)</option>
              <option>WSDC</option>
              <option>Asian Parliamentary</option>
            </select>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-weight:600; font-size:14px;">Tournament structure</label>
            <select class="form-input form-select" style="margin-top:4px;">
              <option>Prelims + break + out-rounds (standard BP)</option>
              <option>Round robin → straight break to finals</option>
              <option>Gold Coast (round robin + power pairing → break to finals)</option>
              <option>Elimination / bracket emphasis</option>
              <option>Other</option>
            </select>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-weight:600; font-size:14px;">Speaker Point Scale</label>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
              <div>
                <label style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Minimum</label>
                <input type="number" class="form-input" value="50">
              </div>
              <div>
                <label style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Maximum</label>
                <input type="number" class="form-input" value="100">
              </div>
              <div>
                <label style="font-size:12px; color:var(--color-text-muted); display:block; margin-bottom:4px;">Step</label>
                <select class="form-input form-select">
                  <option>1.0</option>
                  <option>0.5</option>
                </select>
              </div>
            </div>
          </div>
          
          <div style="border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Reply Speeches</div>
              <div style="font-size:13px; color:var(--color-text-muted);">Enable reply speeches in each debate</div>
            </div>
            <!-- Toggle switch UI -->
            <div class="tc-switch" onclick="this.classList.toggle('tc-on')">
              <div class="tc-switch-knob"></div>
            </div>
          </div>
          
          <div style="border:1px solid var(--color-border); background:#F9FAFB; border-radius:8px; padding:16px;">
            <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Team Point Allocation</div>
            <div style="font-size:13px; color:var(--color-text-muted);">1st place: 3 points, 2nd place: 2 points, 3rd place: 1 point, 4th place: 0 points</div>
          </div>

        </div>
        
        <div style="margin-top:32px; display:flex; justify-content:space-between;">
          <button class="btn btn--outline" onclick="window.setWizardStep(1)">Back</button>
          <button class="btn btn--primary" onclick="window.setWizardStep(3)">Next</button>
        </div>
      </div>

      <!-- Step 3: Break Categories -->
      <div id="wizard-step-3" class="card" style="display:none; padding:32px;">
        <h3 style="font-size:1.4rem; font-weight:800; margin-bottom:8px;">Break Categories</h3>
        <p style="font-size:14px; color:var(--color-text-muted); margin-bottom:24px;">Configure which team break categories this tournament will use.</p>
        
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
          
          <!-- Open (Required default selected) -->
          <div class="tc-category-box tc-selected" onclick="window.toggleCat(this)">
            <div style="display:flex; align-items:center; flex:1; gap:12px;">
              <div class="tc-category-checkbox">
                ${icon('check', 12)}
              </div>
              <div>
                <span class="tc-cat-name" style="font-weight:600; font-size:14px; color:var(--color-text);">Open</span>
                <span style="font-size:12px; color:var(--color-text-muted); margin-left:4px;">(required)</span>
              </div>
            </div>
            <div class="tc-break-size-wrap" style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; color:var(--color-text-muted);">Break size:</span>
              <select class="form-input form-select" style="padding:4px 32px 4px 12px; height:auto;" onclick="event.stopPropagation()">
                <option>16</option>
                <option>8</option>
                <option>4</option>
              </select>
            </div>
          </div>
          
          <!-- ESL -->
          <div class="tc-category-box" onclick="window.toggleCat(this)">
            <div style="display:flex; align-items:center; flex:1; gap:12px;">
              <div class="tc-category-checkbox">${icon('check', 12)}</div>
              <span class="tc-cat-name" style="font-weight:500; font-size:14px;">ESL</span>
            </div>
            <div class="tc-break-size-wrap" style="display:none; align-items:center; gap:8px;">
              <span style="font-size:13px; color:var(--color-text-muted);">Break size:</span>
              <select class="form-input form-select" style="padding:4px 32px 4px 12px; height:auto;" onclick="event.stopPropagation()">
                <option>16</option>
                <option>8</option>
                <option>4</option>
              </select>
            </div>
          </div>

          <!-- EFL -->
          <div class="tc-category-box" onclick="window.toggleCat(this)">
            <div style="display:flex; align-items:center; flex:1; gap:12px;">
              <div class="tc-category-checkbox">${icon('check', 12)}</div>
              <span class="tc-cat-name" style="font-weight:500; font-size:14px;">EFL</span>
            </div>
            <div class="tc-break-size-wrap" style="display:none; align-items:center; gap:8px;">
              <span style="font-size:13px; color:var(--color-text-muted);">Break size:</span>
              <select class="form-input form-select" style="padding:4px 32px 4px 12px; height:auto;" onclick="event.stopPropagation()">
                <option>16</option>
                <option>8</option>
                <option>4</option>
              </select>
            </div>
          </div>

          <!-- Novice -->
          <div class="tc-category-box" onclick="window.toggleCat(this)">
            <div style="display:flex; align-items:center; flex:1; gap:12px;">
              <div class="tc-category-checkbox">${icon('check', 12)}</div>
              <span class="tc-cat-name" style="font-weight:500; font-size:14px;">Novice</span>
            </div>
            <div class="tc-break-size-wrap" style="display:none; align-items:center; gap:8px;">
              <span style="font-size:13px; color:var(--color-text-muted);">Break size:</span>
              <select class="form-input form-select" style="padding:4px 32px 4px 12px; height:auto;" onclick="event.stopPropagation()">
                <option>16</option>
                <option>8</option>
                <option>4</option>
              </select>
            </div>
          </div>

          <!-- Pre-Uni -->
          <div class="tc-category-box" onclick="window.toggleCat(this)">
            <div style="display:flex; align-items:center; flex:1; gap:12px;">
              <div class="tc-category-checkbox">${icon('check', 12)}</div>
              <span class="tc-cat-name" style="font-weight:500; font-size:14px;">Pre-Uni</span>
            </div>
            <div class="tc-break-size-wrap" style="display:none; align-items:center; gap:8px;">
              <span style="font-size:13px; color:var(--color-text-muted);">Break size:</span>
              <select class="form-input form-select" style="padding:4px 32px 4px 12px; height:auto;" onclick="event.stopPropagation()">
                <option>16</option>
                <option>8</option>
                <option>4</option>
              </select>
            </div>
          </div>

        </div>
        
        <!-- Institution Cap Toggle -->
        <div style="border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Institution Cap</div>
            <div style="font-size:13px; color:var(--color-text-muted);">Limit teams from same institution in break</div>
          </div>
          <!-- Toggle switch UI (off) -->
          <div class="tc-switch" onclick="this.classList.toggle('tc-on')">
            <div class="tc-switch-knob"></div>
          </div>
        </div>
        
        <div style="margin-top:32px; display:flex; justify-content:space-between;">
          <button class="btn btn--outline" onclick="window.setWizardStep(2)">Back</button>
          <button class="btn btn--primary" onclick="window.setWizardStep(4)">Next</button>
        </div>
      </div>

      <!-- Step 4: Review -->
      <div id="wizard-step-4" class="card" style="display:none;">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--color-border); padding-bottom:12px; margin-bottom:20px;">4. Review & Create</h3>
        
        <!-- BASIC INFO -->
        <div style="border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:16px;">
          <h4 style="font-weight:700; font-size:13px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Basic Info</h4>
          <div style="display:grid; grid-template-columns:180px 1fr; gap:12px; font-size:14px; align-items:start;">
            <div style="color:var(--color-text-muted);">Name:</div>
            <div style="font-weight:500;">m</div>
            
            <div style="color:var(--color-text-muted);">Short Name:</div>
            <div style="font-weight:500;">mn nm</div>
            
            <div style="color:var(--color-text-muted);">Dates:</div>
            <div style="font-weight:500;">2026-04-29 to 2026-04-24</div>
            
            <div style="color:var(--color-text-muted);">Location:</div>
            <div style="font-weight:500;">nm</div>
            
            <div style="color:var(--color-text-muted);">Description:</div>
            <div style="font-weight:500;">mm</div>
          </div>
        </div>

        <!-- FORMAT & SCORING -->
        <div style="border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:16px;">
          <h4 style="font-weight:700; font-size:13px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Format & Scoring</h4>
          <div style="display:grid; grid-template-columns:180px 1fr; gap:12px; font-size:14px; align-items:start;">
            <div style="color:var(--color-text-muted);">Tracks:</div>
            <div style="font-weight:500;">Debate only</div>
          </div>
          
          <div style="height:1px; background:var(--color-border); margin:16px 0;"></div>
          
          <div style="display:grid; grid-template-columns:180px 1fr; gap:12px; font-size:14px; align-items:start;">
            <div style="color:var(--color-text-muted);">Debate format:</div>
            <div style="font-weight:500;">British Parliamentary (BP)</div>
            
            <div style="color:var(--color-text-muted);">Structure:</div>
            <div style="font-weight:500;">Prelims + break + out-rounds (standard BP)</div>
            
            <div style="color:var(--color-text-muted);">Speaker points:</div>
            <div style="font-weight:500;">50 – 100 (step: 1)</div>
            
            <div style="color:var(--color-text-muted);">Reply speeches:</div>
            <div style="font-weight:500;">Enabled</div>

            <div style="color:var(--color-text-muted);">Team points:</div>
            <div style="font-weight:500;">3 / 2 / 1 / 0</div>
          </div>
        </div>

        <!-- BREAK CATEGORIES -->
        <div style="border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:24px;">
          <h4 style="font-weight:700; font-size:13px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Break Categories</h4>
          <div style="display:flex; justify-content:space-between; font-size:14px; align-items:center;">
            <div style="font-weight:600;">Open</div>
            <div style="color:var(--color-text-muted);">Break to 16</div>
          </div>
        </div>
        
        </div>
        
        <div style="margin-top:32px; display:flex; justify-content:space-between;">
          <button class="btn btn--outline" onclick="window.setWizardStep(3)">Back</button>
          <button class="btn btn--primary" onclick="window.tcCreateTournament()" style="display:flex; align-items:center; gap:8px;">
            ${icon('check', 18)} Create Tournament
          </button>
        </div>
      </div>
    </div>
  `;

  renderAppLayout(container, '/create-tournament', 'Host Tournament', 'Finalize your tournament settings and launch.', content);

  window.tcCreateTournament = async () => {
    const btn = document.querySelector('button[onclick="window.tcCreateTournament()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Creating...';

    const getVal = (selector) => document.querySelector(selector)?.value || '';

    const newTournament = {
      name: getVal('#wizard-step-1 input[placeholder="Enter tournament name"]'),
      short_name: getVal('#wizard-step-1 input[placeholder="e.g. WUDC 2026"]'),
      description: getVal('#wizard-step-1 textarea'),
      start_date: getVal('#wizard-step-1 input[type="date"]:nth-of-type(1)'),
      end_date: getVal('#wizard-step-1 input[type="date"]:nth-of-type(2)'),
      timezone: getVal('#wizard-step-1 select'),
      location: getVal('#wizard-step-1 input[placeholder="e.g. Accra, Ghana"]'),
      settings: {
        tracks: getVal('#wizard-step-2 select:nth-of-type(1)'),
        format: getVal('#wizard-step-2 select:nth-of-type(2)'),
        structure: getVal('#wizard-step-2 select:nth-of-type(3)'),
        min_points: getVal('#wizard-step-2 input[type="number"]:nth-of-type(1)'),
        max_points: getVal('#wizard-step-2 input[type="number"]:nth-of-type(2)'),
        point_step: getVal('#wizard-step-2 select:nth-of-type(4)'),
        replies_enabled: document.querySelector('#wizard-step-2 .tc-switch').classList.contains('tc-on')
      }
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('You must be logged in to create a tournament.');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    // Call the RPC for atomic transaction: Create Tournament + Tab Director Membership
    const { data, error } = await supabase.rpc('create_tournament_atomic', {
      t_name: newTournament.name,
      t_short_name: newTournament.short_name,
      t_description: newTournament.description,
      t_start_date: newTournament.start_date,
      t_end_date: newTournament.end_date,
      t_location: newTournament.location,
      t_settings: newTournament.settings,
      t_default_prep_time: 15, // Default 15 mins
      t_owner_id: session.user.id
    });

    if (error) {
      alert('Error creating tournament: ' + error.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
    } else {
      localStorage.setItem('active_tournament_id', data);
      window.tcNavigate('/tournament/dashboard');
    }
  };

  window.setWizardStep = (step) => {
    // Refresh review step if going to step 4
    if (step === 4) {
        const getV = (sel) => document.querySelector(sel)?.value || 'N/A';
        const reviewBox = document.getElementById('wizard-step-4');
        if(reviewBox) {
            // Update review fields dynamically
            const nameReview = reviewBox.querySelector('div div:nth-child(2)');
            if(nameReview) nameReview.innerText = getV('#wizard-step-1 input[placeholder="Enter tournament name"]');
            
            const shortNameReview = reviewBox.querySelector('div div:nth-child(4)');
            if(shortNameReview) shortNameReview.innerText = getV('#wizard-step-1 input[placeholder="e.g. WUDC 2026"]');
        }
    }

    // Hide all
    for(let i=1; i<=4; i++) {
        const el = document.getElementById(`wizard-step-${i}`);
        if(el) el.style.display = 'none';
        
        const circle = document.getElementById(`step${i}-circle`);
        const label = document.getElementById(`step${i}-label`);
        
        if(circle) {
          if (i < step) {
            circle.innerHTML = icon('check', 16);
            circle.style.background = 'var(--color-success)';
            circle.style.borderColor = 'var(--color-success)';
            circle.style.color = 'white';
            label.style.color = 'var(--color-success)';
            label.style.fontWeight = '600';
          }
          else if (i === step) {
            circle.innerHTML = i;
            circle.style.background = 'var(--color-primary)';
            circle.style.borderColor = 'var(--color-primary)';
            circle.style.color = 'white';
            label.style.color = 'var(--color-primary)';
            label.style.fontWeight = '600';
          }
          else {
            circle.innerHTML = i;
            circle.style.background = 'var(--color-bg-white)';
            circle.style.borderColor = 'var(--color-border-strong)';
            circle.style.color = 'var(--color-text-muted)';
            label.style.color = 'var(--color-text-muted)';
            label.style.fontWeight = '500';
          }
        }
        
        const trail = document.getElementById(`step${i}-trail`);
        if(trail) {
          trail.style.background = i < step ? 'var(--color-success)' : 'var(--color-border)';
        }
    }
    
    // Show curr
    document.getElementById(`wizard-step-${step}`).style.display = 'block';
  };

  window.toggleCat = (element) => {
    // If it has 'Open', prevent deselecting since it is required
    const isRequired = element.innerText.includes('required');
    if(isRequired) return;

    element.classList.toggle('tc-selected');
    const wrap = element.querySelector('.tc-break-size-wrap');
    const nameEl = element.querySelector('.tc-cat-name');
    if(element.classList.contains('tc-selected')) {
      wrap.style.display = 'flex';
      if(nameEl) {
        nameEl.style.fontWeight = '600';
        nameEl.style.color = 'var(--color-text)';
      }
    } else {
      wrap.style.display = 'none';
      if(nameEl) {
        nameEl.style.fontWeight = '500';
        nameEl.style.color = 'var(--color-text-muted)';
      }
    }
  };
}
