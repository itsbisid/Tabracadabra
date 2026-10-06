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
1. `supabase/public-speaking.sql` (v1 aggregate tables + `ps_commit`; kept for existing data)
2. `supabase/ps-v2.sql` (normalised tables + `ps_v2_load` / `ps_v2_commit`)

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`.
Nothing here runs production SQL, merges or deploys automatically.

## Architecture (current)

- `api/public-speaking.js` — single POST endpoint. Admin actions use the Supabase session and
  existing tournament owner/admin roles. Participants use private PS links.
- `api-shared/ps-engine.js` — event state machine (`mutateEvent`), scoring, standings, breaks,
  allocation warnings, and `projectEvent` (role-specific projections, never raw state to non-admins).
- `api-shared/ps-rules.js` — configurable rules: rubric validation with Decimal arithmetic, example
  presets, timing penalties, capacity planner, schedule clash detection.
- `api-shared/ps-access.js` — private participant links.
- `supabase/ps-v2.sql` — normalised tables (competitions, rule sets, entries, rounds, heats,
  assignments, ballots + revisions, criterion scores, evaluations, audit events, request receipts,
  access tokens, registration forms/submissions, conflicts, help requests, announcements, outbox).
- UI: `js/pages/tournament/public-speaking.js` (admin), `js/pages/ps-portal.js` (speaker/judge portal),
  `js/components/ps-ui.js`, `js/lib/ps-service.js`.

## Brief checklist (status from reading the code, not the docs)

Legend: ✅ done · 🟡 partial · ❌ missing

### Data & backend
- 🟡 Normalised storage — `ps-v2.sql` schema exists but **was not wired in or tested**; API still uses the v1 JSON aggregate (`ps_events`).
- ✅ Optimistic concurrency (version check, HTTP 409).
- 🟡 Idempotent submission retries — request receipts exist in v2 SQL only.
- ✅ Audit trail (v1 `ps_audit`; v2 `ps_audit_events` + ballot revisions).
- ✅ Server-side permission checks; RLS denies browser roles.
- ❌ Rate limiting on public/sensitive endpoints.
- ❌ Health check / structured logging for PS.
- ❌ CSV formula-injection protection on exports (check `export-*`).

### Rules & scoring
- 🟡 Configurable rubric — engine supports name/max/weight only; `ps-rules.js` (descriptions, min, step, precision, presets, penalties) **not used by engine**.
- ✅ Weighted score mode; ✅ rank mode (mean ranks).
- ❌ Timing penalties applied (implemented in `ps-rules.js`, not wired).
- 🟡 Rule freeze — rules freeze once rounds exist; no versioned migration/recalculation flow.
- ❌ Calculation preview / sample ballot in setup.
- 🟡 Unequal panel/heat validation for rank mode — in `ps-rules.capacityPlan` only.

### Setup & planning
- ❌ Setup wizard (save-and-resume) and saved/duplicated templates.
- 🟡 Example presets (prepared/impromptu/interpretation) — defined in `ps-rules.js`, not in UI.
- ❌ Room manager (bulk create Room 1..N, accessibility, capacity, availability windows).
- 🟡 Capacity planner — function exists, no endpoint/UI, untested.
- ❌ Timetable: waves, time blocks, prep/travel buffers, multi-entry staggering.

### Registration & access
- ✅ Tab-entered speakers/judges, paste import, check-in, withdrawal.
- ❌ CSV import with column mapping + row errors + duplicate review.
- ❌ Public self-registration forms (builder, caps, waitlist, QR, edit/withdraw).
- 🟡 Private links — HMAC signed, expiring, revoked by version bump. Brief wants random tokens stored as hashes, prefetch-safe redemption, no-store/noindex/referrer policy.

### Draws & allocation
- ✅ Random balanced and ranked draws; manual edits; institution + repeat warnings with override reason.
- ❌ Judge availability, declared personal conflicts as hard blocks, trainees, standby judges.
- ❌ Lock assignments + targeted regeneration/repair; amendment workflow after publication.
- ❌ BP/PS clash detection across events (`scheduleConflicts` exists, unused).
- ❌ Impromptu topic storage and timed release.

### Ballots
- ✅ Per-judge ballots, unique ranks, submit lock, approve, reopen with reason, tab paper entry.
- ❌ Autosave + offline-safe retry + idempotency key from client.
- ❌ Review screen before submit; structured feedback (worked / improve / try next).
- ❌ Paper-ballot reconciliation with source IDs and second-person verification.

### Feedback, results, operations
- ✅ Separate results/feedback release; speaker-only feedback projection.
- ✅ Speaker→judge and judge→judge evaluations, confidential to admins.
- ❌ Configurable evaluation questions/scales/deadlines; scores-first feedback tracking.
- 🟡 Standings/breaks with explicit cutoff tie resolution; ❌ correction impact report for downstream rounds/breaks.
- ❌ Live operations dashboard, judge acknowledge/help requests, announcements for PS.
- ❌ Feedback export for speakers.

### Verification
- ✅ 11 unit/API tests. ❌ PGlite DB tests in repo. ❌ Browser (Playwright) tests in repo. ❌ BP regression tests.

## Build order

1. Normalised storage wired + PGlite DB tests + v1→v2 migration.
2. Engine on `ps-rules.js` (Decimal, presets, steps, penalties, capacity planner endpoint).
3. Hashed, revocable, prefetch-safe private links.
4. Room manager + capacity planner UI.
5. Setup wizard + templates.
6. Registration form builder + public sign-up (caps, waitlist).
7. Scheduling: availability, conflicts, clash detection, standby/repair.
8. Ballot UX: autosave, retry, review screen, structured feedback, paper reconciliation.
9. Feedback hub upgrades, correction impact reports.
10. Live ops dashboard, help requests, announcements.
11. Every acceptance scenario in the brief + BP regression.

## Progress log

- 2026-10-06 — Codex work recovered and pushed. Checklist written (this file).

## In progress

(nothing)

## Decisions & assumptions

- PS stays a separate workspace beside BP; BP tables are not modified.
- Server computes all totals; clients never send totals.

## Known issues

- `supabase/ps-v2.sql` untested before this stage.

## Next steps

1. Stage 1 — see Build order.
