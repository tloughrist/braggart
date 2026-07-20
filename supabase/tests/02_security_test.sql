-- RLS + guard checks: membership, owner-only edit/delete.
begin;
select plan(5);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Tim is not a member of this random group.
select throws_ok(
  $$ select * from rankings('00000000-0000-0000-0000-000000000099','a0000000-0000-0000-0000-0000000000a1','elo') $$,
  'not a member of that group');

select throws_ok(
  $$ select create_match('a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000099', now(),
       '[{"player_id":"11111111-1111-1111-1111-111111111111","score":1},
         {"player_id":"66666666-6666-6666-6666-666666666666","score":2}]'::jsonb) $$,
  'not a member of that group');

-- Katie is a group member but does not own Tim's match b1.
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select update_match('b0000000-0000-0000-0000-0000000000b1', now(),
       '[{"player_id":"33333333-3333-3333-3333-333333333333","score":1}]'::jsonb) $$,
  'only the match owner can edit it');

-- Non-owner delete is filtered by RLS (match remains).
delete from matches where id = 'b0000000-0000-0000-0000-0000000000b1';
select is(
  (select count(*)::int from matches where id = 'b0000000-0000-0000-0000-0000000000b1'),
  1, 'delete: RLS blocks a non-owner');

-- Owner can delete.
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
delete from matches where id = 'b0000000-0000-0000-0000-0000000000b2';
select is(
  (select count(*)::int from matches where id = 'b0000000-0000-0000-0000-0000000000b2'),
  0, 'delete: owner can delete their match');

select * from finish();
rollback;
