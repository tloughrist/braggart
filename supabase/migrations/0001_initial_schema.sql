-- Braggart — initial schema
-- Postgres / Supabase. Derived from the data model in README.md, with a few
-- deliberate cleanups noted inline (search for "NOTE:").
--
-- Conventions:
--   * every table has a uuid PK, created_at, and (where mutable) updated_at
--   * lifecycle/soft-delete handled by a `status` enum instead of a free-text "state"
--   * auth/credentials live in Supabase's auth.users; `players` is the public profile
--   * images live in Supabase Storage; `assets` rows point at storage paths
--
-- Apply with:  supabase db reset   (local)   or via the SQL editor / migration push.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- case-insensitive usernames/emails

-- ---------------------------------------------------------------------------
-- Enums  (replace the ambiguous free-text "state" columns from the diagram)
-- ---------------------------------------------------------------------------
create type entity_status     as enum ('active', 'archived', 'deleted');
create type match_status      as enum ('draft', 'in_progress', 'completed', 'cancelled');
create type friendship_status as enum ('pending', 'accepted', 'blocked');
create type membership_status as enum ('invited', 'active', 'left', 'removed');
create type membership_role   as enum ('member', 'admin', 'owner');
create type asset_kind        as enum ('avatar', 'game', 'team', 'group', 'trophy', 'match_photo');
create type trophy_kind       as enum ('first_game', 'most_wins', 'streak', 'custom');

-- ---------------------------------------------------------------------------
-- updated_at touch trigger (shared)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- PLAYERS  (profile row, 1:1 with auth.users)
-- NOTE: dropped `password` (owned by auth.users) and moved credentials out.
--       `avatar_asset_id` FK is added after `assets` exists (circular ref).
-- ===========================================================================
create table players (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        citext unique,
  display_name    text,
  email           citext,
  avatar_asset_id uuid,                       -- FK added below
  color_1         text,
  color_2         text,
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger players_touch before update on players
  for each row execute function set_updated_at();

-- ===========================================================================
-- ASSETS  (uploaded images)
-- NOTE: the diagram's separate Thumbnails table + Assets triangle is collapsed
--       into one table: full image + optional generated thumbnail, both as
--       Storage paths. Entities reference an asset directly.
-- ===========================================================================
create table assets (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references players(id) on delete set null,
  kind           asset_kind not null,
  storage_path   text not null,               -- path within a Supabase Storage bucket
  thumbnail_path text,
  created_at     timestamptz not null default now()
);
create index assets_owner_idx on assets(owner_id);

-- deferred circular FK: player avatar -> asset
alter table players
  add constraint players_avatar_fk
  foreign key (avatar_asset_id) references assets(id) on delete set null;

-- ===========================================================================
-- GAMES  (+ variants folded in as a self-referential parent)
-- NOTE: the standalone Variants table (id + base_game_id only) is modeled as a
--       nullable self-FK `parent_game_id`; a variant IS a game with a parent.
-- ===========================================================================
create table games (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references players(id) on delete set null,  -- null = universal library game
  parent_game_id  uuid references games(id) on delete cascade,     -- non-null = variant of another game
  name            text not null,
  most_points_wins boolean not null default true,
  team_based      boolean not null default false,
  cooperative     boolean not null default false,
  points_to_win   int,
  weight          numeric(3,2),               -- BGG-style complexity 1.00–5.00 (was Bigint)
  difficulty      numeric(3,2),
  image_asset_id  uuid references assets(id) on delete set null,
  bgg_id          int,                        -- for a future BoardGameGeek import
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index games_owner_idx  on games(owner_id);
create index games_parent_idx on games(parent_game_id);
create trigger games_touch before update on games
  for each row execute function set_updated_at();

-- ===========================================================================
-- GROUPS  (a local playing group)
-- ===========================================================================
create table groups (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references players(id) on delete set null,
  name           text not null,
  image_asset_id uuid references assets(id) on delete set null,
  color_1        text,
  color_2        text,
  status         entity_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index groups_owner_idx on groups(owner_id);
create trigger groups_touch before update on groups
  for each row execute function set_updated_at();

-- player_groups: membership join
-- NOTE: the diagram duplicated group columns here (name/colors/thumbnail) —
--       dropped as copy-paste; membership just needs role + status.
create table player_groups (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  role       membership_role   not null default 'member',
  status     membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (player_id, group_id)
);
create index player_groups_group_idx  on player_groups(group_id);
create index player_groups_player_idx on player_groups(player_id);

-- ===========================================================================
-- TEAMS
-- ===========================================================================
create table teams (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  image_asset_id uuid references assets(id) on delete set null,
  color_1        text,
  color_2        text,
  status         entity_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger teams_touch before update on teams
  for each row execute function set_updated_at();

create table player_teams (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, team_id)
);
create index player_teams_team_idx on player_teams(team_id);

-- ===========================================================================
-- TOURNAMENTS
-- ===========================================================================
create table tournaments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references players(id) on delete set null,
  group_id   uuid references groups(id) on delete set null,
  name       text not null,
  status     entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tournaments_touch before update on tournaments
  for each row execute function set_updated_at();

-- ===========================================================================
-- MATCHES
-- ===========================================================================
create table matches (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete restrict,
  owner_id      uuid not null references players(id) on delete set null,
  group_id      uuid references groups(id) on delete set null,
  tournament_id uuid references tournaments(id) on delete set null,
  weight        numeric(3,2),
  status        match_status not null default 'draft',
  date_played   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index matches_game_idx  on matches(game_id);
create index matches_owner_idx on matches(owner_id);
create index matches_group_idx on matches(group_id);
create trigger matches_touch before update on matches
  for each row execute function set_updated_at();

-- player_matches: the core results/scoring join
-- NOTE: added `handicap` (README: "add handicaps"), `finishing_place`, and a
--       stored `is_winner` so stats/ranking queries don't re-derive win logic.
create table player_matches (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  team_id         uuid references teams(id) on delete set null,
  score           int,
  handicap        int not null default 0,
  place_in_order  int,        -- turn order (who goes first, etc.)
  finishing_place int,        -- 1 = winner, 2 = runner-up, ...
  is_winner       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (match_id, player_id)
);
create index player_matches_match_idx  on player_matches(match_id);
create index player_matches_player_idx on player_matches(player_id);

create table team_matches (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  score      int,
  is_winner  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);
create index team_matches_match_idx on team_matches(match_id);

-- match photos (join to assets)
create table match_assets (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  asset_id   uuid not null references assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, asset_id)
);

-- ===========================================================================
-- FRIENDSHIPS  (directed request, single row per pair)
-- ===========================================================================
create table friendships (
  id          uuid primary key default gen_random_uuid(),
  friender_id uuid not null references players(id) on delete cascade,
  friended_id uuid not null references players(id) on delete cascade,
  status      friendship_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (friender_id <> friended_id),
  unique (friender_id, friended_id)
);
create index friendships_friended_idx on friendships(friended_id);
create trigger friendships_touch before update on friendships
  for each row execute function set_updated_at();

-- ===========================================================================
-- NOTES + MENTIONS
-- ===========================================================================
create table notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references players(id) on delete cascade,
  match_id   uuid references matches(id) on delete cascade,
  game_id    uuid references games(id) on delete cascade,
  message    text not null,
  status     entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_match_idx on notes(match_id);
create index notes_game_idx  on notes(game_id);
create trigger notes_touch before update on notes
  for each row execute function set_updated_at();

create table mentions (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references notes(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (note_id, player_id)
);
create index mentions_player_idx on mentions(player_id);

-- ===========================================================================
-- TROPHIES
-- NOTE: FirstGameTrophy (and future subtypes) collapsed into a `kind`
--       discriminator + `criteria` jsonb, instead of table-per-subtype.
-- ===========================================================================
create table trophies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           trophy_kind not null default 'custom',
  criteria       jsonb,                       -- rule config for auto-awarding
  image_asset_id uuid references assets(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table player_trophies (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  trophy_id      uuid not null references trophies(id) on delete cascade,
  number_awarded int not null default 1,
  created_at     timestamptz not null default now(),
  unique (player_id, trophy_id)
);
create index player_trophies_player_idx on player_trophies(player_id);

create table game_trophies (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  trophy_id  uuid not null references trophies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, trophy_id)
);

-- ===========================================================================
-- AUTH HOOK: create a player profile row when a new auth user signs up
-- ===========================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, email, display_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- Enable on every table. Below are the core policies; tables marked
-- "(same pattern)" follow the owner-writes / authenticated-reads shape and
-- should get equivalent policies as those features get built.
-- ===========================================================================
alter table players         enable row level security;
alter table assets          enable row level security;
alter table games           enable row level security;
alter table groups          enable row level security;
alter table player_groups   enable row level security;
alter table teams           enable row level security;
alter table player_teams    enable row level security;
alter table tournaments     enable row level security;
alter table matches         enable row level security;
alter table player_matches  enable row level security;
alter table team_matches    enable row level security;
alter table match_assets    enable row level security;
alter table friendships     enable row level security;
alter table notes           enable row level security;
alter table mentions        enable row level security;
alter table trophies        enable row level security;
alter table player_trophies enable row level security;
alter table game_trophies   enable row level security;

-- players: anyone authenticated can read profiles; you can only edit your own
create policy players_read  on players for select to authenticated using (true);
create policy players_update on players for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- games: read library + your own; write your own (owner_id null = universal, read-only)
create policy games_read  on games for select to authenticated using (true);
create policy games_insert on games for insert to authenticated
  with check (owner_id = auth.uid());
create policy games_modify on games for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy games_delete on games for delete to authenticated
  using (owner_id = auth.uid());

-- matches: readable by authenticated; only the owner may create/edit
-- (README: "Owner and only owner can edit scores")
create policy matches_read  on matches for select to authenticated using (true);
create policy matches_insert on matches for insert to authenticated
  with check (owner_id = auth.uid());
create policy matches_modify on matches for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- player_matches: scores are writable only by the owner of the parent match
create policy player_matches_read on player_matches for select to authenticated using (true);
create policy player_matches_write on player_matches for all to authenticated
  using (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()))
  with check (exists (select 1 from matches m where m.id = match_id and m.owner_id = auth.uid()));

-- friendships: you can see/act on rows where you're a party
create policy friendships_read on friendships for select to authenticated
  using (friender_id = auth.uid() or friended_id = auth.uid());
create policy friendships_write on friendships for all to authenticated
  using (friender_id = auth.uid() or friended_id = auth.uid())
  with check (friender_id = auth.uid() or friended_id = auth.uid());

-- Remaining tables (assets, groups, player_groups, teams, player_teams,
-- tournaments, team_matches, match_assets, notes, mentions, trophies,
-- player_trophies, game_trophies) have RLS ON but no policies yet, so they
-- are locked down by default. Add policies as each feature lands — most
-- follow the same "owner writes / authenticated reads" pattern above.

-- ---------------------------------------------------------------------------
-- Table-level GRANTs
-- Postgres requires BOTH a table privilege AND a passing RLS policy. RLS above
-- is the row-level gate; these grants are the table-level gate. Tables whose
-- RLS has no policy stay locked (RLS default-denies), so granting broadly to
-- `authenticated` is safe — the policies remain the real boundary.
-- `service_role` bypasses RLS entirely (used only server-side).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;

-- keep future tables/sequences in this schema grantable without repeating the above
alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;
