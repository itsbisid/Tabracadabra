import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml, escapeJsString } from '../../lib/html.js';
import { sendRegistrationApprovedEmail } from '../../lib/email-service.js';

export async function renderRegistrationLinks(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const isPendingView = params.get('view') === 'pending';
  const editSubmissionId = params.get('edit');
  let pendingSubmissions = [];
  
  // Initialize helper functions
  window.tcAddField = () => {
    alert('Dynamic Form Builder: Feature coming soon in the next update!');
  };

  window.tcCreateRegLink = async () => {
    const roleType = document.querySelector('select.form-select').value;
    const btn = document.querySelector('button[onclick="window.tcCreateRegLink()"]');
    const originalText = btn.innerHTML;

    let roles = ['Team', 'Adjudicator'];
    if (roleType.includes('Teams only')) roles = ['Team'];
    if (roleType.includes('Adjudicators only')) roles = ['Adjudicator'];

    // Default the label to the roles it accepts, so links are distinguishable
    // instead of every link being named the same thing.
    const typedTitle = (document.querySelector('input[type="text"]').value || '').trim();
    const title = typedTitle || `${roles.join(' & ')} registration`;

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
    btn.innerHTML = 'Approving...';

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

    const { data: insertedRoster, error: rosterErr } = await supabase
      .from(rosterTable)
      .insert([rosterData])
      .select('id')
      .single();

    if (rosterErr) {
      alert(`Accepted but failed to add to ${rosterTable}: ` + rosterErr.message);
    } else {
      // 3. Update status to 'accepted'
      await supabase.from('registration_submissions').update({ status: 'accepted' }).eq('id', id);
      
      // 4. Send the registration approval email through the server-side email endpoint.
      const teamPortalUrl = `${window.location.origin}/#/portal/team/${insertedRoster.id}`;
      const judgePortalUrl = `${window.location.origin}/#/portal/judge/${insertedRoster.id}`;
      const emails = sub.role === 'adjudicator'
        ? [{
            to: sub.data.email,
            name: sub.data.full_name,
            role: 'adjudicator',
            dashboardUrl: judgePortalUrl
          }]
        : [
            {
              to: sub.data.speaker1_email,
              name: sub.data.speaker1_name || sub.data.team_name,
              role: 'team speaker',
              teamName: sub.data.team_name,
              dashboardUrl: `${teamPortalUrl}?speaker=${encodeURIComponent(sub.data.speaker1_name || '')}`
            },
            {
              to: sub.data.speaker2_email,
              name: sub.data.speaker2_name || sub.data.team_name,
              role: 'team speaker',
              teamName: sub.data.team_name,
              dashboardUrl: `${teamPortalUrl}?speaker=${encodeURIComponent(sub.data.speaker2_name || '')}`
            }
          ].filter(email => email.to);
      const recipients = emails.map(email => email.to);
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('name, short_name')
        .eq('id', sub.tournament_id)
        .single();

      let emailResult = { sent: false, message: '' };
      try {
        if (emails.length === 0) throw new Error('No recipient email was provided on the accepted registration.');

        await Promise.all(emails.map((email, index) => sendRegistrationApprovedEmail({
          ...email,
          tournamentId: sub.tournament_id,
          tournamentName: tournament?.short_name || tournament?.name || 'your tournament',
          idempotencyKey: `registration-approved-${id}-${index}`
        })));
        emailResult = { sent: true, message: `Approval email sent to ${recipients.join(', ')}.` };
      } catch (emailError) {
        emailResult = { sent: false, message: emailError.message };
      }

      const displayName = sub.role === 'adjudicator' ? sub.data.full_name : sub.data.team_name;
      const safeName = escapeHtml(displayName);
      const safeRole = escapeHtml(sub.role);
      const safeEmailMessage = escapeHtml(emailResult.message);
      const portalListHtml = emails.map(email => `
        <div style="margin-top:8px;">
          <strong>${escapeHtml(email.name || displayName)}:</strong>
          <a href="${escapeHtml(email.dashboardUrl)}" style="color:var(--color-primary); font-weight:700; word-break:break-all;">${escapeHtml(email.dashboardUrl)}</a>
        </div>
      `).join('');
      const copyContent = [
        `Hi ${displayName || 'there'},`,
        '',
        `Your registration as a ${sub.role} has been approved! You can now access your tournament dashboard for draws, check-ins, and announcements.`,
        '',
        'Your personal portal URL:',
        ...emails.map(email => `${email.name || displayName}: ${email.dashboardUrl}`),
      ].join('\n');
      const copyContentJs = escapeJsString(copyContent);
      const closeApprovalAction = editSubmissionId
        ? "window.tcNavigate('/tournament/registration-links?view=pending')"
        : "document.getElementById('modal-root').innerHTML=''";

      const modalRoot = document.getElementById('modal-root');
      modalRoot.innerHTML = `
        <div style="position:fixed; inset:0; background:rgba(15, 23, 42, 0.4); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div style="background:white; width:520px; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="padding:24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
               <div style="display:flex; align-items:center; gap:12px;">
                 <div style="width:32px; height:32px; background:#10B981; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;">${icon('check', 18)}</div>
                 <h3 style="font-weight:800; font-size:18px;">Registration Approved</h3>
               </div>
               <button onclick="${closeApprovalAction}" style="border:none; background:none; cursor:pointer; color:#94a3b8;">${icon('x', 20)}</button>
            </div>
            <div style="padding:32px;">
               <div style="font-size:15px; color:#334155; line-height:1.6; margin-bottom:24px;">
                 <strong>Success!</strong> ${safeName} is now part of the roster.
               </div>
               <div style="background:${emailResult.sent ? '#ECFDF5' : '#FEF2F2'}; border:1px solid ${emailResult.sent ? '#A7F3D0' : '#FECACA'}; color:${emailResult.sent ? '#047857' : '#B91C1C'}; border-radius:10px; padding:12px 14px; font-size:13px; font-weight:600; margin-bottom:20px;">
                 ${emailResult.sent ? icon('mail', 16) : icon('alertCircle', 16)} ${safeEmailMessage}
               </div>
               <div style="background:var(--color-bg-white); border:1px solid #e2e8f0; border-radius:12px; padding:20px; font-size:13px; color:#475569; position:relative;">
                 <div style="font-weight:700; color:var(--color-text); margin-bottom:12px;">Subject: Registration Approved!</div>
                 Hi ${safeName},<br><br>
                 Your registration as a ${safeRole} has been approved! You can now access your tournament dashboard for draws, check-ins, and announcements.<br><br>
                 <div style="font-weight:700; color:var(--color-text); margin-bottom:4px;">Personal portal URL${emails.length > 1 ? 's' : ''}</div>
                 ${portalListHtml}
               </div>
               <div style="margin-top:24px; display:flex; gap:12px;">
                 <button onclick="navigator.clipboard.writeText('${copyContentJs}').then(() => alert('Copied!'))" class="btn btn--primary" style="flex:1;">Copy Content</button>
                 <button onclick="${closeApprovalAction}" class="btn btn--outline" style="flex:1;">Done</button>
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

  const getSubmissionTitle = (sub) => sub?.data?.team_name || sub?.data?.full_name || 'Unnamed application';
  const getSubmissionContact = (sub) => sub?.data?.email || [sub?.data?.speaker1_email, sub?.data?.speaker2_email].filter(Boolean).join(', ');
  const getSubmissionFields = (sub) => {
    if (sub?.role === 'adjudicator') {
      return [
        ['Full name', sub.data?.full_name],
        ['Email', sub.data?.email],
        ['Institution', sub.data?.institution],
        ['Trainee', sub.data?.is_trainee === 'on' ? 'Yes' : 'No'],
        ['Independent', sub.data?.is_independent === 'on' ? 'Yes' : 'No']
      ];
    }

    return [
      ['Team name', sub?.data?.team_name],
      ['Institution', sub?.data?.institution],
      ['Speaker 1', sub?.data?.speaker1_name],
      ['Speaker 1 email', sub?.data?.speaker1_email],
      ['Speaker 2', sub?.data?.speaker2_name],
      ['Speaker 2 email', sub?.data?.speaker2_email]
    ];
  };

  window.tcEditSubmission = (id) => {
    window.tcNavigate(`/tournament/registration-links?edit=${encodeURIComponent(id)}`);
  };

  window.tcCloseSubmissionPanel = () => {
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
  };

  window.tcDeleteSubmission = async (id) => {
    if (!confirm('Delete this registration application? This removes it from the approval queue.')) return;

    const { error } = await supabase
      .from('registration_submissions')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Could not delete application: ' + error.message);
      return;
    }

    window.tcCloseSubmissionPanel();
    if (editSubmissionId) {
      window.tcNavigate('/tournament/registration-links?view=pending');
      return;
    }
    fetchSubmissions();
  };

  window.tcRejectSubmission = window.tcDeleteSubmission;

  window.tcOpenSubmissionPanel = async (id, options = {}) => {
    const cached = pendingSubmissions.find(sub => String(sub.id) === String(id));
    let sub = cached;

    if (!sub) {
      const { data, error } = await supabase
        .from('registration_submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        alert('Could not load registration: ' + error.message);
        return;
      }
      sub = data;
    }

    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot || !sub) return;

    const subId = escapeJsString(sub.id);
    const safeName = escapeHtml(getSubmissionTitle(sub));
    const safeRole = escapeHtml(sub.role || 'team');
    const safeInstitution = escapeHtml(sub.data?.institution || 'No institution provided');
    const safeContact = escapeHtml(getSubmissionContact(sub) || 'No contact provided');
    const submittedAt = sub.created_at ? new Date(sub.created_at).toLocaleString() : 'Just now';
    const fieldRows = getSubmissionFields(sub).map(([label, value]) => `
      <div class="tc-review-field">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || 'Not provided')}</strong>
      </div>
    `).join('');

    modalRoot.innerHTML = `
      <div class="tc-drawer-overlay" onclick="if(event.target === this) window.tcCloseSubmissionPanel()">
        <aside class="tc-review-drawer" role="dialog" aria-modal="true" aria-labelledby="review-drawer-title">
          <div class="tc-review-drawer__head">
            <div>
              <div class="tc-review-eyebrow">${options.announce ? 'New application received' : 'Registration application'}</div>
              <h2 id="review-drawer-title">${safeName}</h2>
            </div>
            <button type="button" class="tc-icon-button" aria-label="Close review panel" onclick="window.tcCloseSubmissionPanel()">${icon('x', 18)}</button>
          </div>

          <div class="tc-review-summary">
            <span class="tc-role-pill tc-role-pill--${safeRole === 'adjudicator' ? 'judge' : 'team'}">${safeRole}</span>
            <div>${safeInstitution}</div>
            <div>${safeContact}</div>
            <small>Submitted ${escapeHtml(submittedAt)}</small>
          </div>

          <div class="tc-review-field-list">${fieldRows}</div>

          <div class="tc-review-actions">
            <button type="button" class="btn btn--primary" onclick="window.tcAcceptSubmission('${subId}', this)">${icon('check', 15)} Approve</button>
            <button type="button" class="btn btn--outline" onclick="window.tcEditSubmission('${subId}')">${icon('pencil', 15)} Edit details</button>
            <button type="button" class="btn btn--danger" onclick="window.tcDeleteSubmission('${subId}')">${icon('trash', 15)} Delete application</button>
          </div>
        </aside>
      </div>
    `;
  };


  const fetchLinks = async () => {
    const { data } = await supabase
      .from('registration_links')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    renderLinksUI(data || []);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('registration_submissions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    pendingSubmissions = data || [];
    renderQueueUI(pendingSubmissions);
  };

  const renderLinksUI = (links) => {
    const container = document.getElementById('active-links-container');
    if (!container) return;
    
    container.innerHTML = links.length === 0 
      ? `<div style="font-size:13px; color:var(--color-text-muted); padding:20px; text-align:center; background:#f8fafc; border-radius:8px; border:1px dashed var(--color-border);">No active registration links.</div>`
      : links.map(link => {
        const label = escapeHtml(link.label);
        const token = escapeHtml(link.token);
        const tokenJs = escapeJsString(link.token);
        const linkId = escapeJsString(link.id);
        const roles = Array.isArray(link.roles) ? link.roles.map(escapeHtml).join(' / ') : 'Team / Adjudicator';

        return `
        <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">
               ${label} ${link.is_paused ? '<span style="font-size:9px; color:#EF4444; background:#FEE2E2; padding:2px 4px; border-radius:4px; margin-left:8px;">PAUSED</span>' : ''}
            </div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">${roles}</div>
            <div style="font-size:11px; color:var(--color-primary); background:var(--color-info-bg); padding:4px 8px; border-radius:4px; border:1px solid #BFDBFE;">/#/reg/${token}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="window.tcCopyRegLink('${window.location.origin}/#/reg/${tokenJs}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:6px;">${icon('copy', 12)} Copy</button>
            <button onclick="window.tcPauseRegLink('${linkId}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px;">${link.is_paused ? 'Resume' : 'Pause'}</button>
            <button onclick="window.tcDeleteRegLink('${linkId}', this)" class="btn btn--outline" style="padding:6px 12px; font-size:12px; color:var(--color-danger);">${icon('trash', 12)}</button>
          </div>
        </div>
      `;
      }).join('');
  };

  const renderQueueUI = (subs) => {
    const header = document.getElementById('review-queue-header');
    const container = document.getElementById('review-queue-container');
    if (!header || !container) return;

    header.innerText = `Review queue (${subs.length})`;
    
    container.innerHTML = subs.length === 0 
      ? `<div class="tc-empty-state">
          <div style="font-weight:800; color:var(--color-text); margin-bottom:4px;">No pending applications</div>
          <div>New registrations will appear here automatically for approval.</div>
        </div>`
      : subs.map(sub => {
        const subId = escapeJsString(sub.id);
        const role = escapeHtml(sub.role || 'team');
        const name = escapeHtml(sub.data?.team_name || sub.data?.full_name || 'Unnamed registration');
        const institution = escapeHtml(sub.data?.institution || '');
        const contacts = escapeHtml(sub.data?.email || [sub.data?.speaker1_email, sub.data?.speaker2_email].filter(Boolean).join(', '));
        const submittedAt = sub.created_at ? escapeHtml(new Date(sub.created_at).toLocaleString()) : 'Just now';

        return `
        <article class="tc-application-card" onclick="window.tcOpenSubmissionPanel('${subId}')">
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
               <span style="font-size:10px; font-weight:800; background:${sub.role==='adjudicator'?'#ECFDF5':'#EFF6FF'}; color:${sub.role==='adjudicator'?'#10B981':'#3B82F6'}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${role}</span>
               <span style="font-weight:800; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
            </div>
            <div style="font-size:12px; color:var(--color-text-muted); line-height:1.4;">
               <div>${institution}</div>
               <div style="margin-top:4px; font-weight:500;">Contacts: ${contacts}</div>
               <div style="margin-top:4px;">Submitted ${submittedAt}</div>
            </div>
          </div>
          <div class="tc-application-actions" onclick="event.stopPropagation()">
            <button onclick="window.tcOpenSubmissionPanel('${subId}')" class="btn btn--outline" style="padding:6px 12px; font-size:12px;">Review</button>
            <button onclick="window.tcAcceptSubmission('${subId}', this)" class="btn btn--primary" style="padding:6px 16px; font-size:12px;">Approve</button>
            <button onclick="window.tcEditSubmission('${subId}')" class="btn btn--outline" style="padding:6px 12px; font-size:12px;">Edit</button>
            <button onclick="window.tcDeleteSubmission('${subId}')" class="btn btn--outline" style="padding:6px 12px; font-size:12px; color:var(--color-danger); border-color:#FEE2E2;">Delete</button>
          </div>
        </article>
      `;
      }).join('');
  };

  const renderSubmissionEditPage = async (id) => {
    const target = document.getElementById('registration-edit-container');
    if (!target) return;

    const { data: sub, error } = await supabase
      .from('registration_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !sub) {
      target.innerHTML = `
        <div class="tc-empty-state">
          <div style="font-weight:800; color:var(--color-danger); margin-bottom:4px;">Application not found</div>
          <div>This application may have already been approved or deleted.</div>
          <button class="btn btn--outline" style="margin-top:16px;" onclick="window.tcNavigate('/tournament/registration-links?view=pending')">Back to pending approvals</button>
        </div>
      `;
      return;
    }

    const subId = escapeJsString(sub.id);
    const title = escapeHtml(getSubmissionTitle(sub));
    const role = escapeHtml(sub.role || 'team');
    const submittedAt = sub.created_at ? escapeHtml(new Date(sub.created_at).toLocaleString()) : 'Just now';

    const teamFields = `
      <label class="tc-edit-field">
        <span>Team name</span>
        <input class="form-input" name="team_name" value="${escapeHtml(sub.data?.team_name || '')}" required>
      </label>
      <label class="tc-edit-field">
        <span>Institution</span>
        <input class="form-input" name="institution" value="${escapeHtml(sub.data?.institution || '')}" required>
      </label>
      <div class="tc-edit-grid">
        <label class="tc-edit-field">
          <span>Speaker 1 name</span>
          <input class="form-input" name="speaker1_name" value="${escapeHtml(sub.data?.speaker1_name || '')}" required>
        </label>
        <label class="tc-edit-field">
          <span>Speaker 1 email</span>
          <input class="form-input" type="email" name="speaker1_email" value="${escapeHtml(sub.data?.speaker1_email || '')}" required>
        </label>
      </div>
      <div class="tc-edit-grid">
        <label class="tc-edit-field">
          <span>Speaker 2 name</span>
          <input class="form-input" name="speaker2_name" value="${escapeHtml(sub.data?.speaker2_name || '')}" required>
        </label>
        <label class="tc-edit-field">
          <span>Speaker 2 email</span>
          <input class="form-input" type="email" name="speaker2_email" value="${escapeHtml(sub.data?.speaker2_email || '')}" required>
        </label>
      </div>
    `;

    const adjudicatorFields = `
      <label class="tc-edit-field">
        <span>Full name</span>
        <input class="form-input" name="full_name" value="${escapeHtml(sub.data?.full_name || '')}" required>
      </label>
      <label class="tc-edit-field">
        <span>Email</span>
        <input class="form-input" type="email" name="email" value="${escapeHtml(sub.data?.email || '')}" required>
      </label>
      <label class="tc-edit-field">
        <span>Institution</span>
        <input class="form-input" name="institution" value="${escapeHtml(sub.data?.institution || '')}" required>
      </label>
      <div class="tc-edit-grid">
        <label class="tc-check-row">
          <input type="checkbox" name="is_trainee" ${sub.data?.is_trainee === 'on' ? 'checked' : ''}>
          <span>Trainee adjudicator</span>
        </label>
        <label class="tc-check-row">
          <input type="checkbox" name="is_independent" ${sub.data?.is_independent === 'on' ? 'checked' : ''}>
          <span>Independent adjudicator</span>
        </label>
      </div>
    `;

    target.innerHTML = `
      <div class="tc-edit-page">
        <div class="tc-edit-page__top">
          <button class="btn btn--outline" onclick="window.tcNavigate('/tournament/registration-links?view=pending')">${icon('arrowLeft', 15)} Back</button>
          <div>
            <div class="tc-review-eyebrow">Edit application</div>
            <h2>${title}</h2>
            <p>${role} application submitted ${submittedAt}</p>
          </div>
        </div>

        <form id="registration-edit-form" class="tc-edit-card">
          <div class="tc-edit-card__head">
            <div>
              <h3>Application details</h3>
              <p>Clean this up before approving. These values are copied into the roster.</p>
            </div>
            <span class="tc-role-pill tc-role-pill--${sub.role === 'adjudicator' ? 'judge' : 'team'}">${role}</span>
          </div>

          ${sub.role === 'adjudicator' ? adjudicatorFields : teamFields}

          <div class="tc-edit-actions">
            <button type="button" class="btn btn--outline" onclick="window.tcOpenSubmissionPanel('${subId}')">${icon('eye', 15)} Preview side panel</button>
            <button type="submit" class="btn btn--primary">${icon('check', 15)} Save details</button>
            <button type="button" class="btn btn--primary" onclick="window.tcAcceptSubmission('${subId}', this)">${icon('userPlus', 15)} Approve now</button>
            <button type="button" class="btn btn--danger" onclick="window.tcDeleteSubmission('${subId}')">${icon('trash', 15)} Delete application</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('registration-edit-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving...';

      const fd = new FormData(form);
      const updatedData = sub.role === 'adjudicator'
        ? {
            full_name: String(fd.get('full_name') || '').trim(),
            email: String(fd.get('email') || '').trim(),
            institution: String(fd.get('institution') || '').trim(),
            is_trainee: fd.get('is_trainee') ? 'on' : '',
            is_independent: fd.get('is_independent') ? 'on' : ''
          }
        : {
            team_name: String(fd.get('team_name') || '').trim(),
            institution: String(fd.get('institution') || '').trim(),
            speaker1_name: String(fd.get('speaker1_name') || '').trim(),
            speaker1_email: String(fd.get('speaker1_email') || '').trim(),
            speaker2_name: String(fd.get('speaker2_name') || '').trim(),
            speaker2_email: String(fd.get('speaker2_email') || '').trim()
          };

      const { error: saveError } = await supabase
        .from('registration_submissions')
        .update({ data: updatedData })
        .eq('id', id);

      if (saveError) {
        alert(saveError.message);
      } else {
        const notice = document.createElement('div');
        notice.className = 'tc-save-notice';
        notice.innerHTML = `${icon('check', 14)} Application details saved`;
        form.prepend(notice);
        setTimeout(() => notice.remove(), 2500);
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    };
  };

  const reviewQueueSection = `
    <!-- Review Queue -->
    <style>
      .tc-empty-state {
        background:#fff;
        border:1px dashed var(--color-border);
        border-radius:8px;
        color:var(--color-text-muted);
        font-size:13px;
        padding:24px;
        text-align:center;
      }
      .tc-application-card {
        align-items:flex-start;
        background:white;
        border:1px solid var(--color-border);
        border-radius:8px;
        cursor:pointer;
        display:flex;
        gap:16px;
        justify-content:space-between;
        margin-bottom:12px;
        padding:16px;
        transition:box-shadow .18s ease, border-color .18s ease, transform .18s ease;
      }
      .tc-application-card:hover {
        border-color:#bfdbfe;
        box-shadow:0 12px 24px rgba(15,43,91,.08);
        transform:translateY(-1px);
      }
      .tc-application-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        justify-content:flex-end;
      }
      .tc-drawer-overlay {
        position:fixed;
        inset:0;
        background:rgba(15,23,42,.34);
        backdrop-filter:blur(8px);
        display:flex;
        justify-content:flex-end;
        z-index:9999;
      }
      .tc-review-drawer {
        background:#fff;
        border-left:1px solid #dbe3ee;
        box-shadow:-24px 0 60px rgba(15,43,91,.18);
        display:flex;
        flex-direction:column;
        max-width:520px;
        min-width:0;
        overflow:auto;
        width: min(520px, 100vw);
      }
      .tc-review-drawer__head {
        align-items:flex-start;
        border-bottom:1px solid #edf1f6;
        display:flex;
        justify-content:space-between;
        gap:16px;
        padding:24px;
      }
      .tc-review-drawer__head h2,
      .tc-edit-page h2,
      .tc-edit-card h3 {
        color:var(--color-text);
        letter-spacing:0;
        margin:0;
      }
      .tc-review-eyebrow {
        color:#2563eb;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
        margin-bottom:6px;
        text-transform:uppercase;
      }
      .tc-icon-button {
        align-items:center;
        background:#f8fafc;
        border:1px solid #dbe3ee;
        border-radius:8px;
        color:#475569;
        cursor:pointer;
        display:flex;
        height:36px;
        justify-content:center;
        width:36px;
      }
      .tc-review-summary {
        background:#f8fafc;
        border-bottom:1px solid #edf1f6;
        color:#475569;
        display:grid;
        gap:8px;
        font-size:13px;
        padding:20px 24px;
      }
      .tc-role-pill {
        border-radius:999px;
        display:inline-flex;
        font-size:11px;
        font-weight:900;
        justify-self:start;
        letter-spacing:.04em;
        padding:4px 10px;
        text-transform:uppercase;
      }
      .tc-role-pill--judge { background:#ecfdf5; color:#047857; }
      .tc-role-pill--team { background:#eff6ff; color:#1d4ed8; }
      .tc-review-field-list {
        display:grid;
        gap:10px;
        padding:24px;
      }
      .tc-review-field {
        border:1px solid #edf1f6;
        border-radius:8px;
        display:grid;
        gap:4px;
        padding:12px 14px;
      }
      .tc-review-field span,
      .tc-edit-field span {
        color:#64748b;
        font-size:11px;
        font-weight:900;
        letter-spacing:.06em;
        text-transform:uppercase;
      }
      .tc-review-field strong {
        color:#172033;
        font-size:14px;
        overflow-wrap:anywhere;
      }
      .tc-review-actions {
        border-top:1px solid #edf1f6;
        display:grid;
        gap:10px;
        margin-top:auto;
        padding:24px;
      }
      .tc-review-actions .btn,
      .tc-edit-actions .btn {
        align-items:center;
        display:flex;
        gap:8px;
        justify-content:center;
      }
      .tc-edit-page {
        display:grid;
        gap:20px;
      }
      .tc-edit-page__top {
        align-items:flex-start;
        background:#fff;
        border:1px solid var(--color-border);
        border-radius:8px;
        display:flex;
        gap:18px;
        padding:22px;
      }
      .tc-edit-page__top p,
      .tc-edit-card p {
        color:#64748b;
        font-size:13px;
        margin:4px 0 0;
      }
      .tc-edit-card {
        background:#fff;
        border:1px solid var(--color-border);
        border-radius:8px;
        display:grid;
        gap:18px;
        padding:24px;
      }
      .tc-edit-card__head {
        align-items:flex-start;
        border-bottom:1px solid #edf1f6;
        display:flex;
        gap:16px;
        justify-content:space-between;
        padding-bottom:18px;
      }
      .tc-edit-field {
        display:grid;
        gap:6px;
      }
      .tc-edit-grid {
        display:grid;
        gap:16px;
        grid-template-columns:repeat(2, minmax(0, 1fr));
      }
      .tc-check-row {
        align-items:center;
        border:1px solid #edf1f6;
        border-radius:8px;
        display:flex;
        gap:10px;
        padding:12px 14px;
      }
      .tc-edit-actions {
        border-top:1px solid #edf1f6;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        padding-top:18px;
      }
      .tc-save-notice {
        align-items:center;
        background:#ecfdf5;
        border:1px solid #a7f3d0;
        border-radius:8px;
        color:#047857;
        display:flex;
        font-size:13px;
        font-weight:800;
        gap:8px;
        padding:12px 14px;
      }
      @media (max-width: 760px) {
        .tc-application-card,
        .tc-edit-page__top,
        .tc-edit-card__head {
          flex-direction:column;
        }
        .tc-application-actions,
        .tc-edit-actions {
          justify-content:stretch;
          width:100%;
        }
        .tc-application-actions .btn,
        .tc-edit-actions .btn {
          flex:1;
        }
        .tc-edit-grid {
          grid-template-columns:1fr;
        }
      }
    </style>
    <div id="review-queue-header" style="font-weight:700; font-size:16px; margin-bottom:12px; color:var(--color-text);">Review queue (0)</div>
    <div id="review-queue-container" style="margin-bottom:32px;"></div>
  `;

  const pendingViewHeader = `
    <div style="background:white; border:1px solid var(--color-border); border-radius:8px; padding:20px 24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
      <div>
        <div style="font-weight:800; font-size:18px; color:var(--color-text); margin-bottom:4px;">Pending approvals</div>
        <div style="font-size:13px; color:var(--color-text-muted);">Review submitted registrations and accept entries into the tournament roster.</div>
      </div>
      <button onclick="window.tcNavigate('/tournament/registration-links')" class="btn btn--outline" style="display:flex; align-items:center; gap:8px;">
        ${icon('link', 14)} Registration links
      </button>
    </div>
  `;

  const createFormContent = `
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
        <input type="text" class="form-input" placeholder="e.g. Main registration (leave blank to auto-name by role)" style="max-width:100%;">
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
  `;

  // Pending view (reached from the dashboard "Pending"/"Approve" cards) shows
  // ONLY the approvals queue. The full create-link form is shown otherwise.
  const editViewContent = `
    <style>
      ${reviewQueueSection.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}
    </style>
    <div id="registration-edit-container">
      <div class="tc-empty-state">Loading application details...</div>
    </div>
  `;

  const initialContent = isPendingView
    ? `${pendingViewHeader}${reviewQueueSection}`
    : editSubmissionId
      ? editViewContent
    : `${createFormContent}${reviewQueueSection}`;

  renderAppLayout(
    container,
    '/tournament/registration-links',
    editSubmissionId ? 'Edit application' : (isPendingView ? 'Pending approvals' : 'Registration links'),
    editSubmissionId ? 'Review and clean up the application before approving it.' : (isPendingView ? 'Approve submitted registrations into the roster.' : 'Manage public registration forms and review pending submissions.'),
    initialContent
  );

  if (editSubmissionId) {
    renderSubmissionEditPage(editSubmissionId);
    return;
  }

  // Initial Fetches
  fetchLinks();
  fetchSubmissions();

  // Setup Real-time Listener for Submissions
  if (window.tcRegistrationChannel) {
    supabase.removeChannel(window.tcRegistrationChannel);
  }

  window.tcRegistrationChannel = supabase
    .channel(`registration_submissions:${tournamentId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registration_submissions', filter: `tournament_id=eq.${tournamentId}` }, (payload) => {
      // Notification
      if (document.visibilityState === 'visible') {
        const toast = document.createElement('div');
        toast.style = "position:fixed; top:24px; left:50%; transform:translateX(-50%); background:#0F2B5B; color:white; padding:12px 24px; border-radius:4px; font-weight:700; box-shadow:0 8px 32px rgba(0,0,0,0.3); z-index:9999; display:flex; align-items:center; gap:12px; animation: slideDown 0.3s ease;";
        toast.innerHTML = `${icon('bell', 20)} New registration received`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
      fetchSubmissions();
      if (payload?.new?.id) {
        window.tcOpenSubmissionPanel(payload.new.id, { announce: true });
      }
    })
    .subscribe();
}
