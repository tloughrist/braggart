/**
 * Data-access layer. This is the ONLY module that talks to the Supabase client
 * directly — screens and contexts call the domain functions here. Swapping the
 * backend (e.g. to an AWS API Gateway + Lambda REST API) means reimplementing
 * this file and nothing else.
 *
 * Conventions:
 *  - Errors are normalized to `string | null` (never the provider's error type).
 *  - Relational embeds are flattened to plain domain shapes.
 */
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

export type { Session, User } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

// ── domain types ────────────────────────────────────────────────────────────
export type Result<T> = { data: T | null; error: string | null };
export type Group = { id: string; name: string; role: string };
export type PlayerRef = { id: string; name: string };
export type GroupMember = { id: string; name: string; role: string };
export type GameRef = { id: string; name: string; teamBased: boolean };
export type Profile = {
  display_name: string | null;
  username: string | null;
  color_1: string | null;
  color_2: string | null;
  avatarUrl: string | null;
};
export type StatsRow = {
  game_id: string;
  game_name: string;
  player_id: string;
  display_name: string | null;
  matches: number;
  wins: number;
  win_rate: number | string;
  avg_point_deviation: number | string;
};
export type MatchPlayerInput = { player_id: string; score: number; handicap?: number };
export type MatchTeamInput = { name: string; score: number; player_ids: string[] };

export type MatchParticipant = {
  playerId: string;
  name: string;
  score: number | null;
  handicap: number;
  isWinner: boolean;
  place: number | null;
  teamId: string | null;
};
export type MatchTeamResult = {
  teamId: string;
  name: string;
  score: number | null;
  isWinner: boolean;
};
export type MatchSummary = {
  id: string;
  datePlayed: string | null;
  ownerId: string | null;
  gameId: string;
  gameName: string;
  teamBased: boolean;
  tournamentId: string | null;
  participants: MatchParticipant[];
  teams: MatchTeamResult[];
};
export type Tournament = {
  id: string;
  name: string;
  status: string; // 'active' | 'completed'
  ownerId: string | null;
  createdAt: string | null;
};

export type RankingModel = { model: string; label: string; has_uncertainty: boolean };
export type RankingRow = {
  rank: number;
  player_id: string;
  display_name: string | null;
  rating: number | string;
  uncertainty: number | string | null;
  details: Record<string, unknown>;
};
export type PlayerComparison = {
  name_a: string | null;
  rating_a: number | string;
  rd_a: number | string;
  name_b: string | null;
  rating_b: number | string;
  rd_b: number | string;
  win_prob_a: number | string;
  played_directly: boolean;
  connection_depth: number | null;
  shared_opponents: string[];
  confidence: number | string;
};

// PostgREST returns a to-one embed as an object, but the client types it loose;
// normalize to a single row either way.
const unwrapOne = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);
const playerName = (p: any): string => p?.display_name || p?.username || 'Player';

// ── auth ────────────────────────────────────────────────────────────────────
export const auth = {
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  /** Subscribe to auth changes; returns an unsubscribe function. */
  onAuthStateChange(cb: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  async signUp(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: displayName ? { display_name: displayName } : undefined },
    });
    return { error: error?.message ?? null };
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
  async updatePassword(password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  },
  /** True if the user's player profile exists; fails open on transient errors. */
  async profileExists(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    return error ? true : !!data;
  },
};

// ── groups ──────────────────────────────────────────────────────────────────
export async function getMyGroups(userId: string): Promise<Group[]> {
  const { data } = await supabase
    .from('player_groups')
    .select('role, group:groups(id, name)')
    .eq('player_id', userId)
    .eq('status', 'active');
  return (data ?? [])
    .map((r: any) => {
      const g = unwrapOne(r.group);
      return g ? { id: g.id as string, name: g.name as string, role: r.role as string } : null;
    })
    .filter((g): g is Group => g != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await supabase
    .from('player_groups')
    .select('role, player:players(id, display_name, username)')
    .eq('group_id', groupId)
    .eq('status', 'active');
  return (data ?? [])
    .map((r: any) => {
      const p = unwrapOne(r.player);
      return p ? { id: p.id as string, name: playerName(p), role: r.role as string } : null;
    })
    .filter(Boolean) as GroupMember[];
}

export async function getAllPlayers(): Promise<PlayerRef[]> {
  const { data } = await supabase
    .from('players')
    .select('id, display_name, username')
    .order('display_name');
  return (data ?? []).map((p: any) => ({ id: p.id as string, name: playerName(p) }));
}

export async function createGroup(name: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name });
  return { data: typeof data === 'string' ? data : null, error: error?.message ?? null };
}

export async function addGroupMember(
  groupId: string,
  playerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_group_member', {
    p_group_id: groupId,
    p_player_id: playerId,
  });
  return { error: error?.message ?? null };
}

/** Grant or revoke admin on a member (caller must be a group admin; never affects the owner). */
export async function setGroupAdmin(
  groupId: string,
  playerId: string,
  isAdmin: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_group_admin', {
    p_group_id: groupId,
    p_player_id: playerId,
    p_is_admin: isAdmin,
  });
  return { error: error?.message ?? null };
}

// ── games ───────────────────────────────────────────────────────────────────
export async function getGames(): Promise<GameRef[]> {
  const { data } = await supabase.from('games').select('id, name, team_based').order('name');
  return (data ?? []).map((g: any) => ({
    id: g.id as string,
    name: g.name as string,
    teamBased: !!g.team_based,
  }));
}

export type NewGame = {
  name: string;
  mostPointsWins: boolean;
  teamBased: boolean;
  cooperative: boolean;
  pointsToWin?: number | null;
  bggId?: number | null;
};

/**
 * Create a game owned by the current user. RLS (games_insert) requires
 * owner_id = auth.uid(), so this always produces a personal game, never a
 * universal-library one. Returns the new game as a GameRef for the picker.
 */
export async function createGame(input: NewGame, ownerId: string): Promise<Result<GameRef>> {
  const { data, error } = await supabase
    .from('games')
    .insert({
      owner_id: ownerId,
      name: input.name,
      most_points_wins: input.mostPointsWins,
      team_based: input.teamBased,
      cooperative: input.cooperative,
      points_to_win: input.pointsToWin ?? null,
      bgg_id: input.bggId ?? null,
    })
    .select('id, name, team_based')
    .single();
  if (error) return { data: null, error: error.message };
  return {
    data: { id: data.id as string, name: data.name as string, teamBased: !!data.team_based },
    error: null,
  };
}

// ── stats ───────────────────────────────────────────────────────────────────
export async function getGroupStats(groupId: string): Promise<Result<StatsRow[]>> {
  const { data, error } = await supabase
    .from('game_player_stats')
    .select('game_id, game_name, player_id, display_name, matches, wins, win_rate, avg_point_deviation')
    .eq('group_id', groupId)
    .order('game_name', { ascending: true })
    .order('wins', { ascending: false })
    .order('avg_point_deviation', { ascending: true })
    .returns<StatsRow[]>();
  return { data: data ?? null, error: error?.message ?? null };
}

// ── profile ─────────────────────────────────────────────────────────────────
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('players')
    .select('display_name, username, color_1, color_2, avatar:assets!players_avatar_fk(storage_path)')
    .eq('id', userId)
    .single();
  if (!data) return null;
  const asset = unwrapOne((data as any).avatar);
  const avatarUrl = asset?.storage_path
    ? supabase.storage.from('avatars').getPublicUrl(asset.storage_path).data.publicUrl
    : null;
  return {
    display_name: (data as any).display_name,
    username: (data as any).username,
    color_1: (data as any).color_1,
    color_2: (data as any).color_2,
    avatarUrl,
  };
}

/** Upload an avatar image (base64), record it as an asset, and link it to the player. */
export async function uploadAvatar(
  userId: string,
  base64: string,
  mime: string,
): Promise<Result<string>> {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: mime, upsert: true });
  if (upErr) return { data: null, error: upErr.message };

  const { data: asset, error: aErr } = await supabase
    .from('assets')
    .insert({ owner_id: userId, kind: 'avatar', storage_path: path })
    .select('id')
    .single();
  if (aErr) return { data: null, error: aErr.message };

  const { error: pErr } = await supabase
    .from('players')
    .update({ avatar_asset_id: asset.id })
    .eq('id', userId);
  if (pErr) return { data: null, error: pErr.message };

  return { data: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl, error: null };
}

export async function getPlayerTotals(userId: string): Promise<{ matches: number; wins: number }> {
  const { data } = await supabase
    .from('game_player_stats')
    .select('matches, wins')
    .eq('player_id', userId);
  const matches = (data ?? []).reduce((n: number, r: any) => n + (r.matches ?? 0), 0);
  const wins = (data ?? []).reduce((n: number, r: any) => n + (r.wins ?? 0), 0);
  return { matches, wins };
}

export async function updateProfile(
  userId: string,
  patch: { display_name: string | null; color_1: string; color_2: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('players').update(patch).eq('id', userId);
  return { error: error?.message ?? null };
}

// ── matches ─────────────────────────────────────────────────────────────────
export async function createMatch(input: {
  gameId: string;
  groupId: string | null;
  date: string;
  players: MatchPlayerInput[];
  tournamentId?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('create_match', {
    p_game_id: input.gameId,
    p_group_id: input.groupId,
    p_date: input.date,
    p_players: input.players,
    p_tournament_id: input.tournamentId ?? null,
  });
  return { error: error?.message ?? null };
}

export async function createTeamMatch(input: {
  gameId: string;
  groupId: string | null;
  date: string;
  teams: MatchTeamInput[];
  tournamentId?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('create_team_match', {
    p_game_id: input.gameId,
    p_group_id: input.groupId,
    p_date: input.date,
    p_teams: input.teams,
    p_tournament_id: input.tournamentId ?? null,
  });
  return { error: error?.message ?? null };
}

// ── match history ─────────────────────────────────────────────────────────
export async function getMatches(groupId: string): Promise<MatchSummary[]> {
  const { data } = await supabase
    .from('matches')
    .select(
      `id, date_played, owner_id, game_id, tournament_id,
       game:games ( name, team_based ),
       player_matches ( player_id, score, handicap, is_winner, finishing_place, team_id, player:players ( display_name ) ),
       team_matches ( team_id, score, is_winner, team:teams ( name ) )`,
    )
    .eq('group_id', groupId)
    .eq('status', 'completed')
    .order('date_played', { ascending: false, nullsFirst: false });

  return (data ?? []).map((m: any) => {
    const game = unwrapOne(m.game);
    return {
      id: m.id as string,
      datePlayed: m.date_played as string | null,
      ownerId: m.owner_id as string | null,
      gameId: m.game_id as string,
      gameName: game?.name ?? 'Game',
      teamBased: !!game?.team_based,
      tournamentId: m.tournament_id as string | null,
      participants: (m.player_matches ?? []).map((pm: any) => ({
        playerId: pm.player_id as string,
        name: playerName(unwrapOne(pm.player)),
        score: pm.score as number | null,
        handicap: (pm.handicap ?? 0) as number,
        isWinner: !!pm.is_winner,
        place: pm.finishing_place as number | null,
        teamId: pm.team_id as string | null,
      })),
      teams: (m.team_matches ?? []).map((tm: any) => ({
        teamId: tm.team_id as string,
        name: unwrapOne(tm.team)?.name ?? 'Team',
        score: tm.score as number | null,
        isWinner: !!tm.is_winner,
      })),
    };
  });
}

// ── tournaments ─────────────────────────────────────────────────────────────
export async function getTournaments(groupId: string): Promise<Tournament[]> {
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, status, owner_id, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    status: t.status as string,
    ownerId: t.owner_id as string | null,
    createdAt: t.created_at as string | null,
  }));
}

export async function createTournament(
  name: string,
  groupId: string,
  ownerId: string,
): Promise<Result<string>> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name, group_id: groupId, owner_id: ownerId })
    .select('id')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data.id as string, error: null };
}

export async function endTournament(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tournaments').update({ status: 'completed' }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function renameTournament(id: string, name: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tournaments').update({ name }).eq('id', id);
  return { error: error?.message ?? null };
}

/** Delete a tournament; either delete its matches too or detach them (keep as normal matches). */
export async function deleteTournament(
  id: string,
  deleteMatches: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('delete_tournament', {
    p_tournament_id: id,
    p_delete_matches: deleteMatches,
  });
  return { error: error?.message ?? null };
}

export async function updateMatch(input: {
  matchId: string;
  date: string;
  players: MatchPlayerInput[];
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_match', {
    p_match_id: input.matchId,
    p_date: input.date,
    p_players: input.players,
  });
  return { error: error?.message ?? null };
}

export async function deleteMatch(matchId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  return { error: error?.message ?? null };
}

// ── rankings ────────────────────────────────────────────────────────────────
export async function getRankingModels(): Promise<RankingModel[]> {
  const { data } = await supabase.rpc('ranking_models');
  return (data ?? []) as RankingModel[];
}

export async function getRankings(
  groupId: string,
  gameId: string,
  model: string,
): Promise<RankingRow[]> {
  const { data } = await supabase.rpc('rankings', {
    p_group: groupId,
    p_game: gameId,
    p_model: model,
  });
  return (data ?? []) as RankingRow[];
}

/** Networked comparison of two players (rating gap, win probability, connectivity). */
export async function comparePlayers(
  groupId: string,
  gameId: string,
  playerA: string,
  playerB: string,
): Promise<Result<PlayerComparison>> {
  const { data, error } = await supabase.rpc('compare_players', {
    p_group: groupId,
    p_game: gameId,
    p_a: playerA,
    p_b: playerB,
  });
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row ?? null) as PlayerComparison, error: null };
}
