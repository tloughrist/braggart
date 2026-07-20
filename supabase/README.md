# Supabase: environments

The database schema is one thing; the data in it is what differs between
environments. Migrations are shared; seeding is not.

## Schema (shared)

`migrations/` holds the versioned schema — tables, RLS policies, SQL views, and
stored functions. Apply it the same way everywhere:

- Local / demo: `supabase db reset` (also seeds — see below).
- Production: `supabase db push` against the linked production project.

## Demo environment (rich data)

`seeds/demo.sql` is loaded automatically by `supabase db reset`
(`config.toml` → `[db.seed].sql_paths`). It builds a full showcase: a dozen
players, ten games, three overlapping groups, ~50 matches, a tournament, and
trophies.

It has two sections:

- **Section A — core.** A small, stable dataset the pgTAP tests
  (`supabase test db`) pin to. Do not modify it. In particular, do not add
  Train Dominos matches to "Thursday Night Gamers", change its six members, or
  let Tim and James play Train Dominos directly.
- **Section B — demo.** The rich data, built around the core.

Demo logins: any seeded user at `<username>@braggart.test` with password
`braggart` (for example `tim@braggart.test`).

## Production environment (clean)

Production runs **no seed** — migrations only — so it starts empty and real
users create their own data. Never run `seeds/demo.sql` against production.

## Pointing the app at an environment

The app reads its backend from `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Point these at the demo or
the production Supabase project (e.g. a separate `.env` per environment) to
switch which backend a build targets.
