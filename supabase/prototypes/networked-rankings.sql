-- PROTOTYPE (exploratory — not a migration).
-- Demonstrates "networked rankings" entirely in Postgres:
--   1) plays_against  — the derived opponent graph (edges from co-participation)
--   2) fof()          — friends-of-friends traversal (recursive CTE) → connection depth
--   3) elo_ratings()  — a transitive skill rating per game (storage-agnostic math)
--
-- Idea: the rating answers "who is better?"; the graph answers "how connected /
-- comparable are they?" (confidence). Together = a networked ranking.

-- ── 1) Opponent graph: two players who shared a completed match of a game ────
create or replace view plays_against as
select distinct
  m.game_id,
  least(a.player_id, b.player_id)    as player_a,
  greatest(a.player_id, b.player_id) as player_b
from player_matches a
join player_matches b on a.match_id = b.match_id and a.player_id <> b.player_id
join matches m on m.id = a.match_id
where m.status = 'completed';

-- ── 2) Friends-of-friends: BFS out from a player, capped by depth ────────────
-- Returns everyone reachable in the opponent graph for a game, with the fewest
-- degrees of separation. `union` (not `union all`) dedups to terminate cycles.
create or replace function fof(p_start uuid, p_game uuid, p_max_depth int default 4)
returns table(player_id uuid, degrees int)
language sql stable as $$
  with recursive walk as (
    select p_start as player_id, 0 as depth
    union
    select case when e.player_a = w.player_id then e.player_b else e.player_a end,
           w.depth + 1
    from walk w
    join plays_against e
      on (e.player_a = w.player_id or e.player_b = w.player_id)
     and e.game_id = p_game
    where w.depth < p_max_depth
  )
  select player_id, min(depth) as degrees
  from walk
  where player_id <> p_start
  group by player_id;
$$;

-- ── 3) Elo ratings per game (transitive comparison from match outcomes) ──────
-- Processes matches oldest-first; every unordered pair in a match is a pairwise
-- Elo update, with the winner decided by score direction (most_points_wins).
-- Multiplayer matches thus contribute C(n,2) pairwise comparisons.
create or replace function elo_ratings(p_game uuid, p_k numeric default 24, p_base numeric default 1500)
returns table(player_id uuid, display_name text, rating numeric, comparisons int)
language plpgsql as $$
-- prefer table columns over the (identically named) RETURNS TABLE out-params
#variable_conflict use_column
declare
  most_points boolean;
  mrec record;
  prec record;
  ra numeric; rb numeric; ea numeric; sa numeric;
begin
  select g.most_points_wins into most_points from games g where g.id = p_game;

  drop table if exists _elo;
  create temp table _elo (player_id uuid primary key, rating numeric, comparisons int);

  insert into _elo (player_id, rating, comparisons)
  select distinct pm.player_id, p_base, 0
  from player_matches pm join matches m on m.id = pm.match_id
  where m.game_id = p_game and m.status = 'completed';

  for mrec in
    select m.id from matches m
    where m.game_id = p_game and m.status = 'completed'
    order by m.date_played nulls last, m.id
  loop
    for prec in
      select a.player_id as pa, a.score as sa_score, b.player_id as pb, b.score as sb_score
      from player_matches a
      join player_matches b on a.match_id = b.match_id and a.player_id < b.player_id
      where a.match_id = mrec.id
    loop
      select rating into ra from _elo where player_id = prec.pa;
      select rating into rb from _elo where player_id = prec.pb;
      ea := 1.0 / (1.0 + power(10, (rb - ra) / 400.0));
      if prec.sa_score = prec.sb_score then
        sa := 0.5;
      elsif most_points then
        sa := case when prec.sa_score > prec.sb_score then 1 else 0 end;
      else
        sa := case when prec.sa_score < prec.sb_score then 1 else 0 end;
      end if;
      update _elo set rating = ra + p_k * (sa - ea),           comparisons = comparisons + 1 where player_id = prec.pa;
      update _elo set rating = rb + p_k * ((1 - sa) - (1 - ea)), comparisons = comparisons + 1 where player_id = prec.pb;
    end loop;
  end loop;

  return query
    select e.player_id, p.display_name, round(e.rating, 1), e.comparisons
    from _elo e join players p on p.id = e.player_id
    order by e.rating desc;
end $$;
