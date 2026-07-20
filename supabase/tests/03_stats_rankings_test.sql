-- Stats view + ranking dispatcher + networked comparison, against seed data.
begin;
select plan(6);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select matches from game_player_stats
   where group_id = 'd0000000-0000-0000-0000-0000000000d1' and game_name = 'Train Dominos'
     and player_id = '33333333-3333-3333-3333-333333333333'),
  3, 'stats: Barb played 3 Train Dominos matches');
select is(
  (select wins from game_player_stats
   where group_id = 'd0000000-0000-0000-0000-0000000000d1' and game_name = 'Train Dominos'
     and player_id = '33333333-3333-3333-3333-333333333333'),
  1, 'stats: Barb has 1 win');

select is(
  (select count(*)::int from rankings('d0000000-0000-0000-0000-0000000000d1','a0000000-0000-0000-0000-0000000000a1','glicko2')),
  6, 'rankings: glicko2 ranks all 6 players');

create temp table c as select * from compare_players(
  'd0000000-0000-0000-0000-0000000000d1','a0000000-0000-0000-0000-0000000000a1',
  '11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555');
select is((select played_directly from c), false, 'compare: Tim and James never played directly');
select is((select connection_depth from c), 2, 'compare: connected at depth 2');
select ok((select win_prob_a from c) > 0.5, 'compare: Tim is favored over James');

select * from finish();
rollback;
