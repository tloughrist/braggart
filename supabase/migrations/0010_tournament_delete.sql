-- 0010: delete a tournament.
-- The owner can delete a tournament and either delete its matches too or keep
-- them as normal (detached) matches. SECURITY DEFINER because a tournament's
-- matches may be owned by other group members; the tournament owner is
-- authorized to manage them here.

create function delete_tournament(p_tournament_id uuid, p_delete_matches boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tournaments where id = p_tournament_id and owner_id = auth.uid()) then
    raise exception 'only the tournament owner can delete it';
  end if;

  if p_delete_matches then
    delete from matches where tournament_id = p_tournament_id; -- cascades to player_matches/team_matches
  else
    update matches set tournament_id = null where tournament_id = p_tournament_id;
  end if;

  delete from tournaments where id = p_tournament_id;
end $$;

grant execute on function delete_tournament(uuid, boolean) to authenticated;
