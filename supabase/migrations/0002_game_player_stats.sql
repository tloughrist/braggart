-- Per-game, per-player leaderboard stats (the Stats screen's data source).
--
-- Columns: matches played, wins, win rate, and average point deviation from the
-- match winner. `security_invoker = true` makes the view honor the querying
-- user's RLS on the underlying tables (players/matches/player_matches all allow
-- authenticated reads), rather than the view owner's rights.

create view public.game_player_stats
with (security_invoker = true) as
with results as (
  select
    m.game_id,
    g.name           as game_name,
    pm.match_id,
    pm.player_id,
    pm.score,
    pm.is_winner,
    -- the winner's score in this match, broadcast to every row of the match
    max(pm.score) filter (where pm.is_winner)
      over (partition by pm.match_id) as winner_score
  from player_matches pm
  join matches m on m.id = pm.match_id
  join games   g on g.id = m.game_id
  where m.status = 'completed'
)
select
  r.game_id,
  r.game_name,
  r.player_id,
  p.display_name,
  p.username,
  count(*)::int                                   as matches,
  count(*) filter (where r.is_winner)::int        as wins,
  round(count(*) filter (where r.is_winner)::numeric
        / nullif(count(*), 0), 2)                 as win_rate,
  -- distance from the winner's score, averaged; the winner scores 0 here
  round(avg(abs(coalesce(r.winner_score, r.score) - r.score)), 2)
                                                  as avg_point_deviation
from results r
join players p on p.id = r.player_id
group by r.game_id, r.game_name, r.player_id, p.display_name, p.username;

grant select on public.game_player_stats to authenticated;
