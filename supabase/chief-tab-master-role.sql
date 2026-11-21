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
      and lower(replace(coalesce(m.role, ''), ' ', '_')) in (
        'chief_tab_master',
        'director',
        'tab_director',
        'convenor',
        'deputy_convenor'
      )
  );
$$;
