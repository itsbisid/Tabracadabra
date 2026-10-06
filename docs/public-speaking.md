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
- Server-generated draws (balanced prelims, snaked elims) with speaking-order balancing, conflict-aware judge panels, a reproducible seed and an explanation; manual edits before saving.
- Institutional and repeated-allocation warnings with a mandatory override reason before publishing. Duplicate participants and judges in a round are rejected.
- One independent ballot per assigned judge. Weighted criterion scores, unique room ranks, complete drafts, submitted locks, receipts and tab approval. Tab can enter a paper ballot with a reason and reopen an uncompleted round's ballot with a correction reason.
- All assigned ballots must be approved before round completion. Completed rounds are immutable.
- Panel-averaged scores and ranks, cumulative preliminary standings, round standings, category-filtered final breaks and explicit resolution of exact cutoff ties.
- Separate results/feedback release controls. Public event link shows published draws/results. Private speaker links show only that speaker's released written feedback and criterion scores.
- Speakers can evaluate their assigned judges; judges can evaluate other judges in their room. Evaluations are confidential to tournament admins.
- Private links expire after 14 days and are stored only as hashes. Generating a replacement or revoking immediately ends the previous link and its sessions. Withdrawn participants cannot use their links.
- CSV standings and speaker exports; print styling for draws/results; recent change history.

## Choosing the format

When creating a tournament, **Competition tracks** decides what you set up: *Debate only* shows debate settings; *Public speaking only* shows the public speaking settings (template, criteria and weights, heats, timing, live calculation preview) and creates the first speaking event; *Debate + Public speaking* shows both. The sidebar and the Settings page follow the same choice, and tracks can be changed later in Settings → Competition & scoring.

Debate speaker scoring is configurable: one score per speaker with a minimum, maximum and increment, or 1–10 criteria (e.g. Matter /40, Manner /40, Method /20) whose marks add up to the speaker score. Ballots and the judge portal enforce it on the server. Tournaments created before this setting keep the previous 60–80 range.

## How draws are made (pairing / sectioning)

Tab clicks **Generate draw** on a draft round; the server (`api-shared/ps-draw.js`) proposes sections, speaking order and judges, explains them, and nothing is saved until tab reviews and saves. Every draw has a seed; entering the same seed reproduces it.

The rules follow published speech-tab practice, mainly the NSDA district tournament manual (sections of 4–7, ideally 6; first avoid same-school sections, then repeat meetings; even out speaking positions; snake eliminations), with Tabroom and SpeechWire documentation for section sizing, school limits, judge conflicts and snaking. It is a heuristic search and is not presented as any body's official algorithm.

- **Section sizes:** sections = ⌈speakers ÷ max per heat⌉ unless tab chooses a number; sizes differ by at most one and must respect the event's min/max.
- **Balanced draw (prelims):** random start, then swaps that reduce a cost of 1000 per same-institution pair and 100 per pair who have met before, with several restarts.
- **Snake draw (elims / power rounds):** serpentine by preliminary standings (1 → Section 1, 2 → Section 2 … then back). Only speakers with identical standings are swapped, to separate institutions.
- **Speaking order:** prelims balance each speaker's average position and give everyone an early (first two) and a late (last two) slot where the field allows; elims order speakers by the reverse of their past positions (whoever has spoken latest overall speaks first).
- **Judges:** each section gets its configured panel (prelim/final), avoiding judges from a speaker's institution, judges who have already judged a speaker, and uneven workloads. Conflicted judges are kept on standby when spares exist.
- **Nothing is hidden:** the draw report lists unavoidable same-school pairs, repeat meetings, judge conflicts and judge shortages. Publishing still requires an override reason for any remaining allocation warning (now including same-school sections).

Tested in `tests/ps-draw.test.js`: 60 speakers from 10 schools give 10 clean sections of 6; across three prelims schools stay apart, repeats hit the proven minimum, and 23+ of 24 speakers get both an early and a late slot; spare judges absorb conflicts; snake seeding and reverse elim speaking order.

Sources: [NSDA district tournament operations manual](https://www.speechanddebate.org/wp-content/uploads/District-Tournament-Pilot-Manual-2020-2021-1.pdf), [Tabroom: pairing rounds](https://docs.tabroom.com/quick-start/pairing-rounds), [Tabroom: event settings](https://docs.tabroom.com/Events), [SpeechWire features](https://www.speechwire.com/p-features.php), [UHSAA speech rules](https://www.uhsaa.org/Publications/Handbook/ActivitiesSections/SpeechDebate.pdf), [serpentine system](https://en.wikipedia.org/wiki/Serpentine_system).

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
