-- Local demo data for Braggart. Loaded by `supabase db reset`.
-- Reproduces the "Train Dominos" leaderboard from the design mockup.
--
-- Players require an auth.users row (players.id FK). Inserting into auth.users
-- fires handle_new_user(), which creates the matching public.players profile —
-- so we only seed auth.users here, not players directly.

-- ── Users (→ players via trigger) ──────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tim@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Tim Loughrist","username":"tim"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'katie@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Katie Loughrist","username":"katie"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'barb@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Barb Loughlin","username":"barb"}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'garrett@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Garrett Loughlin","username":"garrett"}'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'james@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"James Mitchell","username":"james"}'),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jess@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Jess Mitchell","username":"jess"}');

-- GoTrue can't scan NULL into its token string fields (login fails with
-- "Database error querying schema"); blank them out. It also expects an email
-- identity row per user, so add one.
update auth.users set
  confirmation_token = '', recovery_token = '',
  email_change = '', email_change_token_new = '', email_change_token_current = '',
  phone_change = '', phone_change_token = '', reauthentication_token = ''
where email like '%@braggart.test';

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@braggart.test';

-- ── Game ───────────────────────────────────────────────────────────────────
insert into public.games (id, owner_id, name, most_points_wins, points_to_win)
values ('a0000000-0000-0000-0000-0000000000a1',
        '11111111-1111-1111-1111-111111111111', 'Train Dominos', false, null);

-- ── Matches (all completed, owned by Tim) ────────────────────────────────────
insert into public.matches (id, game_id, owner_id, status, date_played)
values
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '21 days'),
  ('b0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '14 days'),
  ('b0000000-0000-0000-0000-0000000000b3', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '7 days');

-- ── Results (scores tuned to match the mockup's computed stats) ──────────────
-- Match 1 — winner: Barb
insert into public.player_matches (match_id, player_id, score, is_winner) values
  ('b0000000-0000-0000-0000-0000000000b1', '33333333-3333-3333-3333-333333333333', 5,   true),
  ('b0000000-0000-0000-0000-0000000000b1', '44444444-4444-4444-4444-444444444444', 30,  false),
  ('b0000000-0000-0000-0000-0000000000b1', '55555555-5555-5555-5555-555555555555', 90,  false),
  ('b0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 100, false);

-- Match 2 — winner: Jess
insert into public.player_matches (match_id, player_id, score, is_winner) values
  ('b0000000-0000-0000-0000-0000000000b2', '66666666-6666-6666-6666-666666666666', 0,  true),
  ('b0000000-0000-0000-0000-0000000000b2', '33333333-3333-3333-3333-333333333333', 15, false),
  ('b0000000-0000-0000-0000-0000000000b2', '44444444-4444-4444-4444-444444444444', 85, false),
  ('b0000000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 49, false);

-- Match 3 — winner: Garrett
insert into public.player_matches (match_id, player_id, score, is_winner) values
  ('b0000000-0000-0000-0000-0000000000b3', '44444444-4444-4444-4444-444444444444', 10,  true),
  ('b0000000-0000-0000-0000-0000000000b3', '33333333-3333-3333-3333-333333333333', 26,  false),
  ('b0000000-0000-0000-0000-0000000000b3', '55555555-5555-5555-5555-555555555555', 105, false),
  ('b0000000-0000-0000-0000-0000000000b3', '22222222-2222-2222-2222-222222222222', 89,  false);

-- ── Second game (gives the game picker something to switch to) ───────────────
insert into public.games (id, owner_id, name, most_points_wins, points_to_win)
values ('a0000000-0000-0000-0000-0000000000a2',
        '11111111-1111-1111-1111-111111111111', 'Wingspan', true, null);

insert into public.matches (id, game_id, owner_id, status, date_played)
values
  ('c0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000a2',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '10 days'),
  ('c0000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-0000000000a2',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '3 days');

-- Wingspan match 1 — winner: Tim (highest score)
insert into public.player_matches (match_id, player_id, score, is_winner) values
  ('c0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 78, true),
  ('c0000000-0000-0000-0000-0000000000c1', '66666666-6666-6666-6666-666666666666', 70, false),
  ('c0000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', 65, false),
  ('c0000000-0000-0000-0000-0000000000c1', '55555555-5555-5555-5555-555555555555', 60, false);

-- Wingspan match 2 — winner: Barb
insert into public.player_matches (match_id, player_id, score, is_winner) values
  ('c0000000-0000-0000-0000-0000000000c2', '33333333-3333-3333-3333-333333333333', 82, true),
  ('c0000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 75, false),
  ('c0000000-0000-0000-0000-0000000000c2', '22222222-2222-2222-2222-222222222222', 71, false),
  ('c0000000-0000-0000-0000-0000000000c2', '44444444-4444-4444-4444-444444444444', 68, false);
