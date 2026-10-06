import { renderAppLayout } from '../components/layout.js';
import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';
import { setActiveTournamentId } from '../lib/tournament-context.js';
import { psRequest } from '../lib/ps-service.js';
import { psRulesFields, readPSRules, wirePSRules, formDataOf } from '../components/ps-rules-form.js';
import { validateRules } from '../../api-shared/ps-rules.js';
import { describeDebateScoring } from '../../api-shared/debate-scoring.js';
import { debateScoringFieldset, readDebateScoring, wireDebateScoring } from '../components/debate-scoring-form.js';
import { escapeHtml } from '../lib/html.js';

const tracksOf = value => ({ debate: value !== 'Public speaking only', ps: value !== 'Debate only' });


async function createTournamentRecord(tournament) {
  const payload = Object.fromEntries(
    Object.entries(tournament).filter(([, value]) => value !== undefined)
  );
  const maxAttempts = Object.keys(payload).length + 1;

  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('tournaments')
      .insert(payload)
      .select('id')
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    const missingColumn = String(error.message || '').match(/Could not find the '([^']+)' column/);
    if (!missingColumn?.[1] || !(missingColumn[1] in payload)) break;

    delete payload[missingColumn[1]];
  }

  return { data: null, error: lastError };
}

async function createOwnerMembership(tournamentId, userId) {
  if (!tournamentId || !userId) return;

  await supabase
    .from('tournament_memberships')
    .upsert({
      tournament_id: tournamentId,
      user_id: userId,
      role: 'Director'
    }, { onConflict: 'tournament_id,user_id' });
}

export async function renderCreateTournament(container) {
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
            <input type="text" id="tournament-name" class="form-input" placeholder="Enter tournament name">
          </div>
          
          <div class="form-group" style="margin:0;">
            <label class="form-label">Short Name <span style="color:var(--color-danger)">*</span></label>
            <input type="text" id="tournament-short-name" class="form-input" placeholder="e.g. WUDC 2026">
          </div>
          
          <div class="form-group" style="margin:0;">
            <label class="form-label">Description <span style="color:var(--color-danger)">*</span></label>
            <textarea id="tournament-description" class="form-input form-textarea" placeholder="Tell us more about your tournament"></textarea>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Start Date <span style="color:var(--color-danger)">*</span></label>
              <input type="date" id="tournament-start-date" class="form-input">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">End Date <span style="color:var(--color-danger)">*</span></label>
              <input type="date" id="tournament-end-date" class="form-input">
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Timezone <span style="color:var(--color-danger)">*</span></label>
              <select id="tournament-timezone" class="form-input form-select">
                <option>GMT</option>
                <option>EST</option>
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Location <span style="color:var(--color-danger)">*</span></label>
              <input type="text" id="tournament-location" class="form-input" placeholder="e.g. Accra, Ghana">
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
            <label for="tournament-tracks" style="font-weight:600; font-size:14px;">Competition tracks</label>
            <div style="font-size:13px; color:var(--color-text-muted);">Choose what this tournament runs. The settings below change to match.</div>
            <select id="tournament-tracks" class="form-input form-select" style="margin-top:4px;" onchange="window.tcTracksChanged()">
              <option>Debate only</option>
              <option>Debate + Public speaking</option>
              <option>Public speaking only</option>
            </select>
          </div>

          <section id="debate-settings" style="border:1px solid var(--color-border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:20px;">
            <h4 style="font-size:1.05rem; font-weight:800; margin:0;">Debate settings</h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label for="tournament-format" style="font-weight:600; font-size:14px;">Debate format</label>
              <div style="font-size:13px; color:var(--color-text-muted);">Draw and tab logic currently run British Parliamentary; other formats are stored for later.</div>
              <select id="tournament-format" class="form-input form-select" style="margin-top:4px;">
                <option>British Parliamentary (BP)</option>
                <option>WSDC</option>
                <option>Asian Parliamentary</option>
              </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label for="tournament-structure" style="font-weight:600; font-size:14px;">Tournament structure</label>
              <select id="tournament-structure" class="form-input form-select" style="margin-top:4px;">
                <option>Prelims + break + out-rounds (standard BP)</option>
                <option>Round robin → straight break to finals</option>
                <option>Gold Coast (round robin + power pairing → break to finals)</option>
                <option>Elimination / bracket emphasis</option>
                <option>Other</option>
              </select>
            </div>
            ${debateScoringFieldset()}
            <div style="border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Reply Speeches</div>
                <div style="font-size:13px; color:var(--color-text-muted);">Enable reply speeches in each debate</div>
              </div>
              <div class="tc-switch" id="tc-replies-switch" onclick="this.classList.toggle('tc-on')">
                <div class="tc-switch-knob"></div>
              </div>
            </div>
            <div style="border:1px solid var(--color-border); background:#F9FAFB; border-radius:8px; padding:16px;">
              <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Team Point Allocation</div>
              <div style="font-size:13px; color:var(--color-text-muted);">1st place: 3 points, 2nd place: 2 points, 3rd place: 1 point, 4th place: 0 points</div>
            </div>
          </section>

          <section id="ps-settings" class="ps" style="display:none; border:1px solid var(--color-border); border-radius:12px; padding:20px;">
            <h4 style="font-size:1.05rem; font-weight:800; margin:0 0 4px;">Public speaking settings</h4>
            <p class="ps-help" style="margin:0 0 16px;">This sets up your first speaking event. You can add more events (e.g. Impromptu, POI) later in Public speaking → Events & tabulation.</p>
            <div data-ps-rules>${psRulesFields(null, true)}</div>
          </section>

        </div>
        
        <div style="margin-top:32px; display:flex; justify-content:space-between;">
          <button class="btn btn--outline" onclick="window.setWizardStep(1)">Back</button>
          <button class="btn btn--primary" onclick="window.setWizardStep(3)">Next</button>
        </div>
      </div>

      <!-- Step 3: Break Categories -->
      <div id="wizard-step-3" class="card" style="display:none; padding:32px;">
        <h3 style="font-size:1.4rem; font-weight:800; margin-bottom:8px;">Break Categories</h3>
        <p id="ps-break-note" style="display:none; font-size:14px; padding:12px 16px; border-radius:8px; background:#F1F5F9; margin-bottom:16px;">Public speaking breaks are set with the event: the break size and number of preliminary rounds are under Public speaking settings → Advanced settings. Eligibility categories (e.g. Novice) come from each speaker's category.</p>
        <div id="debate-breaks">
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
            <div id="review-name" style="font-weight:500;">Not set</div>
            
            <div style="color:var(--color-text-muted);">Short Name:</div>
            <div id="review-short-name" style="font-weight:500;">Not set</div>
            
            <div style="color:var(--color-text-muted);">Dates:</div>
            <div id="review-dates" style="font-weight:500;">Not set</div>
            
            <div style="color:var(--color-text-muted);">Location:</div>
            <div id="review-location" style="font-weight:500;">Not set</div>
            
            <div style="color:var(--color-text-muted);">Description:</div>
            <div id="review-description" style="font-weight:500;">Not set</div>
          </div>
        </div>

        <!-- FORMAT & SCORING -->
        <div style="border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:16px;">
          <h4 style="font-weight:700; font-size:13px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Format & Scoring</h4>
          <div style="display:grid; grid-template-columns:180px 1fr; gap:12px; font-size:14px; align-items:start;">
            <div style="color:var(--color-text-muted);">Tracks:</div>
            <div id="review-tracks" style="font-weight:500;">Debate only</div>
          </div>
          
          <div id="review-debate">
          <div style="height:1px; background:var(--color-border); margin:16px 0;"></div>
          <div style="font-weight:700; font-size:13px; margin-bottom:12px;">Debate</div>
          <div style="display:grid; grid-template-columns:180px 1fr; gap:12px; font-size:14px; align-items:start;">
            <div style="color:var(--color-text-muted);">Debate format:</div>
            <div id="review-format" style="font-weight:500;">British Parliamentary (BP)</div>
            
            <div style="color:var(--color-text-muted);">Structure:</div>
            <div id="review-structure" style="font-weight:500;">Prelims + break + out-rounds (standard BP)</div>
            
            <div style="color:var(--color-text-muted);">Speaker scoring:</div>
            <div id="review-speaker-points" style="font-weight:500;">Not set</div>
            
            <div style="color:var(--color-text-muted);">Reply speeches:</div>
            <div id="review-replies" style="font-weight:500;">Disabled</div>

            <div style="color:var(--color-text-muted);">Team points:</div>
            <div style="font-weight:500;">3 / 2 / 1 / 0</div>
          </div>
          </div>
          <div id="review-ps" style="display:none;">
            <div style="height:1px; background:var(--color-border); margin:16px 0;"></div>
            <div style="font-weight:700; font-size:13px; margin-bottom:12px;">Public speaking</div>
            <div id="review-ps-body" style="font-size:14px;"></div>
          </div>
        </div>

        <!-- BREAK CATEGORIES -->
        <div id="review-breaks" style="border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:24px;">
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

  await renderAppLayout(container, '/create-tournament', 'Host Tournament', 'Finalize your tournament settings and launch.', content);
  const step2 = document.getElementById('wizard-step-2');
  const psHolder = () => document.querySelector('#ps-settings [data-ps-rules]');
  wirePSRules(document.getElementById('ps-settings'), { request: input => psRequest({ action: 'preview-rules', input }), creating: () => true });

  window.tcTracksChanged = () => {
    const tracks = tracksOf(document.getElementById('tournament-tracks').value);
    document.getElementById('debate-settings').style.display = tracks.debate ? 'flex' : 'none';
    document.getElementById('ps-settings').style.display = tracks.ps ? 'block' : 'none';
    document.getElementById('debate-breaks').style.display = tracks.debate ? 'block' : 'none';
    document.getElementById('ps-break-note').style.display = tracks.ps ? 'block' : 'none';
  };
  wireDebateScoring(document.getElementById('debate-settings'));

  // Checks the chosen tracks' settings; returns an error message or ''.
  const formatProblem = () => {
    const tracks = tracksOf(document.getElementById('tournament-tracks').value);
    try { if (tracks.debate) readDebateScoring(step2); } catch (error) { return `Debate scoring: ${error.message}`; }
    if (tracks.ps) {
      const rules = readPSRules(formDataOf(psHolder()));
      if (!String(rules.name || '').trim()) return 'Public speaking: give the speaking event a name (e.g. Prepared Speech).';
      try { validateRules(rules); } catch (error) { return `Public speaking: ${error.message}`; }
    }
    return '';
  };

  window.tcCreateTournament = async () => {
    const btn = document.querySelector('button[onclick="window.tcCreateTournament()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Creating...';

    const getVal = (selector) => document.querySelector(selector)?.value || '';

    const newTournament = {
      name: getVal('#tournament-name').trim(),
      short_name: getVal('#tournament-short-name').trim(),
      description: getVal('#tournament-description').trim(),
      start_date: getVal('#tournament-start-date'),
      end_date: getVal('#tournament-end-date'),
      timezone: getVal('#tournament-timezone'),
      location: getVal('#tournament-location').trim(),
      settings: (() => {
        const tracks = tracksOf(getVal('#tournament-tracks'));
        const settings = { tracks: getVal('#tournament-tracks') };
        if (tracks.debate) {
          const scoring = readDebateScoring(step2);
          Object.assign(settings, {
            format: getVal('#tournament-format'),
            structure: getVal('#tournament-structure'),
            min_points: scoring.min, max_points: scoring.max, point_step: scoring.step,
            debate_scoring: scoring,
            replies_enabled: document.getElementById('tc-replies-switch').classList.contains('tc-on')
          });
        }
        return settings;
      })()
    };
    const problem = formatProblem();
    if (problem) {
      alert(problem);
      btn.disabled = false;
      btn.innerHTML = originalText;
      window.setWizardStep(2);
      return;
    }
    const psRules = tracksOf(newTournament.settings.tracks).ps ? readPSRules(formDataOf(psHolder())) : null;

    if (!newTournament.name || !newTournament.short_name || !newTournament.description || !newTournament.start_date || !newTournament.end_date || !newTournament.location) {
      alert('Please complete all required tournament details before creating.');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    if (new Date(newTournament.end_date) < new Date(newTournament.start_date)) {
      alert('End date cannot be before start date.');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('You must be logged in to create a tournament.');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    const { data, error } = await createTournamentRecord({
      name: newTournament.name,
      short_name: newTournament.short_name,
      description: newTournament.description,
      start_date: newTournament.start_date,
      end_date: newTournament.end_date,
      timezone: newTournament.timezone,
      location: newTournament.location,
      settings: newTournament.settings,
      default_prep_time: 15,
      owner_id: session.user.id,
      status: 'draft'
    });

    if (error) {
      alert('Error creating tournament: ' + error.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
    } else {
      await createOwnerMembership(data?.id, session.user.id);
      setActiveTournamentId(data?.id);
      if (psRules) {
        try { await psRequest({ action: 'create', tournamentId: data.id, input: psRules }); }
        catch (error) { alert(`Your tournament was created, but the public speaking event could not be saved yet (${error.message}). You can add it under Public speaking → Events & tabulation.`); }
      }
      window.tcNavigate(newTournament.settings.tracks === 'Public speaking only' ? '/tournament/public-speaking' : '/tournament/dashboard');
    }
  };

  window.setWizardStep = (step) => {
    if (step > 2 && document.getElementById('wizard-step-2').style.display !== 'none') {
      const problem = formatProblem();
      if (problem) { alert(problem); return; }
    }
    // Refresh review step if going to step 4
    if (step === 4) {
        const getV = (sel) => document.querySelector(sel)?.value || 'N/A';
        const setText = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.innerText = value || 'Not set';
        };

        setText('review-name', getV('#tournament-name'));
        setText('review-short-name', getV('#tournament-short-name'));
        setText('review-dates', `${getV('#tournament-start-date')} to ${getV('#tournament-end-date')}`);
        setText('review-location', getV('#tournament-location'));
        setText('review-description', getV('#tournament-description'));
        setText('review-tracks', getV('#tournament-tracks'));
        setText('review-format', getV('#tournament-format'));
        setText('review-structure', getV('#tournament-structure'));
        const tracks = tracksOf(getV('#tournament-tracks'));
        document.getElementById('review-debate').style.display = tracks.debate ? 'block' : 'none';
        document.getElementById('review-breaks').style.display = tracks.debate ? 'block' : 'none';
        document.getElementById('review-ps').style.display = tracks.ps ? 'block' : 'none';
        try { setText('review-speaker-points', describeDebateScoring(readDebateScoring(step2))); } catch (error) { setText('review-speaker-points', error.message); }
        setText('review-replies', document.getElementById('tc-replies-switch')?.classList.contains('tc-on') ? 'Enabled' : 'Disabled');
        if (tracks.ps) {
          const r = readPSRules(formDataOf(psHolder()));
          document.getElementById('review-ps-body').innerHTML = `<div><strong>${escapeHtml(r.name || 'Unnamed event')}</strong> · ${escapeHtml(r.type)}</div><div style="margin-top:6px;">Criteria: ${r.rubric.map(c => `${escapeHtml(c.name)} ${c.weight}%`).join(', ')}</div><div style="margin-top:6px; color:var(--color-text-muted);">${r.scoring === 'rank' ? 'Rank-based' : 'Weighted score'} · ${r.minHeat}–${r.maxHeat} speakers per heat · ${r.panelSize} judge(s) per heat · ${r.durationSeconds}s speeches · ${r.preliminaryRounds} prelim rounds · break to ${r.breakSize}</div>`;
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
