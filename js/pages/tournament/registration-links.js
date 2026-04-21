import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { tournamentDetail } from '../../data/mock-data.js';
import { supabase } from '../../lib/supabase.js';

export async function renderRegistrationLinks(container) {
  const tournamentId = localStorage.getItem('active_tournament_id') || 'clw123456789';
  
  // Initialize helper functions
  window.tcAddField = () => {
    alert('Dynamic Form Builder: Feature coming soon in the next update!');
  };

  window.tcCreateRegLink = async () => {
    const roleType = document.querySelector('select.form-select').value;
    const title = document.querySelector('input[type="text"]').value || 'Registration';
    const btn = document.querySelector('button[onclick="window.tcCreateRegLink()"]');
    const originalText = btn.innerHTML;
    
    let roles = ['Team', 'Adjudicator'];
    if (roleType.includes('Teams only')) roles = ['Team'];
    if (roleType.includes('Adjudicators only')) roles = ['Adjudicator'];

    btn.disabled = true;
    btn.innerHTML = `${icon('activity', 14)} Creating...`;

    const { data, error } = await supabase
      .from('registration_links')
      .insert([
        { 
          tournament_id: tournamentId,
          label: title,
          roles: roles,
          auto_accept: false
        }
      ])
      .select();

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert(`Success! Link "${title}" created.`);
      fetchLinks();
    }
    
    btn.disabled = false;
    btn.innerHTML = originalText;
  };

  window.tcCopyRegLink = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btn.innerHTML;
      btn.innerHTML = `${icon('check', 12)} Copied!`;
      btn.style.color = '#10B981';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.color = '';
      }, 2000);
    });
  };

  window.tcPauseRegLink = async (id, btn) => {
    const isPaused = btn.innerHTML.includes('Resume');
    const { error } = await supabase
      .from('registration_links')
      .update({ is_paused: !isPaused })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      fetchLinks();
    }
  };

  window.tcDeleteRegLink = async (id, btn) => {
    if (confirm('Are you sure you want to delete this registration link? This cannot be undone.')) {
      const { error } = await supabase
        .from('registration_links')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error deleting link: ' + error.message);
      } else {
        fetchLinks();
      }
    }
  };

  // --- Submissions Queue Actions ---

  window.tcAcceptSubmission = async (id, btn) => {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Accepting...';

    // 1. Get submission data
    const { data: sub, error: subErr } = await supabase
      .from('registration_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (subErr) {
      alert('Error finding submission: ' + subErr.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    // 2. Insert into appropriate roster table
    let rosterTable = sub.role === 'adjudicator' ? 'adjudicators' : 'teams';
    let rosterData = {
      tournament_id: sub.tournament_id,
      institution: sub.data.institution || sub.data.Institution
    };

    if (sub.role === 'adjudicator') {
      rosterData.name = sub.data.full_name;
      rosterData.email = sub.data.email;
      rosterData.is_trainee = sub.data.is_trainee === 'on';
      rosterData.is_independent = sub.data.is_independent === 'on';
    } else {
      rosterData.name = sub.data.team_name;
      rosterData.speaker1_name = sub.data.speaker1_name;
      rosterData.speaker1_email = sub.data.speaker1_email;
      rosterData.speaker2_name = sub.data.speaker2_name;
      rosterData.speaker2_email = sub.data.speaker2_email;
    }

    const { error: rosterErr } = await supabase
      .from(rosterTable)
      .insert([rosterData]);

    if (rosterErr) {
      alert(`Accepted but failed to add to ${rosterTable}: ` + rosterErr.message);
    } else {
      // 3. Update status to 'accepted'
      await supabase.from('registration_submissions').update({ status: 'accepted' }).eq('id', id);
      
      // 4. Show PRO Email Modal
      const name = sub.role === 'adjudicator' ? sub.data.full_name : sub.data.team_name;
      const email = sub.role === 'adjudicator' ? sub.data.email : sub.data.speaker1_email;

      const modalRoot = document.getElementById('modal-root');
      modalRoot.innerHTML = `
        <div style="position:fixed; inset:0; background:rgba(15, 23, 42, 0.4); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div style="background:white; width:520px; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
               <div style="display:flex; align-items:center; gap:12px;">
                 <div style="width:32px; height:32px; background:#10B981; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;">${icon('check', 18)}</div>
                 <h3 style="font-weight:800; font-size:18px;">Registration Approved</h3>
               </div>
               <button onclick="document.getElementById('modal-root').innerHTML=''" style="border:none; background:none; cursor:pointer; color:#94a3b8;">${icon('x', 20)}</button>
            </div>
            <div style="padding:32px;">
               <div style="font-size:15px; color:#334155; line-height:1.6; margin-bottom:24px;">
                 <strong>Success!</strong> ${name} is now part of the roster. Here is the welcome email that was generated for them:
               </div>
               <div style="background:var(--color-bg-white); border:1px solid #e2e8f0; border-radius:12px; padding:20px; font-size:13px; color:#475569; position:relative;">
                 <div style="font-weight:700; color:var(--color-text); margin-bottom:12px;">Subject: Registration Approved!</div>
                 Hi ${name},<br><br>
                 Your registration as a ${sub.role} has been approved! You can now access your tournament dashboard for draws, check-ins, and announcements.<br><br>
                 Access your portal: <strong>${window.location.origin}/#/dashboard</strong>
               </div>
               <div style="margin-top:24px; display:flex; gap:12px;">
                 <button onclick="navigator.clipboard.writeText('Hi ${name}, your registration has been approved...').then(() => alert('Copied!'))" class="btn btn--primary" style="flex:1;">Copy Content</button>
                 <button onclick="document.getElementById('modal-root').innerHTML=''" class="btn btn--outline" style="flex:1;">Done</button>
               </div>
            </div>
          </div>
        </div>
      `;
      fetchSubmissions();
    }

    btn.disabled = false;
    btn.innerHTML = originalText;
  };

  window.tcEditSubmission = async (id) => {
    const { data: sub } = await supabase.from('registration_submissions').select('*').eq('id', id).single();
    if (!sub) return;

    let updatedData = { ...sub.data };
    
    if (sub.role === 'adjudicator') {
      const name = prompt('Judge Full Name:', updatedData.full_name);
      if (name !== null) updatedData.full_name = name;
      const email = prompt('Judge Email:', updatedData.email);
      if (email !== null) updatedData.email = email;
      const inst = prompt('Institution:', updatedData.institution);
      if (inst !== null) updatedData.institution = inst;
    } else {
      const team = prompt('Team Name:', updatedData.team_name);
      if (team !== null) updatedData.team_name = team;
      const inst = prompt('Institution:', updatedData.institution);
      if (inst !== null) updatedData.institution = inst;
      const s1 = prompt('Speaker 1 Name:', updatedData.speaker1_name);
      if (s1 !== null) updatedData.speaker1_name = s1;
      const s2 = prompt('Speaker 2 Name:', updatedData.speaker2_name);
      if (s2 !== null) updatedData.speaker2_name = s2;
    }

    const { error } = await supabase
      .from('registration_submissions')
      .update({ data: updatedData })
      .eq('id', id);

    if (error) alert(error.message);
    else fetchSubmissions();
  };

  window.tcRejectSubmission = async (id) => {
    if (confirm('Decline this registration?')) {
      await supabase.from('registration_submissions').update({ status: 'denied' }).eq('id', id);
      fetchSubmissions();
    }
  };


  const fetchLinks = async () => {
    const { data } = await supabase
      .from('registration_links')
      .select('*')
      .order('created_at', { ascending: false });

    renderLinksUI(data || []);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('registration_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    renderQueueUI(data || []);
  };

  const renderLinksUI = (links) => {
    const container = document.getElementById('active-links-container');
    if (!container) return;
    
    container.innerHTML = links.length === 0 
      ? `<div style="font-size:13px; color:var(--color-text-muted); padding:20px; text-align:center; background:#f8fafc; border-radius:8px; border:1px dashed var(--color-border);">No active registration links.</div>`
      : links.map(link => `
        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">
               ${link.label} ${link.is_paused ? '<span style="font-size:9px; color:#EF4444; background:#FEE2E2; padding:2px 4px; border-radius:4px; margin-left:8px;">PAUSED</span>' : ''}
            </div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">${link.roles.join(' / ')}</div>
            <div style="font-size:11px; color:var(--color-primary); background:var(--color-info-bg); padding:4px 8px; border-radius:4px; border:1px solid #BFDBFE;">/#/reg/${link.token}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="window.tcCopyRegLink('${window.location.origin}/#/reg/${link.token}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:6px;">${icon('copy', 12)} Copy</button>
            <button onclick="window.tcPauseRegLink('${link.id}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px;">${link.is_paused ? 'Resume' : 'Pause'}</button>
            <button onclick="window.tcDeleteRegLink('${link.id}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px; color:var(--color-danger);">${icon('trash', 12)}</button>
          </div>
        </div>
      `).join('');
  };

  const renderQueueUI = (subs) => {
    const header = document.getElementById('review-queue-header');
    const container = document.getElementById('review-queue-container');
    if (!header || !container) return;

    header.innerText = `Review queue (${subs.length})`;
    
    container.innerHTML = subs.length === 0 
      ? `<div style="font-size:13px; color:var(--color-text-muted);">No pending submissions at the moment.</div>`
      : subs.map(sub => `
        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
               <span style="font-size:10px; font-weight:800; background:${sub.role==='adjudicator'?'#ECFDF5':'#EFF6FF'}; color:${sub.role==='adjudicator'?'#10B981':'#3B82F6'}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${sub.role}</span>
               <span style="font-weight:700; font-size:14px;">${sub.data.team_name || sub.data.full_name}</span>
            </div>
            <div style="font-size:12px; color:var(--color-text-muted); line-height:1.4;">
               <div>${sub.data.institution}</div>
               <div style="margin-top:4px; font-weight:500;">Contacts: ${sub.data.email || (sub.data.speaker1_email + ', ' + sub.data.speaker2_email)}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="window.tcEditSubmission('${sub.id}')" class="btn btn--outline" style="padding:6px 12px; font-size:12px;">Edit</button>
            <button onclick="window.tcAcceptSubmission('${sub.id}', this)" class="btn btn--primary" style="padding:6px 16px; font-size:12px;">Accept</button>
            <button onclick="window.tcRejectSubmission('${sub.id}')" class="btn btn--outline" style="padding:6px 12px; font-size:12px; color:var(--color-danger); border-color:#FEE2E2;">Decline</button>
          </div>
        </div>
      `).join('');
  };

  const initialContent = `
    <!-- Top Action Title -->
    <div style="font-weight:700; font-size:16px; margin-bottom:4px; color:var(--color-text);">Create registration link</div>
    <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:16px;">Public link to invite submissions. Tells us how active entries remain, they must go to review.</div>

    <!-- Main Form Block -->
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:24px;">
      
      <div style="margin-bottom:20px;">
        <label style="display:block; font-size:12px; color:var(--color-text-muted); margin-bottom:4px;">Registration from</label>
        <select class="form-input form-select" style="max-width:320px;">
          <option>Debate participants (teams + adjudicators)</option>
          <option>Teams only</option>
          <option>Adjudicators only</option>
        </select>
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block; font-size:12px; color:var(--color-text-muted); margin-bottom:4px;">Link title</label>
        <input type="text" class="form-input" value="SDFG Registration" style="max-width:100%;">
        <div style="font-size:11px; color:var(--color-text-muted); margin-top:4px;">One link for debaters, wild speakers...</div>
      </div>

      <div style="margin-bottom:24px;">
        <label style="display:block; font-size:12px; color:var(--color-text-muted); margin-bottom:4px;">Description</label>
        <textarea class="form-input" rows="4" style="max-width:100%; resize:vertical;"></textarea>
      </div>

      <!-- Toggles Block -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <label style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" checked style="margin-top:2px;">
          <div>
            <div style="font-weight:600; font-size:14px; margin-bottom:2px;">Let participants choose their team name</div>
            <div style="font-size:12px; color:var(--color-text-muted);">Off = Instead name from the system ...</div>
          </div>
        </label>

        <label style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" checked style="margin-top:2px;">
          <div>
            <div style="font-weight:600; font-size:14px; margin-bottom:2px;">Ask for institution</div>
            <div style="font-size:12px; color:var(--color-text-muted);">Link to offline super tournaments.</div>
          </div>
        </label>

        <label style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" style="margin-top:2px;">
          <div>
            <div style="font-weight:600; font-size:14px; margin-bottom:2px;">Ask for self-reported adjudicator test score</div>
            <div style="font-size:12px; color:var(--color-text-muted);">Off by default. Enable only if you are manually verifying...</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Read-only Info Block -->
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:24px; margin-bottom:24px;">
      <div style="font-weight:700; font-size:14px; margin-bottom:12px;">Multiple fields (always on the public form)</div>
      <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:12px;">These are fields the app captures. Questions you add below will appear in addition to them.</div>
      
      <div style="font-size:13px; color:var(--color-text); line-height:1.6;">
        <div style="font-weight:600; margin-bottom:4px;">(If they choose Team)</div>
        <ul style="padding-left:16px; margin-top:0; color:var(--color-text-muted);">
           <li>Team Name (Required)</li>
           <li>Institution (Required)</li>
           <li>Speaker 1 name (Required)</li>
           <li>Speaker 1 email (Required)</li>
           <li>Speaker 2 name (Required)</li>
           <li>Speaker 2 email (Required)</li>
        </ul>
        <div style="font-weight:600; margin-bottom:4px; margin-top:12px;">(If they choose Adjudicator)</div>
        <ul style="padding-left:16px; margin-top:0; color:var(--color-text-muted);">
           <li>Full name (Required)</li>
           <li>Email (Required)</li>
           <li>Institution (Required)</li>
        </ul>
      </div>
    </div>

    <!-- Custom Questions Block -->
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; display:flex; justify-content:space-between; align-items:center; padding:24px; margin-bottom:24px;">
      <div>
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">Custom questions</div>
        <div style="font-size:13px; color:var(--color-text-muted);">Optional extra questions. Built-in fields above are always collected first.</div>
      </div>
      <button onclick="window.tcAddField()" class="btn btn--outline" style="display:flex; align-items:center; gap:8px;">
        ${icon('plus', 14)} Add field
      </button>
    </div>

    <!-- Submit Action -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:40px; padding:16px 0; border-bottom:1px solid var(--color-border);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" checked>
        <span style="font-weight:600; font-size:14px; color:var(--color-primary);">Auto-create when submission is safe</span>
      </label>
      <button onclick="window.tcCreateRegLink()" class="btn btn--primary" style="display:flex; align-items:center; gap:8px;">
        ${icon('plus', 14)} Create link
      </button>
    </div>

    <!-- Active Links -->
    <div style="font-weight:700; font-size:16px; margin-bottom:12px; color:var(--color-text);">Active links</div>
    <div id="active-links-container" style="margin-bottom:32px;"></div>

    <!-- Review Queue -->
    <div id="review-queue-header" style="font-weight:700; font-size:16px; margin-bottom:12px; color:var(--color-text);">Review queue (0)</div>
    <div id="review-queue-container" style="margin-bottom:32px;"></div>
  `;

  renderAppLayout(
    container,
    '/tournament/registration-links',
    'Registration links',
    'Manage public registration forms and review pending submissions.',
    initialContent
  );

  // Initial Fetches
  fetchLinks();
  fetchSubmissions();

  // Setup Real-time Listener for Submissions
  supabase
    .channel('public:registration_submissions')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registration_submissions' }, (payload) => {
      // Notification
      if (document.visibilityState === 'visible') {
        const toast = document.createElement('div');
        toast.style = "position:fixed; top:24px; left:50%; transform:translateX(-50%); background:#0F2B5B; color:white; padding:12px 24px; border-radius:4px; font-weight:700; box-shadow:0 8px 32px rgba(0,0,0,0.3); z-index:9999; display:flex; align-items:center; gap:12px; animation: slideDown 0.3s ease;";
        toast.innerHTML = `${icon('bell', 20)} New Registration Received!`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
      fetchSubmissions();
    })
    .subscribe();
}
