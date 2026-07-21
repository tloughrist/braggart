-- ============================================================================
-- Braggart DEMO seed.
--
-- Loaded into DEMO / local environments by `supabase db reset`
-- (see config.toml [db.seed].sql_paths). PRODUCTION runs no seed — migrations
-- only — so production starts clean.
--
-- Two sections:
--   A) CORE  — a small, stable dataset the pgTAP tests pin to. DO NOT MODIFY.
--              In particular: do not add Train Dominos matches to "Thursday
--              Night Gamers", change its six members, or let Tim and James play
--              Train Dominos directly.
--   B) DEMO  — rich data (more users, games, groups, matches, a trophy, a
--              tournament) built AROUND the core to show the app off.
-- ============================================================================


-- ============================================================================
-- SECTION A: CORE  (test fixtures — do not modify)
-- ============================================================================

-- Players require an auth.users row (players.id FK). Inserting into auth.users
-- fires handle_new_user(), which creates the matching public.players profile.
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

update auth.users set
  confirmation_token = '', recovery_token = '',
  email_change = '', email_change_token_new = '', email_change_token_current = '',
  phone_change = '', phone_change_token = '', reauthentication_token = ''
where email like '%@braggart.test';

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@braggart.test'
  and not exists (select 1 from auth.identities i where i.user_id = auth.users.id);

insert into public.groups (id, owner_id, name)
values ('d0000000-0000-0000-0000-0000000000d1',
        '11111111-1111-1111-1111-111111111111', 'Thursday Night Gamers');

insert into public.player_groups (player_id, group_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-0000000000d1', 'owner',  'active'),
  ('22222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-0000000000d1', 'member', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-0000000000d1', 'member', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000d1', 'member', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'd0000000-0000-0000-0000-0000000000d1', 'member', 'active'),
  ('66666666-6666-6666-6666-666666666666', 'd0000000-0000-0000-0000-0000000000d1', 'member', 'active');

insert into public.games (id, owner_id, name, most_points_wins, points_to_win)
values ('a0000000-0000-0000-0000-0000000000a1',
        '11111111-1111-1111-1111-111111111111', 'Train Dominos', false, null);

insert into public.matches (id, game_id, owner_id, status, date_played)
values
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '21 days'),
  ('b0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '14 days'),
  ('b0000000-0000-0000-0000-0000000000b3', 'a0000000-0000-0000-0000-0000000000a1',
   '11111111-1111-1111-1111-111111111111', 'completed', now() - interval '7 days');

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

update public.matches set group_id = 'd0000000-0000-0000-0000-0000000000d1'
where owner_id = '11111111-1111-1111-1111-111111111111';

insert into public.games (id, owner_id, name, most_points_wins, team_based)
values ('a0000000-0000-0000-0000-0000000000a3',
        '11111111-1111-1111-1111-111111111111', 'Codenames', true, true);

-- Cosmetic only (untested): backfill finishing_place for the core matches so the
-- history view shows placements. Does not touch is_winner.
with ranked as (
  select pm.id,
    rank() over (partition by pm.match_id
                 order by pm.score * (case when g.most_points_wins then -1 else 1 end)) as place
  from player_matches pm
  join matches m on m.id = pm.match_id
  join games g on g.id = m.game_id
  where m.group_id = 'd0000000-0000-0000-0000-0000000000d1'
)
update player_matches pm set finishing_place = r.place from ranked r where r.id = pm.id;


-- ============================================================================
-- SECTION B: DEMO  (rich data built around the core)
-- ============================================================================

-- ── More players ────────────────────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sandy@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Sandy Nguyen","username":"sandy"}'),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mike@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Mike Alvarez","username":"mike"}'),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'priya@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Priya Shah","username":"priya"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'diego@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Diego Ramos","username":"diego"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lena@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Lena Fischer","username":"lena"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'omar@braggart.test', crypt('braggart', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Omar Haddad","username":"omar"}');

update auth.users set
  confirmation_token = '', recovery_token = '',
  email_change = '', email_change_token_new = '', email_change_token_current = '',
  phone_change = '', phone_change_token = '', reauthentication_token = ''
where email like '%@braggart.test';

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@braggart.test'
  and not exists (select 1 from auth.identities i where i.user_id = auth.users.id);

-- ── More games (shared library; owned by Sandy) ─────────────────────────────
insert into public.games (id, owner_id, name, most_points_wins, cooperative, points_to_win) values
  ('a0000000-0000-0000-0000-0000000000a4', '77777777-7777-7777-7777-777777777777', 'Catan',            true, false, 10),
  ('a0000000-0000-0000-0000-0000000000a5', '77777777-7777-7777-7777-777777777777', 'Ticket to Ride',   true, false, null),
  ('a0000000-0000-0000-0000-0000000000a6', '77777777-7777-7777-7777-777777777777', 'Azul',             true, false, null),
  ('a0000000-0000-0000-0000-0000000000a7', '77777777-7777-7777-7777-777777777777', '7 Wonders',        true, false, null),
  ('a0000000-0000-0000-0000-0000000000a8', '77777777-7777-7777-7777-777777777777', 'Splendor',         true, false, 15),
  ('a0000000-0000-0000-0000-0000000000a9', '77777777-7777-7777-7777-777777777777', 'Carcassonne',      true, false, null),
  ('a0000000-0000-0000-0000-0000000000aa', '77777777-7777-7777-7777-777777777777', 'Pandemic',         true, true,  null);

-- ── More groups (overlapping membership with the core group) ────────────────
insert into public.groups (id, owner_id, name) values
  ('d0000000-0000-0000-0000-0000000000d2', '77777777-7777-7777-7777-777777777777', 'Meeple Mavens'),
  ('d0000000-0000-0000-0000-0000000000d3', '88888888-8888-8888-8888-888888888888', 'Family Game Night');

insert into public.player_groups (player_id, group_id, role, status) values
  -- Meeple Mavens
  ('77777777-7777-7777-7777-777777777777', 'd0000000-0000-0000-0000-0000000000d2', 'owner',  'active'),
  ('88888888-8888-8888-8888-888888888888', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  ('99999999-9999-9999-9999-999999999999', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd0000000-0000-0000-0000-0000000000d2', 'member', 'active'),
  -- Family Game Night
  ('88888888-8888-8888-8888-888888888888', 'd0000000-0000-0000-0000-0000000000d3', 'owner',  'active'),
  ('99999999-9999-9999-9999-999999999999', 'd0000000-0000-0000-0000-0000000000d3', 'member', 'active'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'd0000000-0000-0000-0000-0000000000d3', 'member', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-0000000000d3', 'member', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000d3', 'member', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000000-0000-0000-0000-0000000000d3', 'member', 'active');

-- ── Match generation helpers (dropped at the end) ───────────────────────────
create function _seed_match(p_owner uuid, p_group uuid, p_game uuid, p_date timestamptz,
                            p_players uuid[], p_scores int[], p_tournament uuid default null)
returns void language plpgsql as $fn$
declare v_match uuid; v_most boolean; v_best int; i int;
begin
  select most_points_wins into v_most from games where id = p_game;
  insert into matches (game_id, group_id, owner_id, status, date_played, tournament_id)
  values (p_game, p_group, p_owner, 'completed', p_date, p_tournament) returning id into v_match;
  select case when v_most then max(s) else min(s) end into v_best from unnest(p_scores) s;
  for i in 1 .. array_length(p_players, 1) loop
    insert into player_matches (match_id, player_id, score, is_winner, finishing_place)
    values (v_match, p_players[i], p_scores[i], p_scores[i] = v_best,
      (select 1 + count(*) from unnest(p_scores) s
       where case when v_most then s > p_scores[i] else s < p_scores[i] end));
  end loop;
end $fn$;

create function _seed_rand(p_owner uuid, p_group uuid, p_game uuid, p_date timestamptz,
                           p_pool uuid[], p_n int, p_lo int, p_hi int, p_tournament uuid default null)
returns void language plpgsql as $fn$
declare v_players uuid[]; v_scores int[]; n int;
begin
  n := least(p_n, array_length(p_pool, 1));
  select array_agg(x order by random()) into v_players from unnest(p_pool) x;
  v_players := v_players[1:n];
  select array_agg(p_lo + floor(random() * (p_hi - p_lo + 1))::int) into v_scores from generate_series(1, n);
  perform _seed_match(p_owner, p_group, p_game, p_date, v_players, v_scores, p_tournament);
end $fn$;

-- ── Generated matches ───────────────────────────────────────────────────────
do $do$
declare
  i int; g uuid; dt timestamptz;
  mm_pool  uuid[] := array['77777777-7777-7777-7777-777777777777','88888888-8888-8888-8888-888888888888',
                           '99999999-9999-9999-9999-999999999999','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                           '11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
                           'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']::uuid[];
  fgn_pool uuid[] := array['88888888-8888-8888-8888-888888888888','99999999-9999-9999-9999-999999999999',
                           'cccccccc-cccc-cccc-cccc-cccccccccccc','22222222-2222-2222-2222-222222222222',
                           '44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']::uuid[];
  thu_pool uuid[] := array['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                           '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
                           '55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666']::uuid[];
  mm_games  uuid[] := array['a0000000-0000-0000-0000-0000000000a4','a0000000-0000-0000-0000-0000000000a5',
                            'a0000000-0000-0000-0000-0000000000a6','a0000000-0000-0000-0000-0000000000a7',
                            'a0000000-0000-0000-0000-0000000000a8']::uuid[];
  fgn_games uuid[] := array['a0000000-0000-0000-0000-0000000000a4','a0000000-0000-0000-0000-0000000000a9',
                            'a0000000-0000-0000-0000-0000000000a8','a0000000-0000-0000-0000-0000000000a6']::uuid[];
  thu_new   uuid[] := array['a0000000-0000-0000-0000-0000000000a4','a0000000-0000-0000-0000-0000000000a6',
                            'a0000000-0000-0000-0000-0000000000a7']::uuid[];
begin
  perform setseed(0.4242);

  -- Meeple Mavens
  for i in 1..16 loop
    g := mm_games[1 + floor(random() * array_length(mm_games, 1))::int];
    dt := now() - (random() * 120 || ' days')::interval;
    perform _seed_rand('77777777-7777-7777-7777-777777777777', 'd0000000-0000-0000-0000-0000000000d2',
                       g, dt, mm_pool, 3 + floor(random() * 3)::int, 20, 110);
  end loop;

  -- Family Game Night
  for i in 1..16 loop
    g := fgn_games[1 + floor(random() * array_length(fgn_games, 1))::int];
    dt := now() - (random() * 120 || ' days')::interval;
    perform _seed_rand('88888888-8888-8888-8888-888888888888', 'd0000000-0000-0000-0000-0000000000d3',
                       g, dt, fgn_pool, 3 + floor(random() * 2)::int, 15, 100);
  end loop;

  -- Thursday Night Gamers: NEW games only (never Train Dominos/Wingspan/Codenames)
  for i in 1..8 loop
    g := thu_new[1 + floor(random() * array_length(thu_new, 1))::int];
    dt := now() - (random() * 90 || ' days')::interval;
    perform _seed_rand('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-0000000000d1',
                       g, dt, thu_pool, 3 + floor(random() * 3)::int, 20, 110);
  end loop;
end $do$;

-- ── A tournament (a Catan series in Meeple Mavens) ──────────────────────────
insert into public.tournaments (id, owner_id, group_id, name)
values ('f0000000-0000-0000-0000-0000000000f1', '77777777-7777-7777-7777-777777777777',
        'd0000000-0000-0000-0000-0000000000d2', 'Spring Catan Championship');

do $do$
declare i int;
begin
  perform setseed(0.99);
  for i in 1..5 loop
    perform _seed_rand('77777777-7777-7777-7777-777777777777', 'd0000000-0000-0000-0000-0000000000d2',
                       'a0000000-0000-0000-0000-0000000000a4',
                       now() - ((30 - i * 5) || ' days')::interval,
                       array['77777777-7777-7777-7777-777777777777','99999999-9999-9999-9999-999999999999',
                             '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']::uuid[],
                       4, 20, 110, 'f0000000-0000-0000-0000-0000000000f1');
  end loop;
end $do$;

drop function _seed_rand(uuid, uuid, uuid, timestamptz, uuid[], int, int, int, uuid);
drop function _seed_match(uuid, uuid, uuid, timestamptz, uuid[], int[], uuid);

-- ── Trophies (data only; the awarding/viewing UI is future work) ────────────
insert into public.trophies (id, name, kind) values
  ('e0000000-0000-0000-0000-0000000000e1', 'Game Night Champion', 'most_wins'),
  ('e0000000-0000-0000-0000-0000000000e2', 'First Victory',       'first_game');

insert into public.player_trophies (player_id, trophy_id, number_awarded) values
  ('33333333-3333-3333-3333-333333333333', 'e0000000-0000-0000-0000-0000000000e1', 3),
  ('77777777-7777-7777-7777-777777777777', 'e0000000-0000-0000-0000-0000000000e1', 2),
  ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-0000000000e1', 1),
  ('66666666-6666-6666-6666-666666666666', 'e0000000-0000-0000-0000-0000000000e2', 1),
  ('44444444-4444-4444-4444-444444444444', 'e0000000-0000-0000-0000-0000000000e2', 1);

insert into public.game_trophies (game_id, trophy_id) values
  ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000e1'),
  ('a0000000-0000-0000-0000-0000000000a4', 'e0000000-0000-0000-0000-0000000000e1');

-- a trophy tied to the tournament
insert into public.tournament_trophies (tournament_id, trophy_id) values
  ('f0000000-0000-0000-0000-0000000000f1', 'e0000000-0000-0000-0000-0000000000e1');
