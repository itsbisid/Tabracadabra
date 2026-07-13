-- TabraCadabra — Row-Level Security policies (production hardening).
--
-- WHAT THIS DOES
--   * Enables RLS on every table.
--   * READS stay open (anon + authenticated). The public participant portal and
--     several app pages read directly with the anon key, so locking reads down
--     would break them. This means "blind tab" remains a UI convention, not a
--     hard guarantee — see the note at the bottom.
--   * WRITES are locked to the tournament owner or an admin member. This closes
--     the critical hole where any visitor could overwrite teams, ballots, draws,
--     and standings via the anon key.
--   * Participant writes (ballots from the portal, judge feedback, check-ins,
--     push subscriptions) go through Vercel API routes that use the service role
--     key, which BYPASSES RLS. So those tables need no anon/authenticated write
--     policy — denying browser writes is exactly what we want.
--
-- SAFE TO RE-RUN: every policy is dropped first, so this is idempotent.
--
-- Run this in the Supabase SQL editor (as the postgres role) before Friday,
-- then smoke-test each admin page and the participant portal.

-- ---------------------------------------------------------------------------
-- Admin check: is the current user the owner or an admin member of tournament?
-- SECURITY DEFINER so it can read tournaments/memberships past their own RLS.
-- ---------------------------------------------------------------------------
-- NOTE: tournament_id columns are inconsistently typed in this schema — some
-- tables use `text`, others `uuid`. The parameter is therefore `text` and every
-- caller passes `<col>::text`, which is valid for both column types.
drop function if exists public.is_tournament_admin(uuid);
create or replace function public.is_tournament_admin(tid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id::text = tid and t.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.tournament_memberships m
    where m.tournament_id::text = tid
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, '')) in ('director', 'tab_director', 'convenor', 'deputy_convenor')
  );
$$;

-- Idempotency store for outbound email (see api/email-idempotency.js).
create table if not exists public.sent_emails (
  idempotency_key text primary key,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- tournaments
-- ===========================================================================
alter table public.tournaments enable row level security;

drop policy if exists tournaments_select on public.tournaments;
drop policy if exists tournaments_insert on public.tournaments;
drop policy if exists tournaments_update on public.tournaments;
drop policy if exists tournaments_delete on public.tournaments;

create policy tournaments_select on public.tournaments
  for select to anon, authenticated using (true);

create policy tournaments_insert on public.tournaments
  for insert to authenticated with check (owner_id = auth.uid());

create policy tournaments_update on public.tournaments
  for update to authenticated
  using (is_tournament_admin(id::text)) with check (is_tournament_admin(id::text));

create policy tournaments_delete on public.tournaments
  for delete to authenticated using (is_tournament_admin(id::text));

-- ===========================================================================
-- tournament_memberships
-- ===========================================================================
alter table public.tournament_memberships enable row level security;

drop policy if exists memberships_select on public.tournament_memberships;
drop policy if exists memberships_insert on public.tournament_memberships;
drop policy if exists memberships_update on public.tournament_memberships;
drop policy if exists memberships_delete on public.tournament_memberships;

create policy memberships_select on public.tournament_memberships
  for select to authenticated
  using (user_id = auth.uid() or is_tournament_admin(tournament_id::text));

-- Owner (or existing admin) may add members; on tournament creation the owner is
-- already the tournaments.owner_id so is_tournament_admin() is true.
create policy memberships_insert on public.tournament_memberships
  for insert to authenticated with check (is_tournament_admin(tournament_id::text));

create policy memberships_update on public.tournament_memberships
  for update to authenticated
  using (is_tournament_admin(tournament_id::text)) with check (is_tournament_admin(tournament_id::text));

create policy memberships_delete on public.tournament_memberships
  for delete to authenticated using (is_tournament_admin(tournament_id::text));

-- ===========================================================================
-- Tables keyed directly by tournament_id: admin-write, open-read.
-- teams, adjudicators, rounds, draw_pairings, venues, announcements, ballots
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['teams','adjudicators','rounds','draw_pairings','venues','announcements','ballots']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete', t);

    execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (is_tournament_admin(tournament_id::text));', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (is_tournament_admin(tournament_id::text)) with check (is_tournament_admin(tournament_id::text));', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (is_tournament_admin(tournament_id::text));', t || '_delete', t);
  end loop;
end $$;

-- ===========================================================================
-- adjudicator_allocations: no tournament_id column — resolve via draw_pairings.
-- ===========================================================================
alter table public.adjudicator_allocations enable row level security;

drop policy if exists allocations_select on public.adjudicator_allocations;
drop policy if exists allocations_insert on public.adjudicator_allocations;
drop policy if exists allocations_update on public.adjudicator_allocations;
drop policy if exists allocations_delete on public.adjudicator_allocations;

create policy allocations_select on public.adjudicator_allocations
  for select to anon, authenticated using (true);

create policy allocations_insert on public.adjudicator_allocations
  for insert to authenticated with check (
    exists (select 1 from public.draw_pairings dp
            where dp.id = pairing_id and is_tournament_admin(dp.tournament_id::text)));

create policy allocations_update on public.adjudicator_allocations
  for update to authenticated using (
    exists (select 1 from public.draw_pairings dp
            where dp.id = pairing_id and is_tournament_admin(dp.tournament_id::text)));

create policy allocations_delete on public.adjudicator_allocations
  for delete to authenticated using (
    exists (select 1 from public.draw_pairings dp
            where dp.id = pairing_id and is_tournament_admin(dp.tournament_id::text)));

-- ===========================================================================
-- registration_links: anon reads by token (public form), admin writes.
-- ===========================================================================
alter table public.registration_links enable row level security;

drop policy if exists reg_links_select on public.registration_links;
drop policy if exists reg_links_insert on public.registration_links;
drop policy if exists reg_links_update on public.registration_links;
drop policy if exists reg_links_delete on public.registration_links;

create policy reg_links_select on public.registration_links
  for select to anon, authenticated using (true);
create policy reg_links_insert on public.registration_links
  for insert to authenticated with check (is_tournament_admin(tournament_id::text));
create policy reg_links_update on public.registration_links
  for update to authenticated using (is_tournament_admin(tournament_id::text)) with check (is_tournament_admin(tournament_id::text));
create policy reg_links_delete on public.registration_links
  for delete to authenticated using (is_tournament_admin(tournament_id::text));

-- ===========================================================================
-- registration_submissions: anon INSERT (public form), admin read/manage.
-- Anon may NOT read submissions (they contain other people's contact details).
-- ===========================================================================
alter table public.registration_submissions enable row level security;

drop policy if exists reg_subs_select on public.registration_submissions;
drop policy if exists reg_subs_insert on public.registration_submissions;
drop policy if exists reg_subs_update on public.registration_submissions;
drop policy if exists reg_subs_delete on public.registration_submissions;

create policy reg_subs_select on public.registration_submissions
  for select to authenticated using (is_tournament_admin(tournament_id::text));
create policy reg_subs_insert on public.registration_submissions
  for insert to anon, authenticated with check (true);
create policy reg_subs_update on public.registration_submissions
  for update to authenticated using (is_tournament_admin(tournament_id::text)) with check (is_tournament_admin(tournament_id::text));
create policy reg_subs_delete on public.registration_submissions
  for delete to authenticated using (is_tournament_admin(tournament_id::text));

-- ===========================================================================
-- Participant tables: writes ONLY via service-role API routes (RLS bypassed).
-- Reads stay open because the anon portal displays these.
-- judge_feedback, portal_check_ins
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['judge_feedback','portal_check_ins']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_select', t);
    -- No insert/update/delete policies: browser clients cannot write; the
    -- service-role API routes bypass RLS and remain the only writers.
  end loop;
end $$;

-- ===========================================================================
-- push_subscriptions: fully service-role only (no browser read or write).
-- ===========================================================================
alter table public.push_subscriptions enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) touches
-- this table, via the push API routes.

-- ---------------------------------------------------------------------------
-- IMPORTANT FOLLOW-UP (not blocking Friday, but do it):
--   Reads on `ballots` remain open, so a determined visitor can read raw scores
--   even while the tab is "blind". To make blind-tab a real guarantee, route the
--   standings/speaker-tab reads through a service-role API route that checks
--   tournaments.is_tab_released, and replace the ballots_select policy above with
--   `using (false)` (service role still reads). That is a larger change; ship
--   this migration first, harden reads afterward.
-- ---------------------------------------------------------------------------
