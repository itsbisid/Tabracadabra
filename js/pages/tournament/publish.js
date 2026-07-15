import { renderAppLayout } from '../../components/layout.js';
import { icon } from '../../components/icons.js';
import { supabase } from '../../lib/supabase.js';
import { requireActiveTournamentId } from '../../lib/tournament-context.js';
import { escapeHtml } from '../../lib/html.js';
import { isAdmin } from '../../lib/auth-helpers.js';

function statusPill(enabled) {
  return `<span style="background:${enabled ? '#ecfdf5' : '#fff7ed'}; color:${enabled ? '#047857' : '#c2410c'}; border-radius:999px; padding:5px 10px; font-size:11px; font-weight:900;">${enabled ? 'Published' : 'Hidden'}</span>`;
}

export async function renderPublish(container) {
  const tournamentId = requireActiveTournamentId();
  if (!tournamentId) return;

  let tournament = {};
  let isUserAdmin = false;

  const liveUrl = `${window.location.origin}/#/live/${tournamentId}`;

  const fetchAndRender = async () => {
    const [
      { data: tournamentData },
      { data: rounds },
      { data: pairings },
      { data: ballots },
      adminAllowed
    ] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('rounds').select('id, name, round_num, motion_text, status, is_blind, results_released').eq('tournament_id', tournamentId).order('round_num', { ascending: true }),
      supabase.from('draw_pairings').select('id').eq('tournament_id', tournamentId),
      supabase.from('ballots').select('id, pairing_id').eq('tournament_id', tournamentId),
      isAdmin(tournamentId)
    ]);

    tournament = tournamentData || {};
    isUserAdmin = adminAllowed;
    renderUI(rounds || [], pairings || [], ballots || []);
  };

  window.tcTogglePublicTab = async (shouldRelease) => {
    if (!isUserAdmin) {
      alert('Only tournament admins can publish or hide the live page.');
      return;
    }

    const text = shouldRelease
      ? 'Publish the live page now? Standings and motions will be visible to anyone with the link.'
      : 'Hide the live page now? Visitors with the link will see a not-published message.';
    if (!confirm(text)) return;

    const { error } = await supabase
      .from('tournaments')
      .update({ is_tab_released: shouldRelease })
      .eq('id', tournamentId);

    if (error) alert(error.message);
    else fetchAndRender();
  };

  window.tcCopyLiveUrl = () => {
    navigator.clipboard.writeText(liveUrl).then(() => alert('Live URL copied.'));
  };

  const renderUI = (rounds, pairings, ballots) => {
    const released = Boolean(tournament.is_tab_released);
    const completedRounds = rounds.filter(round => String(round.status || '').toLowerCase() === 'completed').length;
    const roundsWithMotions = rounds.filter(round => round.motion_text).length;
    const expectedBallots = pairings.length * 4;
    const ballotPct = expectedBallots ? Math.round((ballots.length / expectedBallots) * 100) : 0;
    const warnings = [
      !rounds.length ? 'No rounds have been created yet.' : '',
      pairings.length && ballotPct < 100 ? `Only ${ballotPct}% of expected team ballots are in.` : '',
      rounds.some(round => round.is_blind && !round.results_released) ? 'Some blind-round results are still withheld from standings.' : '',
      !roundsWithMotions ? 'No motions are available for the public page yet.' : ''
    ].filter(Boolean);

    const content = `
      <div style="display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:24px; align-items:start;">
        <div style="display:grid; gap:20px;">
          <section class="card" style="padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
              <div>
                <h2 style="font-size:20px; font-weight:900; color:#172033; margin:0 0 5px;">Public live page</h2>
                <p style="font-size:13px; color:#64748b; margin:0; max-width:640px;">One simple public link for standings and motions. This is the Tabra-sized version of CalicoTab publishing.</p>
              </div>
              ${statusPill(released)}
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px; margin-bottom:20px;">
              <div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Completed rounds</div>
                <div style="font-size:24px; font-weight:900;">${completedRounds}/${rounds.length}</div>
              </div>
              <div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Ballot completion</div>
                <div style="font-size:24px; font-weight:900;">${ballotPct}%</div>
              </div>
              <div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Motions set</div>
                <div style="font-size:24px; font-weight:900;">${roundsWithMotions}/${rounds.length}</div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${released
                ? `<button class="btn btn--danger" onclick="window.tcTogglePublicTab(false)">${icon('eyeOff', 15)} Hide live page</button>`
                : `<button class="btn btn--primary" onclick="window.tcTogglePublicTab(true)">${icon('eye', 15)} Publish live page</button>`}
              <button class="btn btn--outline" onclick="window.tcCopyLiveUrl()">${icon('copy', 15)} Copy URL</button>
              <a class="btn btn--outline" href="#/live/${escapeHtml(tournamentId)}" target="_blank" style="display:inline-flex; align-items:center; gap:8px;">${icon('monitor', 15)} Open preview</a>
            </div>
          </section>

          <section class="card" style="padding:24px;">
            <h3 style="font-size:16px; font-weight:900; color:#172033; margin:0 0 12px;">Live URL</h3>
            <div style="display:flex; gap:10px;">
              <input class="form-input" readonly value="${escapeHtml(liveUrl)}" style="font-family:monospace; font-size:13px;">
              <button class="btn btn--outline" onclick="window.tcCopyLiveUrl()">${icon('copy', 15)}</button>
            </div>
          </section>
        </div>

        <aside style="display:grid; gap:16px;">
          <section class="card" style="padding:20px; border-color:${warnings.length ? '#fed7aa' : '#bbf7d0'}; background:${warnings.length ? '#fff7ed' : '#f8fffb'};">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <div style="color:${warnings.length ? '#d97706' : '#059669'};">${icon(warnings.length ? 'alertCircle' : 'checkCircle', 18)}</div>
              <div>
                <h3 style="font-size:14px; font-weight:900; color:#172033; margin:0 0 8px;">Pre-publish check</h3>
                ${warnings.length
                  ? `<div style="display:grid; gap:8px;">${warnings.map(warning => `<div style="font-size:13px; color:#9a3412; line-height:1.45;">${escapeHtml(warning)}</div>`).join('')}</div>`
                  : '<p style="font-size:13px; color:#047857; line-height:1.5; margin:0;">Everything important is ready to publish.</p>'}
              </div>
            </div>
          </section>

          <section class="card" style="padding:20px;">
            <h3 style="font-size:14px; font-weight:900; color:#172033; margin:0 0 8px;">What appears publicly</h3>
            <div style="display:grid; gap:8px; font-size:13px; color:#64748b;">
              <div>${icon('trophy', 14)} Team standings</div>
              <div>${icon('fileText', 14)} Released motions</div>
              <div>${icon('users', 14)} Basic tournament counts</div>
            </div>
          </section>
        </aside>
      </div>
    `;

    renderAppLayout(container, '/tournament/publish', 'Publish & Live URL', 'Control the simple public results page.', content);
  };

  fetchAndRender();
}
