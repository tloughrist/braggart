import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { CompareModal, type ComparePlayer } from '@/components/CompareModal';
import { SearchSelect, type SelectOption } from '@/components/SearchSelect';
import { StatTable, type StatColumn, type StatRow } from '@/components/StatTable';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getGroupStats, getRankingModels, getRankings, type RankingModel, type StatsRow } from '@/lib/api';

const SUMMARY_COLUMNS: StatColumn[] = [
  { key: 'player', label: 'Player', flex: 2.2, width: 140, align: 'left' },
  { key: 'matches', label: '# Matches', width: 84 },
  { key: 'wins', label: '# Wins', width: 72 },
  { key: 'winRate', label: 'Win Rate', width: 84 },
  { key: 'avgDev', label: 'Avg Point Deviation from Winner', flex: 1.8, width: 150 },
];

const rankingColumns = (hasUncertainty: boolean): StatColumn[] => [
  { key: 'rank', label: '#', flex: 0.5, width: 44 },
  { key: 'player', label: 'Player', flex: 2.4, width: 150, align: 'left' },
  { key: 'rating', label: 'Rating', flex: 1, width: 92 },
  ...(hasUncertainty ? [{ key: 'rd', label: '± RD', flex: 0.9, width: 74 } as StatColumn] : []),
];

const fmt = (v: number | string) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v ?? '');
};

const SUMMARY = 'summary';

export default function StatsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { activeGroupId, loading: groupsLoading } = useGroup();

  const [allRows, setAllRows] = useState<StatsRow[]>([]);
  const [games, setGames] = useState<SelectOption[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [models, setModels] = useState<RankingModel[]>([]);
  const [view, setView] = useState<string>(SUMMARY); // SUMMARY or a model key
  const [rankRows, setRankRows] = useState<StatRow[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    getRankingModels().then(setModels);
  }, []);

  useEffect(() => {
    if (groupsLoading) return;
    if (!activeGroupId) {
      setAllRows([]);
      setGames([]);
      setSelectedGameId(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await getGroupStats(activeGroupId);
      if (!active) return;
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      setAllRows(data ?? []);
      const seen = new Set<string>();
      const list: SelectOption[] = [];
      for (const r of data ?? []) {
        if (!seen.has(r.game_id)) {
          seen.add(r.game_id);
          list.push({ id: r.game_id, name: r.game_name });
        }
      }
      setGames(list);
      setSelectedGameId(list[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeGroupId, groupsLoading]);

  // Fetch model-based rankings when a model view is active.
  useEffect(() => {
    if (view === SUMMARY || !activeGroupId || !selectedGameId) {
      setRankRows([]);
      return;
    }
    let active = true;
    setRankLoading(true);
    getRankings(activeGroupId, selectedGameId, view).then((rows) => {
      if (!active) return;
      setRankRows(
        rows.map((r) => ({
          rank: r.rank,
          player: r.display_name ?? '—',
          rating: fmt(r.rating),
          rd: r.uncertainty != null ? `±${fmt(r.uncertainty)}` : '',
        })),
      );
      setRankLoading(false);
    });
    return () => {
      active = false;
    };
  }, [view, activeGroupId, selectedGameId]);

  const summaryRows: StatRow[] = useMemo(
    () =>
      allRows
        .filter((r) => r.game_id === selectedGameId)
        .map((r) => ({
          player: r.display_name ?? '—',
          matches: r.matches,
          wins: r.wins,
          winRate: fmt(r.win_rate),
          avgDev: fmt(r.avg_point_deviation),
        })),
    [allRows, selectedGameId],
  );

  const comparePlayersList: ComparePlayer[] = useMemo(
    () =>
      allRows
        .filter((r) => r.game_id === selectedGameId)
        .map((r) => ({ id: r.player_id, name: r.display_name ?? 'Player' })),
    [allRows, selectedGameId],
  );

  const gameName = games.find((g) => g.id === selectedGameId)?.name ?? null;
  const activeModel = models.find((m) => m.model === view);
  const viewOptions = [{ key: SUMMARY, label: 'Summary' }, ...models.map((m) => ({ key: m.model, label: m.label }))];

  const showBody = !loading && !error && activeGroupId && games.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.headerText} />
        </View>
      ) : error ? (
        <Message theme={theme}>Couldn’t load stats: {error}</Message>
      ) : !activeGroupId ? (
        <Message theme={theme}>Join or create a group in the Group tab to see stats.</Message>
      ) : games.length === 0 ? (
        <Message theme={theme}>
          No stats yet for this group. Record a completed match to see the leaderboard.
        </Message>
      ) : null}

      {showBody && (
        <>
          <View style={styles.controls}>
            <SearchSelect options={games} selectedId={selectedGameId} onSelect={setSelectedGameId} placeholder="Select a game" searchPlaceholder="Search games…" />
            <View style={styles.viewRow}>
              {viewOptions.map((o) => {
                const on = o.key === view;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setView(o.key)}
                    style={[
                      styles.viewPill,
                      on
                        ? { backgroundColor: theme.card, borderColor: theme.card }
                        : { borderColor: 'rgba(255,255,255,0.4)' },
                    ]}>
                    <ThemedText style={{ color: on ? theme.primary : theme.headerText, fontSize: 14 }}>
                      {o.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Card>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                {gameName}
              </ThemedText>
              {view === SUMMARY ? (
                <StatTable columns={SUMMARY_COLUMNS} rows={summaryRows} />
              ) : rankLoading ? (
                <ActivityIndicator color={theme.primary} style={styles.rankLoader} />
              ) : (
                <StatTable columns={rankingColumns(!!activeModel?.has_uncertainty)} rows={rankRows} />
              )}
            </Card>

            {comparePlayersList.length >= 2 && (
              <Pressable
                onPress={() => setCompareOpen(true)}
                style={[styles.compareBtn, { borderColor: theme.headerText }]}>
                <ThemedText style={{ color: theme.headerText }}>Compare two players</ThemedText>
              </Pressable>
            )}
          </ScrollView>

          {activeGroupId && selectedGameId && (
            <CompareModal
              visible={compareOpen}
              onClose={() => setCompareOpen(false)}
              groupId={activeGroupId}
              gameId={selectedGameId}
              gameName={gameName}
              players={comparePlayersList}
            />
          )}
        </>
      )}
    </View>
  );
}

function Message({ children, theme }: { children: React.ReactNode; theme: (typeof Colors)['light'] }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ThemedText style={styles.message}>{children}</ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 10,
  },
  viewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  viewPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  content: { padding: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  centered: { paddingTop: 48, alignItems: 'center' },
  cardTitle: { textAlign: 'center', marginBottom: 14 },
  rankLoader: { marginVertical: 24 },
  message: { textAlign: 'center' },
  compareBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
});
