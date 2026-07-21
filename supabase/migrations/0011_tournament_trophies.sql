-- 0011: associate trophies with tournaments (parallel to game_trophies).
-- Trophies already link to games (game_trophies) and players (player_trophies);
-- this adds a tournament link. RLS is enabled to match the other trophy tables;
-- policies are added when the trophy UI is built.

create table tournament_trophies (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  trophy_id     uuid not null references trophies(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (tournament_id, trophy_id)
);
create index tournament_trophies_tournament_idx on tournament_trophies(tournament_id);

alter table tournament_trophies enable row level security;
