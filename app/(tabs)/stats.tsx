import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { StatTable, type StatColumn, type StatRow } from '@/components/StatTable';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
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

  const [gameName, setGameName] = useState<string | null>(null);
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('game_player_stats')
        .select('game_id, game_name, display_name, matches, wins, win_rate, avg_point_deviation')
        .order('wins', { ascending: false })
        .order('avg_point_deviation', { ascending: true })
        .returns<StatsRow[]>();
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Show the first game present; a game picker comes later.
      const firstGameId = data?.[0]?.game_id;
      const forGame = (data ?? []).filter((r) => r.game_id === firstGameId);
      setGameName(forGame[0]?.game_name ?? null);
      setRows(
        forGame.map((r) => ({
          player: r.display_name ?? '—',
          matches: r.matches,
          wins: r.wins,
          winRate: fmt(r.win_rate),
          avgDev: fmt(r.avg_point_deviation),
        })),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.headerText} />
          </View>
        ) : error ? (
          <Card>
            <ThemedText style={styles.message}>Couldn’t load stats: {error}</ThemedText>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <ThemedText style={styles.message}>
              No stats yet. Record a completed match to see the leaderboard.
            </ThemedText>
          </Card>
        ) : (
          <Card>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              {gameName}
            </ThemedText>
            <StatTable columns={COLUMNS} rows={rows} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  centered: { paddingTop: 48, alignItems: 'center' },
  cardTitle: { textAlign: 'center', marginBottom: 14 },
  message: { textAlign: 'center' },
});
