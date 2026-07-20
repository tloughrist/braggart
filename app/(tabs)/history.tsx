import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getMatches, type MatchSummary } from '@/lib/api';

function resultLine(m: MatchSummary): string {
  if (m.teamBased) {
    const win = m.teams.find((t) => t.isWinner);
    return win ? `${win.name} won` : `${m.teams.length} teams`;
  }
  const winners = m.participants.filter((p) => p.isWinner).map((p) => p.name);
  const who = winners.length ? `Won by ${winners.join(', ')}` : 'No winner';
  return `${who} · ${m.participants.length} players`;
}

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user } = useAuth();
  const { activeGroupId, loading: groupsLoading } = useGroup();

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MatchSummary | null>(null);

  const load = useCallback(async () => {
    if (!activeGroupId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMatches(await getMatches(activeGroupId));
    setLoading(false);
  }, [activeGroupId]);

  useEffect(() => {
    if (!groupsLoading) load();
  }, [groupsLoading, load]);

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
      ) : matches.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>
              No matches yet. Record one on the Record tab.
            </ThemedText>
          </Card>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.list}>
            {matches.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => setSelected(m)}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <View style={styles.rowMain}>
                  <ThemedText style={styles.game} numberOfLines={1}>
                    {m.gameName}
                  </ThemedText>
                  <ThemedText style={styles.result} numberOfLines={1}>
                    {resultLine(m)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.date}>
                  {m.datePlayed ? new Date(m.datePlayed).toLocaleDateString() : ''}
                </ThemedText>
              </Pressable>
            ))}
          </Card>
        </ScrollView>
      )}

      <MatchDetailModal
        match={selected}
        currentUserId={user?.id}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
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
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowMain: { flex: 1 },
  game: { fontSize: 16, fontWeight: '600' },
  result: { opacity: 0.65, marginTop: 2, fontSize: 13 },
  date: { opacity: 0.6, fontSize: 13 },
});
