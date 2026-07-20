import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { endTournament, renameTournament, type MatchSummary, type Tournament } from '@/lib/api';

type Props = {
  tournament: Tournament | null;
  matches: MatchSummary[]; // the tournament's matches (for standings)
  currentUserId: string | undefined;
  onClose: () => void;
  onChanged: () => void;
};

type Standing = { name: string; wins: number; played: number };

function computeStandings(matches: MatchSummary[]): Standing[] {
  const map = new Map<string, Standing>();
  for (const m of matches) {
    for (const p of m.participants) {
      const e = map.get(p.playerId) ?? { name: p.name, wins: 0, played: 0 };
      e.played += 1;
      if (p.isWinner) e.wins += 1;
      map.set(p.playerId, e);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name),
  );
}

export function TournamentDetailModal({
  tournament,
  matches,
  currentUserId,
  onClose,
  onChanged,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setError(null);
    }
  }, [tournament]);

  if (!tournament) return null;

  const isOwner = !!tournament.ownerId && tournament.ownerId === currentUserId;
  const standings = computeStandings(matches);

  async function saveName() {
    if (!tournament || !name.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await renameTournament(tournament.id, name.trim());
    setBusy(false);
    if (error) setError(error);
    else onChanged();
  }

  async function end() {
    if (!tournament) return;
    setBusy(true);
    setError(null);
    const { error } = await endTournament(tournament.id);
    setBusy(false);
    if (error) setError(error);
    else onChanged();
  }

  return (
    <Modal visible={!!tournament} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="subtitle">{tournament.name}</ThemedText>
              <ThemedText style={[styles.status, { color: theme.muted }]}>
                {tournament.status}
              </ThemedText>
            </View>

            <ThemedText style={styles.section}>Standings</ThemedText>
            {standings.length === 0 ? (
              <ThemedText style={styles.muted}>No matches in this tournament yet.</ThemedText>
            ) : (
              standings.map((s, i) => (
                <View key={s.name + i} style={styles.row}>
                  <ThemedText style={styles.rank}>{i + 1}</ThemedText>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {s.name}
                  </ThemedText>
                  <ThemedText style={styles.wins}>
                    {s.wins} {s.wins === 1 ? 'win' : 'wins'} · {s.played} played
                  </ThemedText>
                </View>
              ))
            )}

            {isOwner && (
              <>
                <ThemedText style={styles.section}>Manage</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tournament name"
                  placeholderTextColor={theme.muted}
                />
                <Pressable
                  onPress={saveName}
                  disabled={busy || !name.trim()}
                  style={[styles.button, { backgroundColor: theme.primary }, (busy || !name.trim()) && styles.disabled]}>
                  <ThemedText style={{ color: theme.headerText, fontWeight: '600' }}>Save name</ThemedText>
                </Pressable>
                {tournament.status === 'active' && (
                  <Pressable
                    onPress={end}
                    disabled={busy}
                    style={[styles.endButton, { borderColor: theme.primary }]}>
                    <ThemedText style={{ color: theme.primary }}>End tournament</ThemedText>
                  </Pressable>
                )}
              </>
            )}

            {busy && <ActivityIndicator color={theme.primary} style={styles.loader} />}
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            <Pressable onPress={onClose} style={styles.close}>
              <ThemedText type="link">Close</ThemedText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 },
  section: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  muted: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  rank: { width: 24, textAlign: 'center', opacity: 0.6 },
  name: { flex: 1, fontSize: 16 },
  wins: { opacity: 0.75, fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  endButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabled: { opacity: 0.5 },
  loader: { marginTop: 12 },
  error: { color: '#e5484d', textAlign: 'center', marginTop: 12 },
  close: { alignItems: 'center', marginTop: 16 },
});
