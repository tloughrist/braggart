import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import {
  defaultFilters,
  filtersActive,
  HistoryFilters,
  type Filters,
} from '@/components/HistoryFilters';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { ThemedText } from '@/components/ThemedText';
import { TournamentDetailModal } from '@/components/TournamentDetailModal';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { endTournament, getMatches, getTournaments, type MatchSummary, type Tournament } from '@/lib/api';

function resultLine(m: MatchSummary): string {
  if (m.teamBased) {
    const win = m.teams.find((t) => t.isWinner);
    return win ? `${win.name} won` : `${m.teams.length} teams`;
  }
  const winners = m.participants.filter((p) => p.isWinner).map((p) => p.name);
  const who = winners.length ? `Won by ${winners.join(', ')}` : 'No winner';
  return `${who} · ${m.participants.length} players`;
}

const dateOf = (m: MatchSummary) =>
  m.datePlayed ? new Date(m.datePlayed).toLocaleDateString() : '';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

function passesFilters(m: MatchSummary, f: Filters): boolean {
  if (f.gameId && m.gameId !== f.gameId) return false;
  if (f.playerIds.length) {
    const ids = new Set(m.participants.map((p) => p.playerId));
    if (!f.playerIds.every((id) => ids.has(id))) return false;
  }
  if (f.dateOn) {
    if (!m.datePlayed) return false;
    const d = new Date(m.datePlayed);
    if (d < startOfDay(f.from) || d > endOfDay(f.to)) return false;
  }
  return true;
}

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user } = useAuth();
  const { activeGroupId, isActiveGroupAdmin, loading: groupsLoading } = useGroup();

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    if (!activeGroupId) {
      setMatches([]);
      setTournaments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, t] = await Promise.all([getMatches(activeGroupId), getTournaments(activeGroupId)]);
    setMatches(m);
    setTournaments(t);
    setLoading(false);
  }, [activeGroupId]);

  useEffect(() => {
    if (!groupsLoading) load();
  }, [groupsLoading, load]);

  // Options for the filter controls, derived from what's actually in history.
  const gameOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of matches) if (!seen.has(m.gameId)) seen.set(m.gameId, m.gameName);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [matches]);
  const playerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of matches) for (const p of m.participants) if (!seen.has(p.playerId)) seen.set(p.playerId, p.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [matches]);

  const filtered = useMemo(() => {
    const list = matches.filter((m) => passesFilters(m, filters));
    list.sort((a, b) => {
      const ta = a.datePlayed ? new Date(a.datePlayed).getTime() : 0;
      const tb = b.datePlayed ? new Date(b.datePlayed).getTime() : 0;
      return filters.sortDesc ? tb - ta : ta - tb;
    });
    return list;
  }, [matches, filters]);

  const byTournament = useMemo(() => {
    const map = new Map<string, MatchSummary[]>();
    for (const m of filtered) {
      if (m.tournamentId) {
        const arr = map.get(m.tournamentId) ?? [];
        arr.push(m);
        map.set(m.tournamentId, arr);
      }
    }
    return map;
  }, [filtered]);

  const standalone = useMemo(() => filtered.filter((m) => !m.tournamentId), [filtered]);

  // With filters on, only show tournaments that still have matching matches.
  const shownTournaments = useMemo(
    () =>
      tournaments.filter((t) => !filtersActive(filters) || (byTournament.get(t.id)?.length ?? 0) > 0),
    [tournaments, byTournament, filters],
  );

  async function endTour(id: string) {
    await endTournament(id);
    load();
  }

  const empty = matches.length === 0 && tournaments.length === 0;
  const nothingMatches = !empty && filtered.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.headerText} />
        </View>
      ) : !activeGroupId ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>
              Join or create a group in the Group tab to see match history.
            </ThemedText>
          </Card>
        </ScrollView>
      ) : empty ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>
              No matches yet. Record one on the Record tab.
            </ThemedText>
          </Card>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <HistoryFilters
            filters={filters}
            onChange={update}
            onReset={() => setFilters(defaultFilters())}
            games={gameOptions}
            players={playerOptions}
          />

          {nothingMatches && (
            <Card>
              <ThemedText style={styles.message}>No matches match these filters.</ThemedText>
            </Card>
          )}

          {/* Tournaments */}
          {shownTournaments.map((t) => {
            const tMatches = byTournament.get(t.id) ?? [];
            const canManage = (!!t.ownerId && t.ownerId === user?.id) || isActiveGroupAdmin;
            return (
              <Card key={t.id} style={styles.tourCard}>
                <Pressable onPress={() => setSelectedTournament(t)} style={styles.tourHeader}>
                  <View style={styles.rowMain}>
                    <ThemedText style={styles.tourName} numberOfLines={1}>
                      {t.name}
                    </ThemedText>
                    <ThemedText style={styles.result}>
                      {t.status} · {tMatches.length} {tMatches.length === 1 ? 'match' : 'matches'}
                    </ThemedText>
                  </View>
                  {canManage && t.status === 'active' && (
                    <Pressable
                      onPress={() => endTour(t.id)}
                      hitSlop={8}
                      style={[styles.endBtn, { borderColor: theme.primary }]}>
                      <ThemedText style={{ color: theme.primary, fontSize: 13 }}>End</ThemedText>
                    </Pressable>
                  )}
                </Pressable>
                {tMatches.map((m) => (
                  <Pressable key={m.id} onPress={() => setSelectedMatch(m)} style={styles.bulletRow}>
                    <ThemedText style={styles.bullet}>•</ThemedText>
                    <ThemedText style={styles.bulletText} numberOfLines={1}>
                      {m.gameName} — {resultLine(m)}
                    </ThemedText>
                    <ThemedText style={styles.date}>{dateOf(m)}</ThemedText>
                  </Pressable>
                ))}
              </Card>
            );
          })}

          {/* Standalone matches */}
          {standalone.length > 0 && (
            <Card style={[styles.list, shownTournaments.length > 0 && styles.listSpaced]}>
              {standalone.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedMatch(m)}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <View style={styles.rowMain}>
                    <ThemedText style={styles.game} numberOfLines={1}>
                      {m.gameName}
                    </ThemedText>
                    <ThemedText style={styles.result} numberOfLines={1}>
                      {resultLine(m)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.date}>{dateOf(m)}</ThemedText>
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      <MatchDetailModal
        match={selectedMatch}
        currentUserId={user?.id}
        isGroupAdmin={isActiveGroupAdmin}
        onClose={() => setSelectedMatch(null)}
        onChanged={() => {
          setSelectedMatch(null);
          load();
        }}
      />
      <TournamentDetailModal
        tournament={selectedTournament}
        matches={selectedTournament ? byTournament.get(selectedTournament.id) ?? [] : []}
        currentUserId={user?.id}
        isGroupAdmin={isActiveGroupAdmin}
        onClose={() => setSelectedTournament(null)}
        onChanged={() => {
          setSelectedTournament(null);
          load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  centered: { paddingTop: 48, alignItems: 'center' },
  message: { textAlign: 'center' },

  tourCard: { marginBottom: 12 },
  tourHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  tourName: { fontSize: 17, fontWeight: '700' },
  endBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  bullet: { opacity: 0.5 },
  bulletText: { flex: 1, fontSize: 14 },

  list: { padding: 0, overflow: 'hidden' },
  listSpaced: { marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowMain: { flex: 1 },
  game: { fontSize: 16, fontWeight: '600' },
  result: { opacity: 0.65, marginTop: 2, fontSize: 13 },
  date: { opacity: 0.6, fontSize: 13 },
});
