# Public speaking in Tabracadabra

Public Speaking is an additional tournament workspace at `#/tournament/public-speaking`. It uses the current login, tournament owner/admin roles, visual design, adjudicator roster and venue names. Existing tournaments can add speaking events immediately after the migration; no debate data conversion is required.

## Activate

1. Run `supabase/public-speaking.sql` in the **existing** Supabase project's SQL editor. It is additive and safe to rerun. Back up the database through your normal deployment process first.
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
- Private links expire after 14 days. Generating a replacement immediately revokes the previous link. Withdrawn participants cannot use their links.
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

`ps_events` stores an event's validated, versioned JSON aggregate (roster, rubric, draws, ballots, evaluations and release flags). `ps_audit` stores actor/action/reason/version and the previous aggregate. These tables are separate from BP tables. This implementation deliberately keeps an event mutation atomic; it is not a table per ballot/speaker.

Both tables have RLS enabled and grants revoked for `anon` and `authenticated`. The service-role-only `ps_commit` transaction locks the event row, checks its version, writes its new state and audit snapshot together. Stale submissions get HTTP 409 and are not overwritten. The UI reloads the latest revision while retaining an open ballot form for review and resubmission.

All PS reads/writes go through the API. Admin identity is validated against Supabase Auth and the existing tournament ownership/membership roles. Participant tokens are purpose-specific HMAC tokens, distinct from existing BP links. Tokens are issued only by tournament administrators. Public/participant responses are explicit projections, never the raw aggregate. Public responses contain no ballots, scoring drafts, link versions or private evaluations.

A tournament deletion trigger removes its PS events and their audit records, including when deletion uses the pre-existing RPC or API path. Tournament IDs are handled as text for compatibility with the repository's mixed UUID/text schema. The commit function verifies that the tournament exists.

Limits: 2,000 people per role per event, 30 rounds, 100 rooms per round, 50 speakers/10 scoring judges per room, and 500 roster additions per request. These are validation limits, not load-test guarantees. Every mutation currently reads and rewrites one event aggregate and stores a prior snapshot; large events/high submission concurrency should move to normalized ballot tables and an audit retention policy. No production-scale load test has been performed.

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
