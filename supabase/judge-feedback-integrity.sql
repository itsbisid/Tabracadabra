-- Run once in Supabase before deploying anonymous per-panel feedback.
alter table if exists public.judge_feedback
  add column if not exists is_anonymous boolean not null default false;

create unique index if not exists judge_feedback_one_per_target
  on public.judge_feedback (pairing_id, submitted_by_id, target_judge_id);

comment on column public.judge_feedback.is_anonymous is
  'Hides the submitter from judge-facing views; authorised tournament admins may still audit the source.';

-- Participant writes remain server-only through /api/portal-feedback.
-- Do not expose raw judge_feedback rows to anonymous clients in production.
drop policy if exists "judge_feedback_read_anon" on public.judge_feedback;

