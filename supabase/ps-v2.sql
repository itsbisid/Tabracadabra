-- Public Speaking v2: additive, normalized records. Run after public-speaking.sql.
-- All access goes through checked server endpoints. Existing BP tables are untouched.
begin;
create table if not exists public.ps_competitions (
 id uuid primary key default gen_random_uuid(), tournament_id text not null,
 name text not null, discipline text not null, version integer not null default 1,
 rule_version integer not null default 1, settings jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ps_competitions_tournament on public.ps_competitions(tournament_id);
create table if not exists public.ps_rule_sets (
 event_id uuid not null references public.ps_competitions(id) on delete cascade,
 version integer not null, configuration jsonb not null, created_at timestamptz not null default now(),
 primary key(event_id,version)
);
create table if not exists public.ps_entries (
 event_id uuid not null references public.ps_competitions(id) on delete cascade, id uuid not null,
 role text not null check(role in ('speaker','judge')), name text not null,
 institution text not null default '', category text not null default '', email text not null default '',
 status text not null default 'accepted' check(status in ('pending','accepted','waitlisted','rejected','withdrawn')),
 active boolean not null default true, checked_in boolean not null default false,
 user_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
 primary key(event_id,id)
);
alter table public.ps_entries add column if not exists sort_order integer not null default 0;
create table if not exists public.ps_round_records (
 event_id uuid not null references public.ps_competitions(id) on delete cascade, id uuid not null,
 sequence integer not null, name text not null, stage text not null, status text not null,
 rule_version integer not null, assignment_version integer not null default 1,
 draw_published boolean not null default false, results_published boolean not null default false,
 feedback_published boolean not null default false, needs_review boolean not null default false,
 metadata jsonb not null default '{}', primary key(event_id,id), unique(event_id,sequence),
 foreign key(event_id,rule_version) references public.ps_rule_sets(event_id,version)
);
create table if not exists public.ps_round_entries (
 event_id uuid not null, round_id uuid not null, entry_id uuid not null,
 primary key(event_id,round_id,entry_id), foreign key(event_id,round_id) references public.ps_round_records(event_id,id) on delete cascade,
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id)
);
create table if not exists public.ps_room_resources (
 id uuid primary key default gen_random_uuid(), tournament_id text not null, name text not null,
 building text not null default '', instructions text not null default '', accessible boolean not null default false,
 seating_capacity integer check(seating_capacity > 0), equipment text not null default '',
 meeting_url text, active boolean not null default true, unique(tournament_id,name)
);
create table if not exists public.ps_availability (
 id uuid primary key default gen_random_uuid(), tournament_id text not null, resource_id text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, available boolean not null,
 check(ends_at > starts_at)
);
create table if not exists public.ps_heats (
 event_id uuid not null, id uuid not null, round_id uuid not null, name text not null,
 room_id uuid references public.ps_room_resources(id), wave integer not null default 1,
 starts_at timestamptz, ends_at timestamptz, locked boolean not null default false,
 primary key(event_id,id), foreign key(event_id,round_id) references public.ps_round_records(event_id,id) on delete cascade,
 check(ends_at is null or starts_at is null or ends_at > starts_at)
);
create table if not exists public.ps_speaker_assignments (
 event_id uuid not null, heat_id uuid not null, entry_id uuid not null, position integer not null check(position>0),
 primary key(event_id,heat_id,entry_id), unique(event_id,heat_id,position),
 foreign key(event_id,heat_id) references public.ps_heats(event_id,id) on delete cascade,
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id)
);
create table if not exists public.ps_judge_assignments (
 event_id uuid not null, heat_id uuid not null, entry_id uuid not null,
 role text not null default 'panel' check(role in ('chair','panel','trainee')), acknowledged_at timestamptz,
 primary key(event_id,heat_id,entry_id), foreign key(event_id,heat_id) references public.ps_heats(event_id,id) on delete cascade,
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id)
);
create table if not exists public.ps_ballot_records (
 event_id uuid not null, id uuid not null, heat_id uuid not null, round_id uuid not null, judge_id uuid not null,
 status text not null check(status in ('draft','submitted','approved','disputed','withdrawn')),
 version integer not null default 1, assignment_version integer not null default 1,
 origin text not null default 'electronic', source_id text, entered_by text, updated_at timestamptz not null default now(),
 primary key(event_id,id), unique(event_id,heat_id,judge_id),
 foreign key(event_id,heat_id,judge_id) references public.ps_judge_assignments(event_id,heat_id,entry_id),
 foreign key(event_id,round_id) references public.ps_round_records(event_id,id)
);
create table if not exists public.ps_performances (
 event_id uuid not null, ballot_id uuid not null, entry_id uuid not null, rank numeric,
 elapsed_seconds numeric, feedback text not null default '', worked text not null default '',
 improve text not null default '', next_step text not null default '',
 primary key(event_id,ballot_id,entry_id), foreign key(event_id,ballot_id) references public.ps_ballot_records(event_id,id) on delete cascade,
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id)
);
create table if not exists public.ps_criterion_scores (
 event_id uuid not null, ballot_id uuid not null, entry_id uuid not null, criterion_id text not null,
 criterion_order integer not null, mark numeric not null,
 primary key(event_id,ballot_id,entry_id,criterion_id),
 foreign key(event_id,ballot_id,entry_id) references public.ps_performances(event_id,ballot_id,entry_id) on delete cascade
);
create table if not exists public.ps_ballot_revisions (
 event_id uuid not null, ballot_id uuid not null, version integer not null, snapshot jsonb not null,
 actor text not null, reason text not null, created_at timestamptz not null default now(),
 primary key(event_id,ballot_id,version), foreign key(event_id,ballot_id) references public.ps_ballot_records(event_id,id) on delete cascade
);
create table if not exists public.ps_evaluations (
 event_id uuid not null, round_id uuid not null, heat_id uuid not null, source_id uuid not null, target_id uuid not null,
 source_role text not null, rating integer not null check(rating between 1 and 5), comment text not null default '',
 updated_at timestamptz not null default now(), primary key(event_id,round_id,source_id,target_id), check(source_id<>target_id),
 foreign key(event_id,heat_id,source_id) references public.ps_speaker_assignments(event_id,heat_id,entry_id) deferrable initially deferred
);
-- Source may be a judge or a speaker; eligibility is checked by the API against current assignments.
alter table public.ps_evaluations drop constraint if exists ps_evaluations_event_id_heat_id_source_id_fkey;
alter table public.ps_evaluations drop constraint if exists ps_evaluations_event_id_round_id_fkey;
alter table public.ps_evaluations add constraint ps_evaluations_event_id_round_id_fkey foreign key(event_id,round_id) references public.ps_round_records(event_id,id) on delete cascade;
create table if not exists public.ps_audit_events (
 id bigint generated always as identity primary key, event_id uuid not null references public.ps_competitions(id) on delete cascade,
 actor text not null, action text not null, reason text not null default '', version integer not null,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.ps_request_receipts (
 event_id uuid not null references public.ps_competitions(id) on delete cascade, request_key uuid not null,
 actor text not null, payload_hash text not null, version integer not null, created_at timestamptz not null default now(),
 primary key(event_id,request_key)
);
create table if not exists public.ps_access_tokens (
 token_hash text primary key, event_id uuid not null, entry_id uuid not null,
 purpose text not null check(purpose in ('portal','session','registration-edit')), expires_at timestamptz not null,
 revoked_at timestamptz, parent_hash text references public.ps_access_tokens(token_hash), created_at timestamptz not null default now(),
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id) on delete cascade
);
create index if not exists ps_access_entry on public.ps_access_tokens(event_id,entry_id);
create table if not exists public.ps_registration_forms (
 event_id uuid not null references public.ps_competitions(id) on delete cascade, role text not null check(role in ('speaker','judge')),
 version integer not null, schema jsonb not null, opens_at timestamptz, closes_at timestamptz,
 edit_deadline timestamptz, capacity integer not null check(capacity>0), approval text not null check(approval in ('manual','automatic')),
 enabled boolean not null default false, primary key(event_id,role,version)
);
create table if not exists public.ps_registration_submissions (
 id uuid primary key default gen_random_uuid(), event_id uuid not null, role text not null, form_version integer not null,
 entry_id uuid not null, answers jsonb not null, request_key uuid not null, status text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,request_key), foreign key(event_id,role,form_version) references public.ps_registration_forms(event_id,role,version),
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id)
);
create table if not exists public.ps_rate_buckets (key text not null, window_start timestamptz not null, attempts integer not null, primary key(key,window_start));
create table if not exists public.ps_conflicts (
 event_id uuid not null, judge_id uuid not null, entry_id uuid not null, prohibited boolean not null default true,
 reason text not null, primary key(event_id,judge_id,entry_id),
 foreign key(event_id,judge_id) references public.ps_entries(event_id,id) on delete cascade,
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id) on delete cascade
);
create table if not exists public.ps_help_requests (
 id uuid primary key default gen_random_uuid(), event_id uuid not null, heat_id uuid, entry_id uuid not null,
 kind text not null, message text not null, status text not null default 'open', created_at timestamptz not null default now(),
 foreign key(event_id,entry_id) references public.ps_entries(event_id,id) on delete cascade
);
create table if not exists public.ps_announcements (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.ps_competitions(id) on delete cascade,
 message text not null, published_at timestamptz not null default now(), author text not null
);
create table if not exists public.ps_notification_outbox (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.ps_competitions(id) on delete cascade,
 recipient text not null, subject text not null, body text not null, idempotency_key text not null unique,
 status text not null default 'pending', attempts integer not null default 0, last_error text, sent_at timestamptz
);
-- Private by default. No browser role has direct table access.
do $$ declare t text; begin
 foreach t in array array['ps_competitions','ps_rule_sets','ps_entries','ps_round_records','ps_round_entries','ps_room_resources','ps_availability','ps_heats','ps_speaker_assignments','ps_judge_assignments','ps_ballot_records','ps_performances','ps_criterion_scores','ps_ballot_revisions','ps_evaluations','ps_audit_events','ps_request_receipts','ps_access_tokens','ps_registration_forms','ps_registration_submissions','ps_rate_buckets','ps_conflicts','ps_help_requests','ps_announcements','ps_notification_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.ps_audit_events_id_seq to service_role;

create or replace function public.ps_v2_load(p_event_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare e ps_competitions; result jsonb; rounds jsonb; people jsonb;
begin
 select * into e from ps_competitions where id=p_event_id; if not found then return null; end if;
 select coalesce(jsonb_agg(metadata || jsonb_build_object('id',id,'name',name,'institution',institution,'category',category,'email',email,'active',active,'status',status,'checkedIn',checked_in,'role',role,'userId',user_id) order by sort_order,created_at,id),'[]') into people from ps_entries where event_id=e.id;
 select coalesce(jsonb_agg(r.metadata || jsonb_build_object('id',r.id,'name',r.name,'stage',r.stage,'status',r.status,'ruleVersion',r.rule_version,'assignmentVersion',r.assignment_version,'needsReview',r.needs_review,
 'drawPublished',r.draw_published,'resultsPublished',r.results_published,'feedbackPublished',r.feedback_published,
 'speakerIds',(select coalesce(jsonb_agg(entry_id),'[]') from ps_round_entries where event_id=e.id and round_id=r.id),
 'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'roomId',h.room_id,'wave',h.wave,'startsAt',h.starts_at,'endsAt',h.ends_at,'locked',h.locked,
 'speakers',(select coalesce(jsonb_agg(entry_id order by position),'[]') from ps_speaker_assignments where event_id=e.id and heat_id=h.id),
 'judges',(select coalesce(jsonb_agg(entry_id order by role,entry_id),'[]') from ps_judge_assignments where event_id=e.id and heat_id=h.id and role<>'trainee')) order by h.wave,h.name),'[]') from ps_heats h where h.event_id=e.id and h.round_id=r.id),
 'ballots',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'roomId',b.heat_id,'judgeId',b.judge_id,'status',b.status,'version',b.version,'assignmentVersion',b.assignment_version,'origin',b.origin,'sourceId',b.source_id,'enteredBy',b.entered_by,'updatedAt',b.updated_at,
 'rows',(select coalesce(jsonb_agg(jsonb_build_object('speakerId',p.entry_id,'rank',p.rank,'feedback',p.feedback,'worked',p.worked,'improve',p.improve,'nextStep',p.next_step,'elapsedSeconds',p.elapsed_seconds,
 'scores',(select coalesce(jsonb_agg(mark order by criterion_order),'[]') from ps_criterion_scores where event_id=e.id and ballot_id=b.id and entry_id=p.entry_id))),'[]') from ps_performances p where p.event_id=e.id and p.ballot_id=b.id))),'[]') from ps_ballot_records b where b.event_id=e.id and b.round_id=r.id),
 'judgeFeedback',(select coalesce(jsonb_agg(jsonb_build_object('fromRole',source_role,'fromId',source_id,'toId',target_id,'roomId',heat_id,'rating',rating,'comment',comment,'updatedAt',updated_at)),'[]') from ps_evaluations where event_id=e.id and round_id=r.id)) order by r.sequence),'[]') into rounds from ps_round_records r where r.event_id=e.id;
 result=e.settings || jsonb_build_object('name',e.name,'type',e.discipline,'ruleVersion',e.rule_version,'speakers',(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(people) p where p->>'role'='speaker'),'judges',(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(people) p where p->>'role'='judge'),'rounds',rounds);
 return jsonb_build_object('id',e.id,'tournament_id',e.tournament_id,'version',e.version,'state',result);
end $$;

create or replace function public.ps_v2_commit(p_event_id uuid,p_tournament_id text,p_version integer,p_state jsonb,p_actor text,p_action text,p_reason text default '',p_request_key uuid default null,p_payload_hash text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare e ps_competitions; item jsonb; r jsonb; h jsonb; b jsonb; p jsonb; c jsonb; f jsonb; old_ballot jsonb;
 seq integer:=0; pos integer; j integer; new_version integer; rule_version integer; receipt ps_request_receipts; bid uuid;
begin
 perform 1 from tournaments where id::text=p_tournament_id for key share; if not found then raise exception 'Tournament not found.'; end if;
 select * into e from ps_competitions where id=p_event_id for update;
 if found and e.tournament_id<>p_tournament_id then raise exception 'Event does not belong to tournament.'; end if;
 if p_request_key is not null then
 select * into receipt from ps_request_receipts where event_id=p_event_id and request_key=p_request_key;
 if found then
 if receipt.actor<>p_actor or receipt.payload_hash<>p_payload_hash then raise exception 'Request key already used for a different request.'; end if;
 return ps_v2_load(p_event_id); end if; end if;
 if e.id is not null and e.version<>p_version then raise exception using errcode='40001',message='This event changed. Refresh before resubmitting.'; end if;
 if e.id is null and p_version<>0 then raise exception 'Event not found.'; end if;
 new_version=coalesce(e.version,0)+1; rule_version=coalesce((p_state->>'ruleVersion')::integer,1);
 insert into ps_competitions(id,tournament_id,name,discipline,version,rule_version,settings)
 values(p_event_id,p_tournament_id,p_state->>'name',p_state->>'type',new_version,rule_version,p_state-'speakers'-'judges'-'rounds'-'name'-'type')
 on conflict(id) do update set name=excluded.name,discipline=excluded.discipline,version=excluded.version,rule_version=excluded.rule_version,settings=excluded.settings,updated_at=now();
 insert into ps_rule_sets(event_id,version,configuration) values(p_event_id,rule_version,p_state-'speakers'-'judges'-'rounds') on conflict do nothing;
 for item,pos in select value,ordinality from jsonb_array_elements((p_state->'speakers')||(p_state->'judges')) with ordinality loop
 insert into ps_entries(event_id,id,role,name,institution,category,email,status,active,checked_in,user_id,metadata,sort_order)
 values(p_event_id,(item->>'id')::uuid,case when p_state->'speakers' @> jsonb_build_array(jsonb_build_object('id',item->>'id')) then 'speaker' else 'judge' end,item->>'name',coalesce(item->>'institution',''),coalesce(item->>'category',''),coalesce(item->>'email',''),coalesce(item->>'status','accepted'),coalesce((item->>'active')::boolean,true),coalesce((item->>'checkedIn')::boolean,false),(item->>'userId')::uuid,
  item-'id'-'name'-'institution'-'category'-'email'-'status'-'active'-'checkedIn'-'role'-'userId'-'metadata',pos)
 on conflict(event_id,id) do update set name=excluded.name,institution=excluded.institution,category=excluded.category,email=excluded.email,status=excluded.status,active=excluded.active,checked_in=excluded.checked_in,user_id=excluded.user_id,metadata=excluded.metadata,sort_order=excluded.sort_order;
 end loop;
 for r in select value from jsonb_array_elements(p_state->'rounds') loop
 seq=seq+1;
 insert into ps_round_records(event_id,id,sequence,name,stage,status,rule_version,assignment_version,draw_published,results_published,feedback_published,needs_review,metadata)
 values(p_event_id,(r->>'id')::uuid,seq,r->>'name',r->>'stage',r->>'status',coalesce((r->>'ruleVersion')::integer,rule_version),coalesce((r->>'assignmentVersion')::integer,1),coalesce((r->>'drawPublished')::boolean,false),coalesce((r->>'resultsPublished')::boolean,false),coalesce((r->>'feedbackPublished')::boolean,false),coalesce((r->>'needsReview')::boolean,false),r-'id'-'name'-'stage'-'status'-'rooms'-'ballots'-'judgeFeedback'-'speakerIds')
 on conflict(event_id,id) do update set status=excluded.status,assignment_version=excluded.assignment_version,draw_published=excluded.draw_published,results_published=excluded.results_published,feedback_published=excluded.feedback_published,needs_review=excluded.needs_review,metadata=excluded.metadata;
 for item in select value from jsonb_array_elements(r->'speakerIds') loop
 insert into ps_round_entries values(p_event_id,(r->>'id')::uuid,(item#>>'{}')::uuid) on conflict do nothing; end loop;
 -- Only unscored draft assignments can be replaced. Published/balloted heats retain identity.
 if r->>'status'='draft' and not exists(select 1 from ps_ballot_records where event_id=p_event_id and round_id=(r->>'id')::uuid) then delete from ps_heats where event_id=p_event_id and round_id=(r->>'id')::uuid; end if;
 for h in select value from jsonb_array_elements(r->'rooms') loop
 insert into ps_heats(event_id,id,round_id,name,room_id,wave,starts_at,ends_at,locked) values(p_event_id,(h->>'id')::uuid,(r->>'id')::uuid,h->>'name',(h->>'roomId')::uuid,coalesce((h->>'wave')::integer,1),(h->>'startsAt')::timestamptz,(h->>'endsAt')::timestamptz,coalesce((h->>'locked')::boolean,false))
 on conflict(event_id,id) do update set name=excluded.name,room_id=excluded.room_id,wave=excluded.wave,starts_at=excluded.starts_at,ends_at=excluded.ends_at,locked=excluded.locked;
 pos=0;for item in select value from jsonb_array_elements(h->'speakers') loop
 pos=pos+1;insert into ps_speaker_assignments values(p_event_id,(h->>'id')::uuid,(item#>>'{}')::uuid,pos) on conflict(event_id,heat_id,entry_id) do update set position=excluded.position;end loop;
 for item in select value from jsonb_array_elements(h->'judges') loop
 insert into ps_judge_assignments(event_id,heat_id,entry_id) values(p_event_id,(h->>'id')::uuid,(item#>>'{}')::uuid) on conflict do nothing;end loop;
 end loop;
 for b in select value from jsonb_array_elements(r->'ballots') loop
 bid=(b->>'id')::uuid;
 select jsonb_build_object('status',x.status,'rows',(select coalesce(jsonb_agg(to_jsonb(pp)),'[]') from ps_performances pp where pp.event_id=p_event_id and pp.ballot_id=bid),'scores',(select coalesce(jsonb_agg(to_jsonb(cs)),'[]') from ps_criterion_scores cs where cs.event_id=p_event_id and cs.ballot_id=bid)) into old_ballot from ps_ballot_records x where x.event_id=p_event_id and x.id=bid;
 if old_ballot is not null and exists(select 1 from ps_ballot_records x where x.event_id=p_event_id and x.id=bid and x.version<coalesce((b->>'version')::integer,1)) then
 insert into ps_ballot_revisions(event_id,ballot_id,version,snapshot,actor,reason) select p_event_id,bid,x.version,old_ballot,p_actor,p_reason from ps_ballot_records x where x.event_id=p_event_id and x.id=bid on conflict do nothing;
 end if;
 insert into ps_ballot_records(event_id,id,heat_id,round_id,judge_id,status,version,assignment_version,origin,source_id,entered_by,updated_at)
 values(p_event_id,bid,(b->>'roomId')::uuid,(r->>'id')::uuid,(b->>'judgeId')::uuid,b->>'status',coalesce((b->>'version')::integer,1),coalesce((r->>'assignmentVersion')::integer,1),coalesce(b->>'origin','electronic'),b->>'sourceId',b->>'enteredBy',coalesce((b->>'updatedAt')::timestamptz,now()))
 on conflict(event_id,id) do update set status=excluded.status,version=excluded.version,entered_by=excluded.entered_by,updated_at=excluded.updated_at;
 for p in select value from jsonb_array_elements(b->'rows') loop
 insert into ps_performances(event_id,ballot_id,entry_id,rank,elapsed_seconds,feedback,worked,improve,next_step) values(p_event_id,bid,(p->>'speakerId')::uuid,(p->>'rank')::numeric,(p->>'elapsedSeconds')::numeric,coalesce(p->>'feedback',''),coalesce(p->>'worked',''),coalesce(p->>'improve',''),coalesce(p->>'nextStep',''))
 on conflict(event_id,ballot_id,entry_id) do update set rank=excluded.rank,elapsed_seconds=excluded.elapsed_seconds,feedback=excluded.feedback,worked=excluded.worked,improve=excluded.improve,next_step=excluded.next_step;
 j=0;for c in select value from jsonb_array_elements(p->'scores') loop
 insert into ps_criterion_scores values(p_event_id,bid,(p->>'speakerId')::uuid,coalesce(p_state->'rubric'->j->>'id','criterion_'||j),j,(c#>>'{}')::numeric)
 on conflict(event_id,ballot_id,entry_id,criterion_id) do update set mark=excluded.mark,criterion_order=excluded.criterion_order;j=j+1;end loop;
 end loop;
 end loop;
 for f in select value from jsonb_array_elements(r->'judgeFeedback') loop
 insert into ps_evaluations(event_id,round_id,heat_id,source_id,target_id,source_role,rating,comment,updated_at)
 values(p_event_id,(r->>'id')::uuid,(f->>'roomId')::uuid,(f->>'fromId')::uuid,(f->>'toId')::uuid,f->>'fromRole',(f->>'rating')::integer,f->>'comment',coalesce((f->>'updatedAt')::timestamptz,now()))
 on conflict(event_id,round_id,source_id,target_id) do update set rating=excluded.rating,comment=excluded.comment,updated_at=excluded.updated_at;
 end loop;
 end loop;
 insert into ps_audit_events(event_id,actor,action,reason,version,details) values(p_event_id,p_actor,p_action,left(p_reason,1000),new_version,jsonb_build_object('previousVersion',p_version,'roundCount',seq));
 if p_request_key is not null then insert into ps_request_receipts values(p_event_id,p_request_key,p_actor,p_payload_hash,new_version,now());end if;
 return ps_v2_load(p_event_id);
end $$;

-- Remove PS v2 data with its tournament (works for text or UUID tournament IDs).
create or replace function public.ps_v2_cleanup_tournament()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.ps_competitions where tournament_id = old.id::text;
  delete from public.ps_availability where tournament_id = old.id::text;
  delete from public.ps_room_resources where tournament_id = old.id::text;
  return old;
end;
$$;
revoke all on function public.ps_v2_cleanup_tournament() from public, anon, authenticated;
drop trigger if exists ps_v2_cleanup on public.tournaments;
create trigger ps_v2_cleanup before delete on public.tournaments
for each row execute function public.ps_v2_cleanup_tournament();

-- One-off, rerunnable copy of v1 aggregate events (public-speaking.sql) into v2.
-- Returns how many events were copied; events already in v2 are skipped.
create or replace function public.ps_migrate_v1_to_v2() returns integer
language plpgsql security definer set search_path = public as $$
declare old_event public.ps_events; copied integer := 0;
begin
  for old_event in select * from public.ps_events e
    where not exists (select 1 from public.ps_competitions c where c.id = e.id) order by created_at loop
    perform public.ps_v2_commit(old_event.id, old_event.tournament_id, 0, old_event.state, 'system:migration', 'migrate-v1', 'Copied from v1 aggregate storage');
    copied := copied + 1;
  end loop;
  return copied;
end;
$$;
revoke all on function public.ps_v2_load(uuid) from public, anon, authenticated;
grant execute on function public.ps_v2_load(uuid) to service_role;
revoke all on function public.ps_v2_commit(uuid,text,integer,jsonb,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.ps_v2_commit(uuid,text,integer,jsonb,text,text,text,uuid,text) to service_role;
revoke all on function public.ps_migrate_v1_to_v2() from public, anon, authenticated;
grant execute on function public.ps_migrate_v1_to_v2() to service_role;

create or replace function public.ps_v2_list(p_tournament_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'type', c.discipline, 'version', c.version,
    'speakers', (select count(*) from ps_entries x where x.event_id = c.id and x.role = 'speaker'),
    'rounds', (select count(*) from ps_round_records r where r.event_id = c.id)) order by c.created_at), '[]')
  from ps_competitions c where c.tournament_id = p_tournament_id;
$$;
create or replace function public.ps_v2_audit(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'actor', a.actor, 'action', a.action, 'reason', a.reason, 'version', a.version, 'created_at', a.created_at) order by a.id desc), '[]')
  from (select * from ps_audit_events where event_id = p_event_id order by id desc limit 100) a;
$$;
revoke all on function public.ps_v2_list(text) from public, anon, authenticated;
grant execute on function public.ps_v2_list(text) to service_role;
revoke all on function public.ps_v2_audit(uuid) from public, anon, authenticated;
grant execute on function public.ps_v2_audit(uuid) to service_role;
commit;
