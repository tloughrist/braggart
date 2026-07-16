-- 0005: handicaps + team matches.
--
-- create_match now honors a per-player handicap: is_winner and finishing_place
-- are computed on the effective score (raw score + handicap), while the raw
-- score and handicap are stored separately.
--
-- create_team_match records a team-based game: ad-hoc teams, a team score each,
-- and player_matches rows that inherit their team's score/win so the existing
-- game_player_stats view works unchanged.

-- ---------------------------------------------------------------------------
-- create_match — add handicap (same signature; the jsonb just gains a field)
-- ---------------------------------------------------------------------------
create or replace function public.create_match(
  p_game_id  uuid,
  p_group_id uuid,
  p_date     timestamptz,
  p_players  jsonb  -- [{ player_id, score, handicap? }]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_match_id    uuid;
  v_most_points boolean;
  v_best        int;
begin
  if jsonb_array_length(coalesce(p_players, '[]'::jsonb)) < 2 then
    raise exception 'a match needs at least two players';
  end if;
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'not a member of that group';
  end if;

  select most_points_wins into v_most_points from games where id = p_game_id;
  if not found then raise exception 'game % not found', p_game_id; end if;

  insert into matches (game_id, group_id, owner_id, status, date_played)
  values (p_game_id, p_group_id, auth.uid(), 'completed', coalesce(p_date, now()))
  returning id into v_match_id;

  -- winner is decided on the handicap-adjusted (effective) score
  select case when v_most_points
              then max((e->>'score')::int + coalesce((e->>'handicap')::int, 0))
              else min((e->>'score')::int + coalesce((e->>'handicap')::int, 0)) end
  into v_best from jsonb_array_elements(p_players) e;

  insert into player_matches (match_id, player_id, score, handicap, is_winner, finishing_place)
  select
    v_match_id,
    (e->>'player_id')::uuid,
    (e->>'score')::int,
    coalesce((e->>'handicap')::int, 0),
    (e->>'score')::int + coalesce((e->>'handicap')::int, 0) = v_best,
    rank() over (
      order by ((e->>'score')::int + coalesce((e->>'handicap')::int, 0))
               * (case when v_most_points then -1 else 1 end)
    )
  from jsonb_array_elements(p_players) e;

  return v_match_id;
end; $$;

-- ---------------------------------------------------------------------------
-- create_team_match — team-based games
-- SECURITY DEFINER because it inserts into `teams` (which has RLS on with no
-- insert policy); it validates membership and sets owner = auth.uid() itself.
-- ---------------------------------------------------------------------------
create function public.create_team_match(
  p_game_id  uuid,
  p_group_id uuid,
  p_date     timestamptz,
  p_teams    jsonb  -- [{ name, score, player_ids: [uuid, ...] }]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_match_id    uuid;
  v_most_points boolean;
  v_best        int;
  t             jsonb;
  v_team_id     uuid;
  v_rank        int;
begin
  if jsonb_array_length(coalesce(p_teams, '[]'::jsonb)) < 2 then
    raise exception 'a team match needs at least two teams';
  end if;
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'not a member of that group';
  end if;

  select most_points_wins into v_most_points from games where id = p_game_id;
  if not found then raise exception 'game % not found', p_game_id; end if;

  insert into matches (game_id, group_id, owner_id, status, date_played)
  values (p_game_id, p_group_id, auth.uid(), 'completed', coalesce(p_date, now()))
  returning id into v_match_id;

  select case when v_most_points then max((e->>'score')::int) else min((e->>'score')::int) end
  into v_best from jsonb_array_elements(p_teams) e;

  for t in select * from jsonb_array_elements(p_teams) loop
    -- rank = 1 + number of teams strictly better than this one
    select 1 + count(*) into v_rank
    from jsonb_array_elements(p_teams) e
    where case when v_most_points then (e->>'score')::int > (t->>'score')::int
               else (e->>'score')::int < (t->>'score')::int end;

    insert into teams (name) values (t->>'name') returning id into v_team_id;

    insert into team_matches (match_id, team_id, score, is_winner)
    values (v_match_id, v_team_id, (t->>'score')::int, (t->>'score')::int = v_best);

    insert into player_matches (match_id, player_id, team_id, score, is_winner, finishing_place)
    select v_match_id, pid::uuid, v_team_id, (t->>'score')::int,
           (t->>'score')::int = v_best, v_rank
    from jsonb_array_elements_text(t->'player_ids') pid;
  end loop;

  return v_match_id;
end; $$;
grant execute on function public.create_team_match(uuid, uuid, timestamptz, jsonb) to authenticated;
