# Public speaking in Tabracadabra

Public Speaking is an additional tournament workspace at `#/tournament/public-speaking`. It uses the current login, tournament owner/admin roles, visual design, adjudicator roster and venue names. Existing tournaments can add speaking events immediately after the migration; no debate data conversion is required.

## Activate

1. Back up the database, then run these in the **existing** Supabase project's SQL editor, in order (both are additive and safe to rerun):
   1. `supabase/public-speaking.sql` — original storage, kept so existing PS events can be migrated.
   2. `supabase/ps-v2.sql` — normalised tables the app now uses.
   3. `select public.ps_migrate_v1_to_v2();` — copies any events created with the first version. Returns how many were copied; rerunning copies nothing twice.
2. Configure the existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY` in the hosting environment. Never expose the service key with a `VITE_` prefix.
3. Deploy this branch through the existing Vercel build (`npm ci`, `npm run build`). The new `/api/public-speaking` route is a Vercel function. Local `npm run dev` also serves it.
4. Open a tournament as its owner or an admin. Choose **Public speaking → Events & tabulation**.
5. Run a small test event before accepting live submissions.

This change does not automatically run production SQL, merge a branch, deploy a site, or send invitations.

## Included workflow

- Multiple speaking events per tournament: prepared, impromptu, Programme of Oral Interpretation, or other.
- Configurable rubric, criterion maximums, weights totalling 100, score/rank tabulation and an informational speech duration. Rules freeze when the first round is created.
- Individual speaker registration by tab, institution/category fields, spreadsheet-column paste, roster export, participant check-in and withdrawal/restoration.
- Import existing tournament adjudicators or add event-specific judges. Existing venue names are offered in the draw editor.
- Preliminary, semifinal and final rounds with explicit speaker selection. One unfinished round per event.
- Random balanced draws or draws grouping similarly ranked speakers; manual room, speaking order and judging panel edits.
- Institutional and repeated-allocation warnings with a mandatory override reason before publishing. Duplicate participants and judges in a round are rejected.
- One independent ballot per assigned judge. Weighted criterion scores, unique room ranks, complete drafts, submitted locks, receipts and tab approval. Tab can enter a paper ballot with a reason and reopen an uncompleted round's ballot with a correction reason.
- All assigned ballots must be approved before round completion. Completed rounds are immutable.
- Panel-averaged scores and ranks, cumulative preliminary standings, round standings, category-filtered final breaks and explicit resolution of exact cutoff ties.
- Separate results/feedback release controls. Public event link shows published draws/results. Private speaker links show only that speaker's released written feedback and criterion scores.
- Speakers can evaluate their assigned judges; judges can evaluate other judges in their room. Evaluations are confidential to tournament admins.
- Private links expire after 14 days and are stored only as hashes. Generating a replacement or revoking immediately ends the previous link and its sessions. Withdrawn participants cannot use their links.
- CSV standings and speaker exports; print styling for draws/results; recent change history.

## Scoring rules

Each criterion contributes `(mark / maximum) × weight`. Weights total 100, so each judge's score is out of 100. Scores are averaged across the room's assigned scoring judges. Mean rank is also averaged across judges, keeping rooms with different panel sizes comparable.

- **Score mode:** descending sum of round mean scores, then ascending sum of round mean ranks.
- **Rank mode:** ascending sum of round mean ranks, then descending sum of round mean scores.
- Each round has equal weight. Calculations retain four decimal places; display uses two.
- Exact ties share a place. Alphabetical display order never decides qualification.
- Generated breaks require all preliminary rounds to be completed. Only active speakers with a result in every preliminary round are eligible. A cutoff tie blocks generation until tab supplies the necessary tied selections and a reason.
- Semifinal/final results do not enter cumulative preliminary standings. A final can be generated from preliminary standings; qualification from semifinals is selected manually when creating a final round.
- Speech duration is guidance, not an automatic timing penalty.

## Storage and access

PS data lives in normalised tables (`supabase/ps-v2.sql`): competitions, rule sets, entries, rounds, heats, speaker/judge assignments, ballots with revisions, performances, criterion scores, evaluations, audit events, request receipts, access tokens, registration forms/submissions, conflicts, help requests, announcements and a notification outbox. Foreign keys and uniqueness constraints keep records scoped to their event.

The engine (`api-shared/ps-engine.js`) works on a loaded event and the `ps_v2_commit` function writes the result in one transaction: it locks the event, checks its version (stale writes get HTTP 409), records an audit event, keeps the previous version of any changed ballot in `ps_ballot_revisions`, and stores a request receipt. Clients may send a `requestKey` (UUID); retrying the same request returns the saved result instead of applying it twice, and reusing a key for a different request is refused.

All tables have RLS enabled and no grants for `anon`/`authenticated`; only the service role (the API) can call the `ps_v2_*` functions. Deleting a tournament deletes its PS data. Private participant links are 256-bit random tokens (`psl_…`); only their SHA-256 hashes are stored in `ps_access_tokens`. The portal exchanges the link (by POST, never on page load by a server, so email/link scanners cannot use it up) for a 12-hour session token (`pss_…`) kept in that browser tab only, and removes the link from the address bar. Issuing a new link replaces the old one; revoking a link, or withdrawing the participant, ends its sessions immediately on the server. Failed link attempts and link redemptions are rate limited per client. Link issue/revoke is recorded in the audit history, and the admin roster shows whether each person's link is active and has been used. Links are never stored, so tab copies or shares them (copy, copy message, WhatsApp) at the moment they are created. Public/participant responses are explicit projections, never the raw event.

`tests/ps-db.test.js` runs the migrations in PGlite and checks that every mutation of a full tournament round-trips exactly, plus idempotent retries, stale-write rejection, tournament scoping, browser-role denial, deletion cleanup and v1→v2 migration. `tests/public-speaking-api.test.js` exercises the API against the same database.

## Deliberately outside this implementation

- Public self-registration and automatic invitation emails/push notifications for PS.
- Automatic schedule clash detection across PS events and BP rounds; tab must check shared people/venues manually.
- Trainee/non-scoring judge allocation, personal clash lists and judge availability calendars.
- Automatic timing penalties, score dropping, custom tie-break formulas and cross-event overall awards.
- Automatic advancement from semifinals, bracket management and editing a completed round.
- Offline submission and automatic background draft saving (use **Save draft**).

These can be added to this same workspace without replacing the debate system.

## Verification

`npm test` covers scoring, panel aggregation, ballot validation, locks/reopening, publication privacy, allocation rules, exact ties, private token expiry/rotation, administrator authorization and stale API writes. `npm run build` compiles the full existing application.

The migration was also exercised in an isolated PostgreSQL-compatible PGlite database for both text and UUID tournament IDs: reruns, transaction version conflict, audit records, anon/authenticated denials and tournament-deletion cleanup. This is not a migration against the live Supabase project.
