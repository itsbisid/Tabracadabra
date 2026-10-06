-- Run once in the existing Supabase project before deploying the PS feature.
-- PS uses a versioned event aggregate: draws, ballots and approvals commit together.
-- No browser role may read the private aggregate, audit history or write either.
create table if not exists public.ps_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ps_events_tournament_idx on public.ps_events(tournament_id);
create table if not exists public.ps_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.ps_events(id) on delete cascade,
  actor text not null,
  action text not null,
  reason text not null default '',
  previous_state jsonb,
  version integer not null,
  created_at timestamptz not null default now()
);
create index if not exists ps_audit_event_idx on public.ps_audit(event_id, id desc);
alter table public.ps_events enable row level security;
alter table public.ps_audit enable row level security;
revoke all on public.ps_events, public.ps_audit from anon, authenticated;
grant all on public.ps_events, public.ps_audit to service_role;
grant usage, select on sequence public.ps_audit_id_seq to service_role;

create or replace function public.ps_commit(
  p_event_id uuid, p_tournament_id text, p_version integer, p_state jsonb,
  p_actor text, p_action text, p_reason text default ''
) returns public.ps_events
language plpgsql security definer set search_path = public as $$
declare old_row public.ps_events; new_row public.ps_events;
begin
  -- Also serialize against tournament deletion. Its ID type may be text or UUID.
  perform 1 from public.tournaments where id::text = p_tournament_id for key share;
  if not found then raise exception 'Tournament not found.'; end if;
  if p_version = 0 then
    insert into public.ps_events(id, tournament_id, state)
      values(p_event_id, p_tournament_id, p_state) returning * into new_row;
  else
    select * into old_row from public.ps_events
      where id = p_event_id and tournament_id = p_tournament_id for update;
    if not found then raise exception 'Public speaking event not found.'; end if;
    if old_row.version <> p_version then
      raise exception using errcode = '40001', message = 'This event changed. Refresh and try again; your submission was not saved.';
    end if;
    update public.ps_events set state = p_state, version = version + 1, updated_at = now()
      where id = p_event_id returning * into new_row;
  end if;
  insert into public.ps_audit(event_id, actor, action, reason, previous_state, version)
    values(p_event_id, p_actor, p_action, left(p_reason, 1000), old_row.state, new_row.version);
  return new_row;
end;
$$;
revoke all on function public.ps_commit(uuid,text,integer,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.ps_commit(uuid,text,integer,jsonb,text,text,text) to service_role;

-- Works with both existing tournament deletion paths without modifying BP tables.
create or replace function public.ps_cleanup_tournament()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.ps_events where tournament_id = old.id::text;
  return old;
end;
$$;
revoke all on function public.ps_cleanup_tournament() from public, anon, authenticated;
drop trigger if exists ps_cleanup on public.tournaments;
create trigger ps_cleanup before delete on public.tournaments
for each row execute function public.ps_cleanup_tournament();
