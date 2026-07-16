-- create_match: record a completed match + its player results atomically.
--
-- Takes the game, a date, and a JSON array of {player_id, score}. Inserts the
-- match and one player_matches row per player, computing is_winner and
-- finishing_place from the scores (respecting the game's most_points_wins), so
-- winner logic stays consistent with the game_player_stats view.
--
-- security invoker: runs as the caller, so RLS applies — the match's owner is
-- auth.uid(), and the player_matches insert passes the owner check.

create function public.create_match(
  p_game_id uuid,
  p_date    timestamptz,
  p_players jsonb  -- [{ "player_id": uuid, "score": int }, ...]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_match_id     uuid;
  v_most_points  boolean;
  v_best         int;
begin
  if jsonb_array_length(coalesce(p_players, '[]'::jsonb)) < 2 then
    raise exception 'a match needs at least two players';
  end if;

  select most_points_wins into v_most_points from games where id = p_game_id;
  if not found then
    raise exception 'game % not found', p_game_id;
  end if;

  insert into matches (game_id, owner_id, status, date_played)
  values (p_game_id, auth.uid(), 'completed', coalesce(p_date, now()))
  returning id into v_match_id;

  -- winning score: highest, or lowest for lowest-score-wins games
  select case when v_most_points then max((e->>'score')::int)
              else min((e->>'score')::int) end
  into v_best
  from jsonb_array_elements(p_players) e;

  insert into player_matches (match_id, player_id, score, is_winner, finishing_place)
  select
    v_match_id,
    (e->>'player_id')::uuid,
    (e->>'score')::int,
    (e->>'score')::int = v_best,
    rank() over (
      order by (e->>'score')::int * (case when v_most_points then -1 else 1 end)
    )
  from jsonb_array_elements(p_players) e;

  return v_match_id;
end;
$$;

grant execute on function public.create_match(uuid, timestamptz, jsonb) to authenticated;
