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


-- ═══════════════════════════════════════════════════════════════════════════
-- Glicko-2 model (rating + rating deviation + volatility)
-- Adds per-player uncertainty (RD), which composes with graph connectivity to
-- yield a real confidence score. Processes matches in rating periods (= match
-- date); multiplayer matches decompose into pairwise games, like Elo.
-- ═══════════════════════════════════════════════════════════════════════════

-- f(x) for the volatility solver (Illinois root-finding). delta2/phi2 are squared.
create or replace function _glicko_f(
  x double precision, a double precision, delta2 double precision,
  phi2 double precision, v double precision, tau double precision
) returns double precision language sql immutable as $$
  select (exp(x) * (delta2 - phi2 - v - exp(x))) / (2.0 * power(phi2 + v + exp(x), 2))
       - (x - a) / (tau * tau);
$$;

create or replace function glicko2_ratings(p_game uuid, p_tau numeric default 0.5)
returns table(player_id uuid, display_name text, rating numeric, rd numeric, volatility numeric, periods int)
language plpgsql as $$
#variable_conflict use_column
declare
  q constant double precision := 173.7178;
  eps constant double precision := 1e-6;
  tau double precision := p_tau;
  most_points boolean;
  prec record; grec record; orec record;
  mu double precision; phi double precision; sigma double precision;
  oppmu double precision; oppphi double precision;
  gphi double precision; ev double precision; sj double precision;
  sumg2 double precision; sumgs double precision;
  v double precision; delta double precision; delta2 double precision; phi2 double precision;
  a double precision; av double precision; bv double precision; cv double precision;
  fa double precision; fb double precision; fc double precision; k int;
  phistar double precision; phiprime double precision; muprime double precision;
begin
  select g.most_points_wins into most_points from games g where g.id = p_game;

  drop table if exists _g;
  create temp table _g(player_id uuid primary key, mu double precision, phi double precision,
                       sigma double precision, periods int);
  insert into _g
  select distinct pm.player_id, 0.0, 350.0/q, 0.06, 0
  from player_matches pm join matches m on m.id = pm.match_id
  where m.game_id = p_game and m.status = 'completed';

  -- one rating period per distinct match date, oldest first
  for prec in
    select coalesce(m.date_played::date, date '1970-01-01') as period
    from matches m where m.game_id = p_game and m.status = 'completed'
    group by 1 order by 1
  loop
    drop table if exists _snap;  create temp table _snap as select * from _g;
    drop table if exists _next;  create temp table _next(player_id uuid primary key,
      mu double precision, phi double precision, sigma double precision, played boolean);

    for grec in
      select distinct a.player_id as pid
      from player_matches a join matches m on m.id = a.match_id
      where m.game_id = p_game and m.status = 'completed'
        and coalesce(m.date_played::date, date '1970-01-01') = prec.period
    loop
      select s.mu, s.phi, s.sigma into mu, phi, sigma from _snap s where s.player_id = grec.pid;
      sumg2 := 0; sumgs := 0;
      for orec in
        select b.player_id as opp, a.score as s_a, b.score as s_b
        from player_matches a
        join player_matches b on a.match_id = b.match_id and a.player_id <> b.player_id
        join matches m on m.id = a.match_id
        where a.player_id = grec.pid and m.game_id = p_game and m.status = 'completed'
          and coalesce(m.date_played::date, date '1970-01-01') = prec.period
      loop
        if orec.s_a = orec.s_b then sj := 0.5;
        elsif most_points then sj := case when orec.s_a > orec.s_b then 1 else 0 end;
        else sj := case when orec.s_a < orec.s_b then 1 else 0 end;
        end if;
        select s.mu, s.phi into oppmu, oppphi from _snap s where s.player_id = orec.opp;
        gphi := 1.0 / sqrt(1.0 + 3.0 * oppphi * oppphi / (pi() * pi()));
        ev := 1.0 / (1.0 + exp(-gphi * (mu - oppmu)));
        sumg2 := sumg2 + gphi * gphi * ev * (1.0 - ev);
        sumgs := sumgs + gphi * (sj - ev);
      end loop;

      v := 1.0 / sumg2;
      delta := v * sumgs;
      delta2 := delta * delta; phi2 := phi * phi;

      a := ln(sigma * sigma);
      av := a;
      if delta2 > phi2 + v then
        bv := ln(delta2 - phi2 - v);
      else
        k := 1;
        while _glicko_f(a - k * tau, a, delta2, phi2, v, tau) < 0 loop k := k + 1; end loop;
        bv := a - k * tau;
      end if;
      fa := _glicko_f(av, a, delta2, phi2, v, tau);
      fb := _glicko_f(bv, a, delta2, phi2, v, tau);
      while abs(bv - av) > eps loop
        cv := av + (av - bv) * fa / (fb - fa);
        fc := _glicko_f(cv, a, delta2, phi2, v, tau);
        if fc * fb <= 0 then av := bv; fa := fb; else fa := fa / 2.0; end if;
        bv := cv; fb := fc;
      end loop;
      sigma := exp(av / 2.0);

      phistar := sqrt(phi2 + sigma * sigma);
      phiprime := 1.0 / sqrt(1.0 / (phistar * phistar) + 1.0 / v);
      muprime := mu + phiprime * phiprime * sumgs;
      insert into _next values (grec.pid, muprime, phiprime, sigma, true);
    end loop;

    -- players idle this period: rating unchanged, RD grows by volatility
    insert into _next
    select s.player_id, s.mu, sqrt(s.phi * s.phi + s.sigma * s.sigma), s.sigma, false
    from _snap s where s.player_id not in (select player_id from _next);

    update _g g set mu = n.mu, phi = n.phi, sigma = n.sigma,
      periods = g.periods + (case when n.played then 1 else 0 end)
    from _next n where n.player_id = g.player_id;
  end loop;

  return query
    select e.player_id, p.display_name,
      round((q * e.mu + 1500.0)::numeric, 1),
      round((q * e.phi)::numeric, 1),
      round(e.sigma::numeric, 4),
      e.periods
    from _g e join players p on p.id = e.player_id
    order by (q * e.mu + 1500.0) desc;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Pluggable ranking models: a registry + a dispatcher with a common contract.
-- Adding a model later = new *_ratings() function + one branch + one registry
-- row. Callers (app / "compare models" UI) stay uniform.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function ranking_models()
returns table(model text, label text, has_uncertainty boolean)
language sql immutable as $$
  select * from (values
    ('elo',     'Elo',      false),
    ('glicko2', 'Glicko-2', true)
  ) as t(model, label, has_uncertainty);
$$;

-- Normalized ranking for any model: (rank, player, rating, uncertainty, details).
-- `uncertainty` is RD for models that have it, NULL otherwise; `details` carries
-- model-specific extras as jsonb so the shape never has to change.
create or replace function rankings(p_game uuid, p_model text default 'glicko2')
returns table(rank int, player_id uuid, display_name text, rating numeric,
              uncertainty numeric, details jsonb)
language plpgsql stable as $$
begin
  if p_model = 'elo' then
    return query
      select (rank() over (order by e.rating desc))::int, e.player_id, e.display_name,
             e.rating, null::numeric, jsonb_build_object('comparisons', e.comparisons)
      from elo_ratings(p_game) e;
  elsif p_model = 'glicko2' then
    return query
      select (rank() over (order by g.rating desc))::int, g.player_id, g.display_name,
             g.rating, g.rd, jsonb_build_object('rd', g.rd, 'volatility', g.volatility, 'periods', g.periods)
      from glicko2_ratings(p_game) g;
  else
    raise exception 'unknown ranking model: %', p_model;
  end if;
end $$;
