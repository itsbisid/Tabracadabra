-- Adds round visibility controls and team mascot support.
-- Safe to re-run.

alter table if exists public.rounds
  add column if not exists is_blind boolean not null default true;

alter table if exists public.teams
  add column if not exists emoji text not null default '⭐';
