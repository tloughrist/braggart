-- Winner/placement logic for create_match, create_team_match, update_match.
-- Fixtures come from supabase/seed.sql; all mutations roll back.
begin;
select plan(4);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Train Dominos is lowest-score-wins.
-- 1) create_match: Jess (10) beats Tim (50)
create temp table m1 as select create_match(
  'a0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000d1', now(),
  '[{"player_id":"11111111-1111-1111-1111-111111111111","score":50},
    {"player_id":"66666666-6666-6666-6666-666666666666","score":10}]'::jsonb) as id;
select is(
  (select p.display_name from player_matches pm join players p on p.id = pm.player_id
   where pm.match_id = (select id from m1) and pm.is_winner),
  'Jess Mitchell', 'create_match: lowest score wins');

-- 2) handicap flips it: Tim 50 with -45 handicap (effective 5) beats Jess 10
create temp table m2 as select create_match(
  'a0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000d1', now(),
  '[{"player_id":"11111111-1111-1111-1111-111111111111","score":50,"handicap":-45},
    {"player_id":"66666666-6666-6666-6666-666666666666","score":10}]'::jsonb) as id;
select is(
  (select p.display_name from player_matches pm join players p on p.id = pm.player_id
   where pm.match_id = (select id from m2) and pm.is_winner),
  'Tim Loughrist', 'create_match: handicap flips the winner');

-- 3) team match (Codenames, highest-wins): Team B (Jess, 10) beats Team A (Tim, 5)
create temp table m3 as select create_team_match(
  'a0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000d1', now(),
  '[{"name":"A","score":5,"player_ids":["11111111-1111-1111-1111-111111111111"]},
    {"name":"B","score":10,"player_ids":["66666666-6666-6666-6666-666666666666"]}]'::jsonb) as id;
select is(
  (select pm.is_winner from player_matches pm
   where pm.match_id = (select id from m3) and pm.player_id = '66666666-6666-6666-6666-666666666666'),
  true, 'create_team_match: winning team member is marked winner');

-- 4) update_match re-ranks: drop Tim to 1 (now lowest) so Tim wins m1
select update_match((select id from m1), now(),
  '[{"player_id":"11111111-1111-1111-1111-111111111111","score":1},
    {"player_id":"66666666-6666-6666-6666-666666666666","score":10}]'::jsonb);
select is(
  (select p.display_name from player_matches pm join players p on p.id = pm.player_id
   where pm.match_id = (select id from m1) and pm.is_winner),
  'Tim Loughrist', 'update_match: recomputes the winner');

select * from finish();
rollback;
