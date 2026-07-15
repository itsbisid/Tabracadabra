import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml, escapeJsString } from '../../lib/html.js';
import { isAdmin } from '../../lib/auth-helpers.js';

const ADMIN_ROLES = new Set(['Director', 'Tab Director', 'Convenor', 'Deputy Convenor']);

const ROLE_OPTIONS = [
  {
    value: 'Director',
    title: 'Director',
    group: 'Admin access',
    desc: 'Full tournament administration, including users, rounds, rosters, and settings.',
    iconName: 'crown',
    color: '#7c3aed',
    bg: '#f5f3ff'
  },
  {
    value: 'Tab Director',
    title: 'Tab Director',
    group: 'Admin access',
    desc: 'Runs tab operations, draws, ballots, standings, and publish controls.',
    iconName: 'clipboard',
    color: '#2563eb',
    bg: '#eff6ff'
  },
  {
    value: 'Convenor',
    title: 'Convenor',
    group: 'Admin access',
    desc: 'Manages tournament logistics, registration, venues, and public communication.',
    iconName: 'star',
    color: '#0891b2',
    bg: '#ecfeff'
  },
  {
    value: 'Deputy Convenor',
    title: 'Deputy Convenor',
    group: 'Admin access',
    desc: 'Supports convening work and can administer tournament data.',
    iconName: 'userCog',
    color: '#0f766e',
    bg: '#f0fdfa'
  },
  {
    value: 'Chief Adjudicator',
    title: 'Chief Adjudicator',
    group: 'Listed role',
    desc: 'Shown as part of the organizing team. This role does not grant admin rights yet.',
    iconName: 'gavel',
    color: '#b45309',
    bg: '#fffbeb'
  },
  {
    value: 'Equity Officer',
    title: 'Equity Officer',
    group: 'Listed role',
    desc: 'Shown as part of the organizing team. This role does not grant admin rights yet.',
    iconName: 'scales',
    color: '#be123c',
    bg: '#fff1f2'
  },
  {
    value: 'Registration Officer',
    title: 'Registration Officer',
    group: 'Listed role',
    desc: 'Shown as part of the organizing team. This role does not grant admin rights yet.',
    iconName: 'clipboardCheck',
    color: '#059669',
    bg: '#ecfdf5'
  }
];

function roleMeta(role) {
  return ROLE_OPTIONS.find(option => option.value === role) || ROLE_OPTIONS[1];
}

function hasAdminAccess(role) {
  return ADMIN_ROLES.has(String(role || '').trim());
}

function shortUserId(userId = '') {
  return userId ? `${userId.slice(0, 8)}...${userId.slice(-6)}` : 'Unknown user';
}

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export async function renderTeamLOC(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  let memberships = [];
  let tournament = null;
  let sessionUser = null;
  let isUserAdmin = false;

  const fetchAndRender = async () => {
    const [{ data: sessionData }, { data: tournamentData }, adminAllowed] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from('tournaments').select('id, name, short_name, owner_id').eq('id', tournamentId).single(),
      isAdmin(tournamentId)
    ]);

    sessionUser = sessionData?.session?.user || null;
    tournament = tournamentData || {};
    isUserAdmin = adminAllowed;

    let { data, error } = await supabase
      .from('tournament_memberships')
      .select('id, tournament_id, user_id, role, created_at')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (error && String(error.message || '').toLowerCase().includes('created_at')) {
      ({ data, error } = await supabase
        .from('tournament_memberships')
        .select('id, tournament_id, user_id, role')
        .eq('tournament_id', tournamentId));
    }

    if (error) {
      renderError(error);
      return;
    }

    memberships = data || [];
    renderUI();
  };

  const renderError = (error) => {
    renderAppLayout(
      container,
      '/tournament/team-loc',
      'Admin users',
      'Manage people who can help run the tournament.',
      `
        <div class="card" style="padding:24px; border-color:#fed7aa; background:#fff7ed;">
          <h3 style="font-size:16px; font-weight:900; color:#9a3412; margin:0 0 8px;">Could not load admin users</h3>
          <p style="font-size:13px; color:#9a3412; margin:0;">${escapeHtml(error.message || 'Check your permissions and database policies.')}</p>
        </div>
      `
    );
  };

  window.tcCopyAdminInvite = () => {
    const name = tournament?.short_name || tournament?.name || 'the tournament';
    const message = [
      `You have been invited to help administer ${name} on Tabra.`,
      '',
      '1. Sign in or create an account on Tabra.',
      '2. Open Profile and copy your User ID.',
      '3. Send that User ID to the tournament director so they can grant your role.',
      '',
      `${window.location.origin}/#/login`
    ].join('\n');

    navigator.clipboard.writeText(message).then(() => alert('Invite instructions copied.'));
  };

  window.tcAddTournamentMember = async (event) => {
    event.preventDefault();
    if (!isUserAdmin) {
      alert('Only tournament admins can add users.');
      return false;
    }

    const form = event.currentTarget;
    const fd = new FormData(form);
    const userId = String(fd.get('user_id') || '').trim();
    const role = String(fd.get('role') || 'Tab Director').trim();

    if (!isUuid(userId)) {
      alert('Paste a valid Tabra user ID. It should look like a UUID.');
      return false;
    }

    const submit = form.querySelector('button[type="submit"]');
    const originalText = submit?.innerHTML;
    if (submit) {
      submit.disabled = true;
      submit.innerHTML = 'Adding...';
    }

    const { error } = await supabase
      .from('tournament_memberships')
      .upsert({
        tournament_id: tournamentId,
        user_id: userId,
        role
      }, { onConflict: 'tournament_id,user_id' });

    if (error) {
      alert(error.message);
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalText;
      }
      return false;
    }

    form.reset();
    await fetchAndRender();
    return false;
  };

  window.tcUpdateTournamentMemberRole = async (userId, role) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can change roles.');
      return;
    }
    if (userId === tournament?.owner_id) {
      alert('The tournament owner keeps full director access.');
      return;
    }

    const { error } = await supabase
      .from('tournament_memberships')
      .update({ role })
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    if (error) alert(error.message);
    else fetchAndRender();
  };

  window.tcRemoveTournamentMember = async (userId) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can remove users.');
      return;
    }
    if (userId === tournament?.owner_id) {
      alert('The tournament owner cannot be removed here.');
      return;
    }
    if (userId === sessionUser?.id && !confirm('Remove your own membership? If you are not the owner, you may lose access to this tournament.')) {
      return;
    }
    if (!confirm('Remove this user from the tournament admin team?')) return;

    const { error } = await supabase
      .from('tournament_memberships')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    if (error) alert(error.message);
    else fetchAndRender();
  };

  const renderRoleCards = () => ROLE_OPTIONS.map(role => `
    <div style="border:1px solid #e2e8f0; border-radius:8px; background:white; padding:14px; display:flex; gap:12px;">
      <div style="width:34px; height:34px; border-radius:8px; background:${role.bg}; color:${role.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        ${icon(role.iconName, 17)}
      </div>
      <div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <strong style="font-size:13px; color:#172033;">${escapeHtml(role.title)}</strong>
          <span style="background:${hasAdminAccess(role.value) ? '#ecfdf5' : '#f1f5f9'}; color:${hasAdminAccess(role.value) ? '#047857' : '#64748b'}; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:900;">${hasAdminAccess(role.value) ? 'Admin' : 'Listed'}</span>
        </div>
        <div style="font-size:12px; color:#64748b; line-height:1.4; margin-top:4px;">${escapeHtml(role.desc)}</div>
      </div>
    </div>
  `).join('');

  const renderMemberRow = (member, owner = false) => {
    const role = owner ? 'Director' : (member.role || 'Member');
    const meta = roleMeta(role);
    const userId = member.user_id;
    const safeUserId = escapeJsString(userId);
    const isSelf = userId === sessionUser?.id;

    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:16px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:8px; background:${meta.bg}; color:${meta.color}; display:flex; align-items:center; justify-content:center;">${icon(meta.iconName, 17)}</div>
            <div>
              <div style="font-weight:800; color:#172033;">
                ${escapeHtml(owner ? 'Tournament owner' : shortUserId(userId))}
                ${isSelf ? '<span style="color:#2563eb; font-size:11px; font-weight:900; margin-left:6px;">You</span>' : ''}
              </div>
              <button onclick="navigator.clipboard.writeText('${safeUserId}').then(() => alert('User ID copied.'))" style="border:0; background:transparent; color:#64748b; cursor:pointer; font-size:12px; padding:0;">${escapeHtml(userId)}</button>
            </div>
          </div>
        </td>
        <td style="padding:16px;">
          ${owner ? `
            <span style="background:#ecfdf5; color:#047857; border-radius:999px; padding:5px 10px; font-size:11px; font-weight:900;">Director</span>
          ` : `
            <select class="form-input form-select" style="max-width:230px;" onchange="window.tcUpdateTournamentMemberRole('${safeUserId}', this.value)" ${isUserAdmin ? '' : 'disabled'}>
              ${ROLE_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}" ${option.value === role ? 'selected' : ''}>${escapeHtml(option.title)}</option>`).join('')}
            </select>
          `}
        </td>
        <td style="padding:16px;">
          <span style="background:${hasAdminAccess(role) ? '#ecfdf5' : '#fff7ed'}; color:${hasAdminAccess(role) ? '#047857' : '#c2410c'}; border-radius:999px; padding:5px 10px; font-size:11px; font-weight:900;">${hasAdminAccess(role) ? 'Can administer' : 'No admin rights'}</span>
        </td>
        <td style="padding:16px; text-align:right;">
          ${owner ? '<span style="font-size:12px; color:#64748b;">Owner protected</span>' : (isUserAdmin ? `
            <button class="btn btn--outline btn--sm" style="color:#ef4444; border-color:#fecaca;" onclick="window.tcRemoveTournamentMember('${safeUserId}')">${icon('trash', 14)} Remove</button>
          ` : '')}
        </td>
      </tr>
    `;
  };

  const renderUI = () => {
    const ownerRow = tournament?.owner_id
      ? renderMemberRow({ user_id: tournament.owner_id, role: 'Director' }, true)
      : '';
    const memberRows = memberships
      .filter(member => member.user_id !== tournament?.owner_id)
      .map(member => renderMemberRow(member))
      .join('');
    const adminCount = new Set([
      tournament?.owner_id,
      ...memberships.filter(member => hasAdminAccess(member.role)).map(member => member.user_id)
    ].filter(Boolean)).size;

    const content = `
      <div style="display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:24px; align-items:start;">
        <div style="display:grid; gap:20px;">
          <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; flex-wrap:wrap;">
              <div>
                <h2 style="font-size:18px; font-weight:900; margin:0 0 4px; color:#172033;">Tournament users</h2>
                <p style="font-size:13px; color:#64748b; margin:0;">Manage real admin access using the membership table.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <span style="background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:900;">${memberships.length + (tournament?.owner_id && !memberships.some(member => member.user_id === tournament.owner_id) ? 1 : 0)} users</span>
                <span style="background:#ecfdf5; color:#047857; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:900;">${adminCount} admins</span>
              </div>
            </div>

            <div style="overflow:auto; border:1px solid #e2e8f0; border-radius:8px;">
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                  <tr>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">User</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Role</th>
                    <th style="padding:12px 16px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase;">Permission</th>
                    <th style="padding:12px 16px;"></th>
                  </tr>
                </thead>
                <tbody>${ownerRow}${memberRows || ''}</tbody>
              </table>
            </div>
          </div>

          ${isUserAdmin ? `
            <form class="card" onsubmit="return window.tcAddTournamentMember(event)" style="padding:20px; display:grid; gap:16px;">
              <div>
                <h3 style="font-size:16px; font-weight:900; margin:0 0 4px;">Add admin user</h3>
                <p style="font-size:13px; color:#64748b; margin:0;">Ask the person to sign in, copy their Profile user ID, then paste it here.</p>
              </div>
              <div style="display:grid; grid-template-columns:minmax(0,1fr) 230px; gap:14px;">
                <label class="form-group">
                  <span class="form-label">User ID</span>
                  <input name="user_id" class="form-input" required placeholder="00000000-0000-0000-0000-000000000000">
                </label>
                <label class="form-group">
                  <span class="form-label">Role</span>
                  <select name="role" class="form-input form-select">
                    ${ROLE_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.title)}</option>`).join('')}
                  </select>
                </label>
              </div>
              <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button type="button" class="btn btn--outline" onclick="window.tcCopyAdminInvite()">${icon('copy', 15)} Copy invite instructions</button>
                <button type="submit" class="btn btn--primary">${icon('userPlus', 15)} Add user</button>
              </div>
            </form>
          ` : `
            <div class="card" style="padding:20px; border-color:#fed7aa; background:#fff7ed; color:#9a3412; font-size:13px;">
              You can view roles, but only tournament admins can change them.
            </div>
          `}
        </div>

        <aside style="display:grid; gap:16px;">
          <div class="card" style="padding:18px; border-color:#bfdbfe; background:#f8fbff;">
            <h3 style="font-size:15px; font-weight:900; color:#172033; margin:0 0 8px;">Simple permissions</h3>
            <p style="font-size:13px; color:#475569; line-height:1.5; margin:0;">Tabra keeps this lighter than CalicoTab: four roles grant admin access, and the rest are displayed as organizing roles until finer permissions are added.</p>
          </div>
          <div style="display:grid; gap:10px;">${renderRoleCards()}</div>
        </aside>
      </div>
    `;

    renderAppLayout(
      container,
      '/tournament/team-loc',
      'Admin users',
      'Invite helpers, assign roles, and control who can administer this tournament.',
      content
    );
  };

  fetchAndRender();
}
