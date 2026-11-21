alter table if exists public.rounds
  add column if not exists winner_team_id text,
  add column if not exists winning_adjudicator_id text;

comment on column public.rounds.winner_team_id is 'Official winning team recorded for an elimination final.';
comment on column public.rounds.winning_adjudicator_id is 'Official winning/best adjudicator recorded for an elimination final.';

