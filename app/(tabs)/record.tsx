import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { GameSelect, type GameOption } from '@/components/GameSelect';
import { PlayerPicker, type PlayerOption } from '@/components/PlayerPicker';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

type Entry = { player: PlayerOption; score: string };

export default function RecordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { activeGroupId, activeGroup, loading: groupsLoading } = useGroup();

  const [games, setGames] = useState<GameOption[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [gameId, setGameId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (groupsLoading) return;
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    // Players are scoped to the active group's members.
    (async () => {
      const [g, m] = await Promise.all([
        supabase.from('games').select('id, name').order('name'),
        supabase
          .from('player_groups')
          .select('player:players(id, display_name, username)')
          .eq('group_id', activeGroupId)
          .eq('status', 'active'),
      ]);
      if (!active) return;
      setGames((g.data ?? []).map((x) => ({ id: x.id as string, name: x.name as string })));
      setPlayers(
        (m.data ?? [])
          .map((r: any) => (Array.isArray(r.player) ? r.player[0] : r.player))
          .filter(Boolean)
          .map((x: any) => ({
            id: x.id as string,
            name: (x.display_name as string) || (x.username as string) || 'Player',
          })),
      );
      // reset the in-progress form when the group changes
      setEntries([]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeGroupId, groupsLoading]);

  const availablePlayers = useMemo(() => {
    const taken = new Set(entries.map((e) => e.player.id));
    return players.filter((p) => !taken.has(p.id));
  }, [players, entries]);

  const canSave =
    !!gameId &&
    entries.length >= 2 &&
    entries.every((e) => e.score.trim() !== '' && Number.isFinite(Number(e.score)));

  function addPlayer(p: PlayerOption) {
    setEntries((prev) => [...prev, { player: p, score: '' }]);
    setMessage(null);
  }
  function setScore(id: string, score: string) {
    setEntries((prev) => prev.map((e) => (e.player.id === id ? { ...e, score } : e)));
  }
  function removePlayer(id: string) {
    setEntries((prev) => prev.filter((e) => e.player.id !== id));
  }

  async function save() {
    if (!canSave || !gameId) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('create_match', {
      p_game_id: gameId,
      p_group_id: activeGroupId,
      p_date: new Date().toISOString(),
      p_players: entries.map((e) => ({ player_id: e.player.id, score: Number(e.score) })),
    });
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Match recorded!' });
    setGameId(null);
    setEntries([]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="subtitle" style={styles.title}>
            Record a match
          </ThemedText>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : !activeGroupId ? (
            <ThemedText style={styles.hint}>
              Join or create a group in the Group tab before recording a match.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={styles.label}>Game</ThemedText>
              <GameSelect games={games} selectedId={gameId} onSelect={setGameId} />

              <ThemedText style={styles.label}>Players &amp; scores</ThemedText>
              <ThemedText style={styles.hint}>
                Add at least two players. The winner is set automatically from the scores.
              </ThemedText>

              {entries.map((e) => (
                <View key={e.player.id} style={styles.playerRow}>
                  <ThemedText style={styles.playerName} numberOfLines={1}>
                    {e.player.name}
                  </ThemedText>
                  <TextInput
                    style={[styles.scoreInput, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Score"
                    placeholderTextColor={theme.muted}
                    keyboardType="number-pad"
                    value={e.score}
                    onChangeText={(t) => setScore(e.player.id, t)}
                  />
                  <Pressable onPress={() => removePlayer(e.player.id)} hitSlop={8} style={styles.remove}>
                    <IconSymbol name="xmark" size={20} color={theme.muted} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.addWrap}>
                <PlayerPicker players={availablePlayers} onSelect={addPlayer} />
              </View>

              {message && (
                <ThemedText
                  style={[
                    styles.message,
                    { color: message.type === 'error' ? '#e5484d' : theme.primary },
                  ]}>
                  {message.text}
                </ThemedText>
              )}

              <Pressable
                onPress={save}
                disabled={!canSave || saving}
                style={[
                  styles.save,
                  { backgroundColor: theme.primary },
                  (!canSave || saving) && styles.saveDisabled,
                ]}>
                {saving ? (
                  <ActivityIndicator color={theme.headerText} />
                ) : (
                  <ThemedText style={[styles.saveText, { color: theme.headerText }]}>
                    Save match
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { textAlign: 'center', marginBottom: 8 },
  loader: { marginVertical: 24 },
  label: { marginTop: 16, marginBottom: 6, fontWeight: '600' },
  hint: { opacity: 0.6, marginBottom: 10, fontSize: 13 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  playerName: { flex: 1, fontSize: 16 },
  scoreInput: {
    width: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  remove: { padding: 2 },
  addWrap: { marginTop: 4 },
  message: { textAlign: 'center', marginTop: 14 },
  save: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontSize: 16, fontWeight: '600' },
});
