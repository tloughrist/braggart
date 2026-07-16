import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { GameSelect, type GameOption } from '@/components/GameSelect';
import { StatTable, type StatColumn, type StatRow } from '@/components/StatTable';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

const COLUMNS: StatColumn[] = [
  { key: 'player', label: 'Player', flex: 2.2, align: 'left' },
  { key: 'matches', label: '# Matches' },
  { key: 'wins', label: '# Wins' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'avgDev', label: 'Avg Point Deviation from Winner', flex: 1.8 },
];

type StatsRow = {
  game_id: string;
  game_name: string;
  display_name: string | null;
  matches: number;
  wins: number;
  win_rate: number | string;
  avg_point_deviation: number | string;
};

// Trim trailing zeros for display: 0.00 → "0", 49.00 → "49", 10.33 → "10.33".
const fmt = (v: number | string) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v ?? '');
};

export default function StatsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { activeGroupId, loading: groupsLoading } = useGroup();

  const [allRows, setAllRows] = useState<StatsRow[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const { data, error } = await supabase
        .from('game_player_stats')
        .select('game_id, game_name, display_name, matches, wins, win_rate, avg_point_deviation')
        .eq('group_id', activeGroupId)
        .order('game_name', { ascending: true })
        .order('wins', { ascending: false })
        .order('avg_point_deviation', { ascending: true })
        .returns<StatsRow[]>();
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setAllRows(data ?? []);

      // Distinct games, in the order they appear (already sorted by name).
      const seen = new Set<string>();
      const list: GameOption[] = [];
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

  const tableRows: StatRow[] = useMemo(
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

  const gameName = games.find((g) => g.id === selectedGameId)?.name ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.headerText} />
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>Couldn’t load stats: {error}</ThemedText>
          </Card>
        </ScrollView>
      ) : !activeGroupId ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>
              Join or create a group in the Group tab to see stats.
            </ThemedText>
          </Card>
        </ScrollView>
      ) : games.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText style={styles.message}>
              No stats yet for this group. Record a completed match to see the leaderboard.
            </ThemedText>
          </Card>
        </ScrollView>
      ) : (
        <>
          <View style={styles.controls}>
            <GameSelect games={games} selectedId={selectedGameId} onSelect={setSelectedGameId} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Card>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                {gameName}
              </ThemedText>
              <StatTable columns={COLUMNS} rows={tableRows} />
            </Card>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  content: { padding: 16 },
  centered: { paddingTop: 48, alignItems: 'center' },
  cardTitle: { textAlign: 'center', marginBottom: 14 },
  message: { textAlign: 'center' },
});
