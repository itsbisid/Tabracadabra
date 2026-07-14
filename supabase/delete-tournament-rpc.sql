create or replace function public.delete_tournament_data(target_tournament_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_tournaments integer := 0;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to delete a tournament.';
  end if;

  if nullif(trim(target_tournament_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'A tournament id is required.';
  end if;

  if not exists (
    select 1
    from public.tournaments tournament
    where tournament.id::text = target_tournament_id
      and tournament.owner_id = current_user_id
  ) and not exists (
    select 1
    from public.tournament_memberships membership
    where membership.tournament_id::text = target_tournament_id
      and membership.user_id = current_user_id
      and lower(coalesce(membership.role, '')) in (
        'director',
        'tab_director',
        'convenor',
        'deputy_convenor'
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have permission to delete this tournament.';
  end if;

  delete from public.adjudicator_allocations allocation
  using public.draw_pairings pairing
  where allocation.pairing_id = pairing.id
    and pairing.tournament_id::text = target_tournament_id;

  delete from public.judge_feedback feedback
  where feedback.tournament_id::text = target_tournament_id
    or exists (
      select 1
      from public.draw_pairings pairing
      where pairing.id = feedback.pairing_id
        and pairing.tournament_id::text = target_tournament_id
    );

  delete from public.portal_check_ins where tournament_id::text = target_tournament_id;
  delete from public.push_subscriptions where tournament_id::text = target_tournament_id;
  delete from public.ballots where tournament_id::text = target_tournament_id;
  delete from public.registration_submissions where tournament_id::text = target_tournament_id;
  delete from public.registration_links where tournament_id::text = target_tournament_id;
  delete from public.announcements where tournament_id::text = target_tournament_id;
  delete from public.venues where tournament_id::text = target_tournament_id;
  delete from public.draw_pairings where tournament_id::text = target_tournament_id;
  delete from public.rounds where tournament_id::text = target_tournament_id;
  delete from public.teams where tournament_id::text = target_tournament_id;
  delete from public.adjudicators where tournament_id::text = target_tournament_id;
  delete from public.tournament_memberships where tournament_id::text = target_tournament_id;
  delete from public.tournaments where id::text = target_tournament_id;

  get diagnostics deleted_tournaments = row_count;
  if deleted_tournaments = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'Tournament not found.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'tournamentId', target_tournament_id,
    'deletedTournaments', deleted_tournaments
  );
end;
$$;

revoke all on function public.delete_tournament_data(text) from public;
revoke all on function public.delete_tournament_data(text) from anon;
grant execute on function public.delete_tournament_data(text) to authenticated;

notify pgrst, 'reload schema';
