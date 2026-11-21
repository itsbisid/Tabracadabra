-- Completed preliminary-round results remain immutable while a tournament is active.
-- Marking the tournament completed re-enables authorised corrections/archival work.
create or replace function public.protect_completed_round_ballots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pairing_id text;
  target_round_status text;
  target_tournament_status text;
begin
  target_pairing_id := coalesce(new.pairing_id::text, old.pairing_id::text);

  select lower(coalesce(r.status, '')), lower(coalesce(t.status, ''))
    into target_round_status, target_tournament_status
  from public.draw_pairings p
  join public.rounds r on r.id::text = p.round_id::text
  join public.tournaments t on t.id::text = r.tournament_id::text
  where p.id::text = target_pairing_id;

  if target_round_status = 'completed'
     and target_tournament_status not in ('completed', 'ended', 'archived') then
    raise exception 'Completed-round ballot points are locked until the tournament ends.'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_completed_round_ballots_trigger on public.ballots;
create trigger protect_completed_round_ballots_trigger
before insert or update or delete on public.ballots
for each row execute function public.protect_completed_round_ballots();

