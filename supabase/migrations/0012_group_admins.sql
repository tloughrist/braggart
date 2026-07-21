-- 0012: group admins.
-- A group's owner counts as an admin. Admins (owner or admin role) can edit and
-- delete any match or tournament in their group, and can grant/revoke admin on
-- other members. Regular members keep the prior behavior (manage only what they
-- own).

-- Is the caller an admin (owner or admin role) of the group? SECURITY DEFINER
-- so it can be used in policies without recursing through player_groups' RLS.
create function is_group_admin(p_group_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from player_groups
    where group_id = p_group_id and player_id = auth.uid()
      and status = 'active' and role in ('owner', 'admin')
  );
$$;

-- ── Matches: owner OR group admin may modify/delete ─────────────────────────
drop policy matches_modify on matches;
create policy matches_modify on matches for update to authenticated
  using (owner_id = auth.uid() or is_group_admin(group_id))
  with check (owner_id = auth.uid() or is_group_admin(group_id));

drop policy matches_delete on matches;
create policy matches_delete on matches for delete to authenticated
  using (owner_id = auth.uid() or is_group_admin(group_id));

drop policy player_matches_write on player_matches;
create policy player_matches_write on player_matches for all to authenticated
  using (exists (select 1 from matches m
                 where m.id = match_id and (m.owner_id = auth.uid() or is_group_admin(m.group_id))))
  with check (exists (select 1 from matches m
                      where m.id = match_id and (m.owner_id = auth.uid() or is_group_admin(m.group_id))));

-- update_match: allow the match owner OR a group admin
create or replace function update_match(p_match_id uuid, p_date timestamptz, p_players jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  most_points boolean;
  v_best int;
begin
  if not exists (
    select 1 from matches
    where id = p_match_id and (owner_id = auth.uid() or is_group_admin(group_id))
  ) then
    raise exception 'only the match owner or a group admin can edit it';
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
  into v_best from player_matches where match_id = p_match_id;

  with ranked as (
    select id,
      (score + handicap = v_best) as win,
      rank() over (order by (score + handicap) * (case when most_points then -1 else 1 end)) as place
    from player_matches where match_id = p_match_id
  )
  update player_matches pm set is_winner = r.win, finishing_place = r.place
  from ranked r where r.id = pm.id;
end $$;

-- ── Tournaments: owner OR group admin may update/delete ─────────────────────
drop policy tournaments_update on tournaments;
create policy tournaments_update on tournaments for update to authenticated
  using (owner_id = auth.uid() or is_group_admin(group_id))
  with check (owner_id = auth.uid() or is_group_admin(group_id));

create or replace function delete_tournament(p_tournament_id uuid, p_delete_matches boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_owner uuid;
begin
  select group_id, owner_id into v_group, v_owner from tournaments where id = p_tournament_id;
  if v_group is null then raise exception 'tournament not found'; end if;
  if not (v_owner = auth.uid() or is_group_admin(v_group)) then
    raise exception 'only the tournament owner or a group admin can delete it';
  end if;

  if p_delete_matches then
    delete from matches where tournament_id = p_tournament_id;
  else
    update matches set tournament_id = null where tournament_id = p_tournament_id;
  end if;

  delete from tournaments where id = p_tournament_id;
end $$;

-- ── Grant/revoke admin on a member (admins only; never touches the owner) ────
create function set_group_admin(p_group_id uuid, p_player_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group_id) then
    raise exception 'only a group admin can change member roles';
  end if;
  update player_groups
  set role = (case when p_is_admin then 'admin' else 'member' end)::membership_role
  where group_id = p_group_id and player_id = p_player_id
    and status = 'active' and role <> 'owner';
end $$;
grant execute on function set_group_admin(uuid, uuid, boolean) to authenticated;
