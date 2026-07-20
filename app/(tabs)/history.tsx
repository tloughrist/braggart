import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
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

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user } = useAuth();
  const { activeGroupId, loading: groupsLoading } = useGroup();

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

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

  const byTournament = useMemo(() => {
    const map = new Map<string, MatchSummary[]>();
    for (const m of matches) {
      if (m.tournamentId) {
        const arr = map.get(m.tournamentId) ?? [];
        arr.push(m);
        map.set(m.tournamentId, arr);
      }
    }
    return map;
  }, [matches]);

  const standalone = useMemo(() => matches.filter((m) => !m.tournamentId), [matches]);

  async function endTour(id: string) {
    await endTournament(id);
    load();
  }

  const empty = matches.length === 0 && tournaments.length === 0;

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
          {/* Tournaments */}
          {tournaments.map((t) => {
            const tMatches = byTournament.get(t.id) ?? [];
            const isOwner = !!t.ownerId && t.ownerId === user?.id;
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
                  {isOwner && t.status === 'active' && (
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
            <Card style={[styles.list, tournaments.length > 0 && styles.listSpaced]}>
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
