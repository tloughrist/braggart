-- 0009: tournaments.
-- A tournament groups matches. It has its own active/completed lifecycle, RLS
-- so group members can read and the owner can manage, and match creation can
-- optionally attach a match to an active tournament in the same group.

-- ── Status: active | completed (was the generic entity_status) ──────────────
create type tournament_status as enum ('active', 'completed');
alter table tournaments alter column status drop default;
alter table tournaments alter column status type tournament_status
  using (case status::text when 'active' then 'active' else 'completed' end::tournament_status);
alter table tournaments alter column status set default 'active';

-- ── RLS: members read; owner creates/manages ────────────────────────────────
create policy tournaments_select on tournaments for select to authenticated
  using (owner_id = auth.uid() or is_group_member(group_id));
create policy tournaments_insert on tournaments for insert to authenticated
  with check (owner_id = auth.uid() and is_group_member(group_id));
create policy tournaments_update on tournaments for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── create_match: add an optional tournament ────────────────────────────────
drop function create_match(uuid, uuid, timestamptz, jsonb);
create function create_match(
  p_game_id  uuid,
  p_group_id uuid,
  p_date     timestamptz,
  p_players  jsonb,
  p_tournament_id uuid default null
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
  if p_tournament_id is not null and not exists (
    select 1 from tournaments
    where id = p_tournament_id and group_id = p_group_id and status = 'active'
  ) then
    raise exception 'tournament is not an active tournament in this group';
  end if;

  select most_points_wins into v_most_points from games where id = p_game_id;
  if not found then raise exception 'game % not found', p_game_id; end if;

  insert into matches (game_id, group_id, owner_id, status, date_played, tournament_id)
  values (p_game_id, p_group_id, auth.uid(), 'completed', coalesce(p_date, now()), p_tournament_id)
  returning id into v_match_id;

  select case when v_most_points
              then max((e->>'score')::int + coalesce((e->>'handicap')::int, 0))
              else min((e->>'score')::int + coalesce((e->>'handicap')::int, 0)) end
  into v_best from jsonb_array_elements(p_players) e;

  insert into player_matches (match_id, player_id, score, handicap, is_winner, finishing_place)
  select
    v_match_id, (e->>'player_id')::uuid, (e->>'score')::int, coalesce((e->>'handicap')::int, 0),
    (e->>'score')::int + coalesce((e->>'handicap')::int, 0) = v_best,
    rank() over (order by ((e->>'score')::int + coalesce((e->>'handicap')::int, 0))
                          * (case when v_most_points then -1 else 1 end))
  from jsonb_array_elements(p_players) e;

  return v_match_id;
end $$;
grant execute on function create_match(uuid, uuid, timestamptz, jsonb, uuid) to authenticated;

-- ── create_team_match: add an optional tournament ───────────────────────────
drop function create_team_match(uuid, uuid, timestamptz, jsonb);
create function create_team_match(
  p_game_id  uuid,
  p_group_id uuid,
  p_date     timestamptz,
  p_teams    jsonb,
  p_tournament_id uuid default null
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
  if p_tournament_id is not null and not exists (
    select 1 from tournaments
    where id = p_tournament_id and group_id = p_group_id and status = 'active'
  ) then
    raise exception 'tournament is not an active tournament in this group';
  end if;

  select most_points_wins into v_most_points from games where id = p_game_id;
  if not found then raise exception 'game % not found', p_game_id; end if;

  insert into matches (game_id, group_id, owner_id, status, date_played, tournament_id)
  values (p_game_id, p_group_id, auth.uid(), 'completed', coalesce(p_date, now()), p_tournament_id)
  returning id into v_match_id;

  select case when v_most_points then max((e->>'score')::int) else min((e->>'score')::int) end
  into v_best from jsonb_array_elements(p_teams) e;

  for t in select * from jsonb_array_elements(p_teams) loop
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
end $$;
grant execute on function create_team_match(uuid, uuid, timestamptz, jsonb, uuid) to authenticated;
