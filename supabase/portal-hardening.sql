-- TabraCadabra private portal hardening reference.
-- Do not run this blindly on production. Enabling RLS without complete policies
-- can block current dashboard workflows that still use the browser Supabase client.
--
-- Safe first step after moving all admin writes behind Vercel API routes:
-- keep participant portal mutations server-only by denying anon writes.

alter table if exists public.portal_check_ins enable row level security;
alter table if exists public.judge_feedback enable row level security;
alter table if exists public.ballots enable row level security;

drop policy if exists "portal_check_ins_read_anon" on public.portal_check_ins;
drop policy if exists "judge_feedback_read_anon" on public.judge_feedback;
drop policy if exists "ballots_read_anon" on public.ballots;

create policy "portal_check_ins_read_anon"
  on public.portal_check_ins
  for select
  to anon, authenticated
  using (true);

create policy "judge_feedback_read_anon"
  on public.judge_feedback
  for select
  to anon, authenticated
  using (true);

create policy "ballots_read_anon"
  on public.ballots
  for select
  to anon, authenticated
  using (true);

-- No anon/authenticated insert/update/delete policies are defined above.
-- Vercel API routes use SUPABASE_SERVICE_ROLE_KEY and bypass RLS for validated writes.
-- Before enabling RLS on dashboard tables such as tournaments, teams,
-- adjudicators, registration_links, registration_submissions, and venues,
-- add explicit owner/member policies or move those dashboard writes to API routes too.
