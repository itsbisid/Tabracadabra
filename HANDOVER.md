# Public Speaking (PS) — Handover

Branch: `feat/public-speaking` · PR: https://github.com/itsbisid/Tabracadabra/pull/2
Spec / definition of done: `docs/ps-expanded-brief.txt`
Feature docs: `docs/public-speaking.md`

Any session (Claude, Codex, a person) continuing this work should read this file first,
then pick up from **Next steps**. Update it after every stage.

## Run / test / deploy

```bash
npm ci
npm test          # node --test tests/*.test.js  (unit + API + PGlite DB tests)
npm run build     # tsc + vite build
npm run dev       # local dev server (serves /api/* too)
```

Supabase migrations, run in this order in the SQL editor (both are additive and safe to rerun):
1. `supabase/public-speaking.sql` (v1 aggregate tables; kept only so old events can be migrated)
2. `supabase/ps-v2.sql` (normalised tables + all `ps_v2_*` functions the app uses)
3. `select public.ps_migrate_v1_to_v2();` (copies any v1 events; rerunnable)

### Browser walkthrough (synthetic data, no real Supabase needed)

```bash
npm run ps:fake-supabase                 # terminal 1: fake Supabase on :54321, real PS SQL in PGlite
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=anon-test \
  SUPABASE_SERVICE_ROLE_KEY=service-test npx vite --port 4173   # terminal 2
npm run ps:e2e                            # terminal 3: Playwright walkthrough, screenshots in test-results/ps-e2e
```
Restart the fake backend for a clean database (it is in-memory). In a sandbox, set `PS_E2E_CHROMIUM=/opt/pw-browsers/chromium`.

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`.
Nothing here runs production SQL, merges or deploys automatically.

## Architecture (current)

- `api/public-speaking.js` — single POST endpoint. Admin actions use the Supabase session and
  existing tournament owner/admin roles. Participants use private PS links.
- `api-shared/ps-engine.js` — event state machine (`mutateEvent`), scoring, standings, breaks,
  allocation warnings, and `projectEvent` (role-specific projections, never raw state to non-admins).
- `api-shared/ps-rules.js` — configurable rules: rubric validation with Decimal arithmetic, example
  presets, timing penalties, capacity planner, schedule clash detection.
- `api-shared/ps-access.js` — private link tokens (random, hashed, typed `psl_`/`pss_`).
- `api-shared/ps-store.js` — all persistence via `ps_v2_*` RPCs (load, commit, list, audit, tokens, rate limits).
- `supabase/ps-v2.sql` — normalised tables (competitions, rule sets, entries, rounds, heats,
  assignments, ballots + revisions, criterion scores, evaluations, audit events, request receipts,
  access tokens, registration forms/submissions, conflicts, help requests, announcements, outbox).
- UI: `js/pages/tournament/public-speaking.js` (admin), `js/pages/ps-portal.js` (speaker/judge portal),
  `js/components/ps-ui.js`, `js/lib/ps-service.js`.

## Brief checklist (status from reading the code, not the docs)

Legend: ✅ done · 🟡 partial · ❌ missing

### Data & backend
- ✅ Normalised storage — API uses `ps-v2.sql` via `ps_v2_load`/`ps_v2_commit`; tested in PGlite; v1→v2 migration function.
- ✅ Optimistic concurrency (version check, HTTP 409).
- ✅ Idempotent submission retries — client sends `requestKey`; server replays the saved result.
- ✅ Audit trail (v1 `ps_audit`; v2 `ps_audit_events` + ballot revisions).
- ✅ Server-side permission checks; RLS denies browser roles.
- 🟡 Rate limiting — link redemption and bad-link attempts limited (`ps_v2_rate`); public registration not built yet.
- 🟡 Structured error logging for 5xx in the PS API; ❌ PS health check.
- ✅ CSV formula-injection protection (`csvDownload` prefixes risky cells).

### Rules & scoring
- ✅ Configurable rubric — engine uses `ps-rules.js` (descriptions, increments, precision, Decimal arithmetic).
- ✅ Weighted score mode; ✅ rank mode (mean ranks).
- ✅ Overtime penalties (configurable points/step/cap), elapsed time on ballots, shown in results.
- 🟡 Rules versioned (`ruleVersion`) and frozen once rounds exist; ❌ post-freeze migration/recalculation flow.
- ✅ Live calculation preview with a worked sample ballot in setup.
- ✅ Rank mode blocks unequal heats unless `within-heat` progression is chosen; panel-size mismatches need an override reason.

### Setup & planning
- ❌ Setup wizard (save-and-resume) and saved/duplicated templates.
- ✅ Labelled example templates in the setup form. ❌ Saving own templates / duplicating a competition.
- ❌ Room manager (bulk create Room 1..N, accessibility, capacity, availability windows).
- ✅ Capacity planner (API `plan` + setup card), tested with the brief's 60/8/6/2 fixture.
- ❌ Timetable: waves, time blocks, prep/travel buffers, multi-entry staggering.

### Registration & access
- ✅ Tab-entered speakers/judges, paste import, check-in, withdrawal.
- ❌ CSV import with column mapping + row errors + duplicate review.
- ❌ Public self-registration forms (builder, caps, waitlist, QR, edit/withdraw).
- ✅ Private links — random, hash-only storage, link→session exchange, clean URL, rotate/revoke, expiry, last-used status, rate limits, no-store/noindex/no-referrer, copy/WhatsApp share. ❌ Email delivery outbox.

### Draws & allocation
- ✅ Random balanced and ranked draws; manual edits; institution + repeat warnings with override reason.
- ❌ Judge availability, declared personal conflicts as hard blocks, trainees, standby judges.
- ❌ Lock assignments + targeted regeneration/repair; amendment workflow after publication.
- ❌ BP/PS clash detection across events (`scheduleConflicts` exists, unused).
- ❌ Impromptu topic storage and timed release.

### Ballots
- ✅ Per-judge ballots, unique ranks, submit lock, approve, reopen with reason, tab paper entry.
- 🟡 Request keys + one automatic retry after a dropped connection; ❌ autosave drafts / offline draft storage.
- ✅ Review screen before submit; structured feedback (worked / improve / try next) shown to speakers on release.
- ❌ Paper-ballot reconciliation with source IDs and second-person verification.

### Feedback, results, operations
- ✅ Separate results/feedback release; speaker-only feedback projection.
- ✅ Speaker→judge and judge→judge evaluations, confidential to admins.
- ❌ Configurable evaluation questions/scales/deadlines; scores-first feedback tracking.
- 🟡 Standings/breaks with explicit cutoff tie resolution; ❌ correction impact report for downstream rounds/breaks.
- ❌ Live operations dashboard, judge acknowledge/help requests, announcements for PS.
- ❌ Feedback export for speakers.

### Verification
- ✅ 28 tests: engine, rules (hand-calculated), PGlite DB, API against real SQL. ✅ Browser walkthrough script (`npm run ps:e2e`). ❌ BP regression tests.

## Build order

1. ~~Normalised storage + DB tests + v1→v2 migration~~ ✅
2. ~~Engine on `ps-rules.js`, preview, capacity planner~~ ✅
3. ~~Hashed, revocable, prefetch-safe private links~~ ✅
4. Room manager (bulk Room 1..N, accessibility, capacity, availability) + wire planner to real rooms.
5. Setup wizard (save-and-resume steps) + saved/duplicated templates.
6. Registration form builder + public sign-up (caps, waitlist, atomic quotas, QR).
7. Scheduling: judge availability, declared conflicts as hard blocks, BP/PS clash detection, standby/repair, waves/time blocks.
8. Ballot UX: autosave drafts (namespaced, cleared on leave), offline marking, paper reconciliation.
9. Feedback hub: configurable evaluation questions/deadlines, scores-first tracking, speaker feedback export; correction impact reports.
10. Live ops dashboard, judge acknowledge/help requests, PS announcements.
11. Every acceptance scenario in the brief + BP regression tests.

## Progress log

- 2026-10-06 — Codex work recovered and pushed. Checklist written (this file).
- 2026-10-06 — Stage 1: ps-v2.sql fixed (it had never run: reserved word, missing commit, jsonb/text loops, ambiguous alias, no delete cleanup) and wired in; ballot revisions; idempotent retries; PGlite tests.
- 2026-10-06 — Stage 2: configurable rules engine, live preview, capacity planner, penalties, structured feedback, ballot review screen; browser walkthrough + fake Supabase harness.
- 2026-10-06 — Stage 3: hashed private links with session exchange, revoke/rotate, rate limits, share controls.

## In progress

(nothing)

## Decisions & assumptions

- PS stays a separate workspace beside BP; BP tables are not modified.
- Server computes all totals; clients never send totals.

## Known issues

- Every commit rewrites the whole event through `ps_v2_commit` (simple and transactional, but O(event size)). Fine for typical events; for very large events consider per-ballot write paths.
- Removing a judge from a *published* heat is not supported yet (amendment workflow is item 7).
- `ps_events` (v1) is no longer written to; keep it until `ps_migrate_v1_to_v2()` has been run in production.
- `within-heat` rank progression compares relative position (0 = first, 1 = last); it is opt-in and documented, never applied silently.

## Next steps

1. Item 4 of Build order: room manager. Use the existing `ps_room_resources` / `ps_availability` tables (already in ps-v2.sql, tournament-scoped) — add `ps_v2_rooms_*` functions, an admin "Rooms" tab with "create N rooms", edit/rename/accessibility/capacity, and feed real room counts into the planner and draw dialog (rooms as a datalist today).
2. Then item 5 (setup wizard), reusing `settingsForm` sections as wizard steps.
3. Keep `npm test`, `npm run build` and `npm run ps:e2e` green after every stage.
