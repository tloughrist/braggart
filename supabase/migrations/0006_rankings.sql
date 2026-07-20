-- 0006: in-app ranking engine (group-scoped).
-- Graduates the networked-rankings prototype into real, group-scoped functions:
--   * opponent graph + friends-of-friends traversal (recursive CTE)
--   * Elo and Glicko-2 rating models
--   * a pluggable dispatcher (rankings) + a networked comparison (compare_players)
--
-- Security model: the rating/traversal helpers are SECURITY INVOKER and are NOT
-- granted to clients (internal). The public entry points (rankings,
-- compare_players) are SECURITY DEFINER and guarded by is_group_member(), so
-- only a group's members can read its rankings.

-- ── Opponent graph: players who shared a completed match of a game in a group ─
create or replace view ranking_edges as
select distinct
  m.group_id,
  m.game_id,
  least(a.player_id, b.player_id)    as player_a,
  greatest(a.player_id, b.player_id) as player_b
from player_matches a
join player_matches b on a.match_id = b.match_id and a.player_id <> b.player_id
join matches m on m.id = a.match_id
where m.status = 'completed';

-- ── Friends-of-friends: BFS out from a player within one group+game ──────────
create or replace function ranking_fof(p_group uuid, p_game uuid, p_start uuid, p_max_depth int default 4)
returns table(player_id uuid, degrees int)
language sql stable as $$
  with recursive walk as (
    select p_start as player_id, 0 as depth
    union
    select case when e.player_a = w.player_id then e.player_b else e.player_a end,
           w.depth + 1
    from walk w
    join ranking_edges e
      on (e.player_a = w.player_id or e.player_b = w.player_id)
     and e.group_id = p_group and e.game_id = p_game
    where w.depth < p_max_depth
  )
  select player_id, min(depth) from walk where player_id <> p_start group by player_id;
$$;

-- ── Elo ratings (group + game) ───────────────────────────────────────────────
create or replace function elo_ratings(p_group uuid, p_game uuid, p_k numeric default 24, p_base numeric default 1500)
returns table(player_id uuid, display_name text, rating numeric, comparisons int)
language plpgsql as $$
#variable_conflict use_column
declare
  most_points boolean;
  mrec record; prec record;
  ra numeric; rb numeric; ea numeric; sa numeric;
begin
  select g.most_points_wins into most_points from games g where g.id = p_game;

  drop table if exists _elo;
  create temp table _elo (player_id uuid primary key, rating numeric, comparisons int);
  insert into _elo
  select distinct pm.player_id, p_base, 0
  from player_matches pm join matches m on m.id = pm.match_id
  where m.group_id = p_group and m.game_id = p_game and m.status = 'completed';

  for mrec in
    select m.id from matches m
    where m.group_id = p_group and m.game_id = p_game and m.status = 'completed'
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
      if prec.sa_score = prec.sb_score then sa := 0.5;
      elsif most_points then sa := case when prec.sa_score > prec.sb_score then 1 else 0 end;
      else sa := case when prec.sa_score < prec.sb_score then 1 else 0 end;
      end if;
      update _elo set rating = ra + p_k * (sa - ea),           comparisons = comparisons + 1 where player_id = prec.pa;
      update _elo set rating = rb + p_k * ((1 - sa) - (1 - ea)), comparisons = comparisons + 1 where player_id = prec.pb;
    end loop;
  end loop;

  return query
    select e.player_id, p.display_name, round(e.rating, 1), e.comparisons
    from _elo e join players p on p.id = e.player_id order by e.rating desc;
end $$;

-- ── Glicko-2 volatility solver f(x) ──────────────────────────────────────────
create or replace function _glicko_f(x double precision, a double precision, delta2 double precision,
  phi2 double precision, v double precision, tau double precision)
returns double precision language sql immutable as $$
  select (exp(x) * (delta2 - phi2 - v - exp(x))) / (2.0 * power(phi2 + v + exp(x), 2)) - (x - a) / (tau * tau);
$$;

-- ── Glicko-2 ratings (group + game) ──────────────────────────────────────────
create or replace function glicko2_ratings(p_group uuid, p_game uuid, p_tau numeric default 0.5)
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
  create temp table _g(player_id uuid primary key, mu double precision, phi double precision, sigma double precision, periods int);
  insert into _g
  select distinct pm.player_id, 0.0, 350.0/q, 0.06, 0
  from player_matches pm join matches m on m.id = pm.match_id
  where m.group_id = p_group and m.game_id = p_game and m.status = 'completed';

  for prec in
    select coalesce(m.date_played::date, date '1970-01-01') as period
    from matches m where m.group_id = p_group and m.game_id = p_game and m.status = 'completed'
    group by 1 order by 1
  loop
    drop table if exists _snap;  create temp table _snap as select * from _g;
    drop table if exists _next;  create temp table _next(player_id uuid primary key,
      mu double precision, phi double precision, sigma double precision, played boolean);

    for grec in
      select distinct a.player_id as pid
      from player_matches a join matches m on m.id = a.match_id
      where m.group_id = p_group and m.game_id = p_game and m.status = 'completed'
        and coalesce(m.date_played::date, date '1970-01-01') = prec.period
    loop
      select s.mu, s.phi, s.sigma into mu, phi, sigma from _snap s where s.player_id = grec.pid;
      sumg2 := 0; sumgs := 0;
      for orec in
        select b.player_id as opp, a.score as s_a, b.score as s_b
        from player_matches a
        join player_matches b on a.match_id = b.match_id and a.player_id <> b.player_id
        join matches m on m.id = a.match_id
        where a.player_id = grec.pid and m.group_id = p_group and m.game_id = p_game and m.status = 'completed'
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
      delta := v * sumgs; delta2 := delta * delta; phi2 := phi * phi;
      a := ln(sigma * sigma); av := a;
      if delta2 > phi2 + v then bv := ln(delta2 - phi2 - v);
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

    insert into _next
    select s.player_id, s.mu, sqrt(s.phi * s.phi + s.sigma * s.sigma), s.sigma, false
    from _snap s where s.player_id not in (select player_id from _next);

    update _g g set mu = n.mu, phi = n.phi, sigma = n.sigma,
      periods = g.periods + (case when n.played then 1 else 0 end)
    from _next n where n.player_id = g.player_id;
  end loop;

  return query
    select e.player_id, p.display_name, round((q * e.mu + 1500.0)::numeric, 1),
           round((q * e.phi)::numeric, 1), round(e.sigma::numeric, 4), e.periods
    from _g e join players p on p.id = e.player_id order by (q * e.mu + 1500.0) desc;
end $$;

-- ── Model registry ───────────────────────────────────────────────────────────
create or replace function ranking_models()
returns table(model text, label text, has_uncertainty boolean)
language sql immutable as $$
  select * from (values ('elo','Elo',false), ('glicko2','Glicko-2',true)) as t(model,label,has_uncertainty);
$$;

-- ── Public: leaderboard for a group+game by model (guarded) ──────────────────
create or replace function rankings(p_group uuid, p_game uuid, p_model text default 'glicko2')
returns table(rank int, player_id uuid, display_name text, rating numeric, uncertainty numeric, details jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_member(p_group) then raise exception 'not a member of that group'; end if;
  if p_model = 'elo' then
    return query
      select (rank() over (order by e.rating desc))::int, e.player_id, e.display_name,
             e.rating, null::numeric, jsonb_build_object('comparisons', e.comparisons)
      from elo_ratings(p_group, p_game) e;
  elsif p_model = 'glicko2' then
    return query
      select (rank() over (order by g.rating desc))::int, g.player_id, g.display_name,
             g.rating, g.rd, jsonb_build_object('rd', g.rd, 'volatility', g.volatility, 'periods', g.periods)
      from glicko2_ratings(p_group, p_game) g;
  else raise exception 'unknown ranking model: %', p_model;
  end if;
end $$;

-- ── Public: networked comparison of two players (guarded) ────────────────────
-- Uses Glicko-2 for an uncertainty-aware win probability, plus graph
-- connectivity for a derived confidence.
create or replace function compare_players(p_group uuid, p_game uuid, p_a uuid, p_b uuid)
returns table(
  name_a text, rating_a numeric, rd_a numeric,
  name_b text, rating_b numeric, rd_b numeric,
  win_prob_a numeric, played_directly boolean, connection_depth int,
  shared_opponents text[], confidence numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  qc constant double precision := ln(10) / 400.0;
  ra double precision; rda double precision; rb double precision; rdb double precision;
  na text; nb text; grd double precision; depth int; direct boolean; shared text[];
begin
  if not is_group_member(p_group) then raise exception 'not a member of that group'; end if;

  select r.rating, r.rd, r.display_name into ra, rda, na from glicko2_ratings(p_group, p_game) r where r.player_id = p_a;
  select r.rating, r.rd, r.display_name into rb, rdb, nb from glicko2_ratings(p_group, p_game) r where r.player_id = p_b;
  if ra is null or rb is null then raise exception 'both players need at least one match in this group+game'; end if;

  -- uncertainty-aware win probability (Glicko expected score)
  grd := 1.0 / sqrt(1.0 + 3.0 * qc * qc * (rda * rda + rdb * rdb) / (pi() * pi()));

  select degrees into depth from ranking_fof(p_group, p_game, p_a) where player_id = p_b;
  select exists(select 1 from ranking_edges where group_id = p_group and game_id = p_game
                and player_a = least(p_a, p_b) and player_b = greatest(p_a, p_b)) into direct;
  select array_agg(p.display_name order by p.display_name) into shared
  from ranking_fof(p_group, p_game, p_a, 1) fa
  join ranking_fof(p_group, p_game, p_b, 1) fb using (player_id)
  join players p on p.id = fa.player_id;

  return query select
    na, round(ra::numeric, 1), round(rda::numeric, 1),
    nb, round(rb::numeric, 1), round(rdb::numeric, 1),
    round((1.0 / (1.0 + power(10, -grd * (ra - rb) / 400.0)))::numeric, 3),
    direct,
    depth,
    coalesce(shared, array[]::text[]),
    -- derived confidence: closer connection + lower uncertainty => higher
    round((
      (case coalesce(depth, 99) when 1 then 1.0 when 2 then 0.7 when 3 then 0.45 else 0.2 end)
      * (1 - least(1.0, sqrt(rda * rda + rdb * rdb) / 700.0))
    )::numeric, 2);
end $$;

grant execute on function ranking_models() to authenticated;
grant execute on function rankings(uuid, uuid, text) to authenticated;
grant execute on function compare_players(uuid, uuid, uuid, uuid) to authenticated;
