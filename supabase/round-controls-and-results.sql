-- Round-level panel, room, and blind-result controls.
-- Safe to run more than once.

alter table if exists public.rounds
  add column if not exists panel_size integer not null default 1;

alter table if exists public.rounds
  add column if not exists room_names text[] not null default '{}';

alter table if exists public.rounds
  add column if not exists results_released boolean not null default false;

-- Preserve the visibility of historical completed blind rounds when upgrading.
update public.rounds
set results_released = true
where lower(coalesce(status, '')) = 'completed';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rounds_panel_size_positive'
  ) then
    alter table public.rounds
      add constraint rounds_panel_size_positive check (panel_size >= 1);
  end if;
end $$;

comment on column public.rounds.panel_size is
  'Target number of adjudicators assigned to each generated debate panel.';
comment on column public.rounds.room_names is
  'Ordered room names used when generating pairings for this round.';
comment on column public.rounds.results_released is
  'Whether a blind round contributes to public standings.';

notify pgrst, 'reload schema';
