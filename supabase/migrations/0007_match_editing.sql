-- 0007: match history editing.
-- Adds owner-only delete (via RLS) and an update_match RPC that revises an
-- individual match's date and per-player scores/handicaps, then recomputes
-- is_winner and finishing_place with the same logic create_match uses.

-- Owner can delete their match; player_matches/team_matches cascade via FKs.
create policy matches_delete on matches for delete to authenticated
  using (owner_id = auth.uid());

-- Edit an individual match. Assumes the same participants (add/remove a player
-- by deleting and re-recording). Team-match editing is not supported yet.
create or replace function update_match(p_match_id uuid, p_date timestamptz, p_players jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  most_points boolean;
  v_best int;
begin
  if not exists (select 1 from matches where id = p_match_id and owner_id = auth.uid()) then
    raise exception 'only the match owner can edit it';
  end if;
  if exists (select 1 from team_matches where match_id = p_match_id) then
    raise exception 'team match editing is not supported yet';
  end if;

  select g.most_points_wins into most_points
  from matches m join games g on g.id = m.game_id where m.id = p_match_id;

  update matches set date_played = coalesce(p_date, date_played) where id = p_match_id;

  update player_matches pm set
    score = (e->>'score')::int,
    handicap = coalesce((e->>'handicap')::int, 0)
  from jsonb_array_elements(p_players) e
  where pm.match_id = p_match_id and pm.player_id = (e->>'player_id')::uuid;

  select case when most_points then max(score + handicap) else min(score + handicap) end
  into v_best
  from player_matches where match_id = p_match_id;

  with ranked as (
    select id,
      (score + handicap = v_best) as win,
      rank() over (order by (score + handicap) * (case when most_points then -1 else 1 end)) as place
    from player_matches where match_id = p_match_id
  )
  update player_matches pm set is_winner = r.win, finishing_place = r.place
  from ranked r where r.id = pm.id;
end $$;

grant execute on function update_match(uuid, timestamptz, jsonb) to authenticated;
