-- 0004: group scoping.
-- Adds membership plumbing, RLS for groups/player_groups, group-scoped stats,
-- and group_id support in match creation.

-- ---------------------------------------------------------------------------
-- Membership helper. SECURITY DEFINER so it bypasses RLS on player_groups —
-- this is what lets policies on groups/player_groups reference membership
-- without recursing back through those same policies.
-- ---------------------------------------------------------------------------
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from player_groups
    where group_id = p_group_id and player_id = auth.uid() and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: read your own groups and their memberships
-- ---------------------------------------------------------------------------
create policy groups_select on groups for select to authenticated
  using (owner_id = auth.uid() or is_group_member(id));

create policy player_groups_select on player_groups for select to authenticated
  using (player_id = auth.uid() or is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Group mutations via SECURITY DEFINER RPCs (they enforce authorization in the
-- body, so no INSERT policies are needed on the tables).
-- ---------------------------------------------------------------------------
create function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  insert into groups (owner_id, name) values (auth.uid(), p_name) returning id into v_group_id;
  insert into player_groups (player_id, group_id, role, status)
    values (auth.uid(), v_group_id, 'owner', 'active');
  return v_group_id;
end; $$;
grant execute on function public.create_group(text) to authenticated;

create function public.add_group_member(p_group_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from player_groups
    where group_id = p_group_id and player_id = auth.uid()
      and role in ('owner', 'admin') and status = 'active'
  ) then
    raise exception 'only a group owner or admin can add members';
  end if;
  insert into player_groups (player_id, group_id, role, status)
    values (p_player_id, p_group_id, 'member', 'active')
  on conflict (player_id, group_id) do update set status = 'active';
end; $$;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Group-scoped stats: rebuild the view with a group dimension so the app can
-- filter a leaderboard to one group.
-- ---------------------------------------------------------------------------
drop view public.game_player_stats;
create view public.game_player_stats
with (security_invoker = true) as
with results as (
  select
    m.group_id,
    m.game_id,
    g.name as game_name,
    pm.match_id,
    pm.player_id,
    pm.score,
    pm.is_winner,
    max(pm.score) filter (where pm.is_winner)
      over (partition by pm.match_id) as winner_score
  from player_matches pm
  join matches m on m.id = pm.match_id
  join games   g on g.id = m.game_id
  where m.status = 'completed'
)
select
  r.group_id,
  r.game_id,
  r.game_name,
  r.player_id,
  p.display_name,
  p.username,
  count(*)::int                            as matches,
  count(*) filter (where r.is_winner)::int as wins,
  round(count(*) filter (where r.is_winner)::numeric / nullif(count(*), 0), 2) as win_rate,
  round(avg(abs(coalesce(r.winner_score, r.score) - r.score)), 2)              as avg_point_deviation
from results r
join players p on p.id = r.player_id
group by r.group_id, r.game_id, r.game_name, r.player_id, p.display_name, p.username;

grant select on public.game_player_stats to authenticated;

-- ---------------------------------------------------------------------------
-- create_match: add p_group_id (require membership when set)
-- ---------------------------------------------------------------------------
drop function public.create_match(uuid, timestamptz, jsonb);
create function public.create_match(
  p_game_id  uuid,
  p_group_id uuid,
  p_date     timestamptz,
  p_players  jsonb
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

  select case when v_most_points then max((e->>'score')::int)
              else min((e->>'score')::int) end
  into v_best from jsonb_array_elements(p_players) e;

  insert into player_matches (match_id, player_id, score, is_winner, finishing_place)
  select
    v_match_id,
    (e->>'player_id')::uuid,
    (e->>'score')::int,
    (e->>'score')::int = v_best,
    rank() over (order by (e->>'score')::int * (case when v_most_points then -1 else 1 end))
  from jsonb_array_elements(p_players) e;

  return v_match_id;
end; $$;
grant execute on function public.create_match(uuid, uuid, timestamptz, jsonb) to authenticated;
