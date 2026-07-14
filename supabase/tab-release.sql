-- Enables tournament admins to publish the rankings and speaker tab.
alter table public.tournaments
  add column if not exists is_tab_released boolean not null default false;

comment on column public.tournaments.is_tab_released is
  'Whether tournament rankings and speaker results are publicly visible.';

notify pgrst, 'reload schema';
