import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { comparePlayers, type PlayerComparison } from '@/lib/api';

export type ComparePlayer = { id: string; name: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  gameId: string;
  gameName: string | null;
  players: ComparePlayer[];
};

const pct = (v: number | string) => `${Math.round(Number(v) * 100)}%`;
const num = (v: number | string) => String(Number(v));

/** Pick two players and show the networked comparison (rating, win prob, connectivity). */
export function CompareModal({ visible, onClose, groupId, gameId, gameName, players }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [result, setResult] = useState<PlayerComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setA(null);
      setB(null);
      setResult(null);
      setError(null);
    }
  }, [visible]);

  async function run() {
    if (!a || !b || a === b) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error } = await comparePlayers(groupId, gameId, a, b);
    setLoading(false);
    if (error) setError(error);
    else setResult(data);
  }

  const canCompare = !!a && !!b && a !== b;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" style={styles.title}>
              Compare players{gameName ? ` — ${gameName}` : ''}
            </ThemedText>

            <ThemedText style={styles.label}>Player A</ThemedText>
            <ChipRow players={players} selected={a} disabled={b} onSelect={setA} theme={theme} />
            <ThemedText style={styles.label}>Player B</ThemedText>
            <ChipRow players={players} selected={b} disabled={a} onSelect={setB} theme={theme} />

            <Pressable
              onPress={run}
              disabled={!canCompare || loading}
              style={[styles.button, { backgroundColor: theme.primary }, (!canCompare || loading) && styles.disabled]}>
              {loading ? (
                <ActivityIndicator color={theme.headerText} />
              ) : (
                <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>Compare</ThemedText>
              )}
            </Pressable>

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {result && (
              <View style={[styles.result, { borderColor: theme.border }]}>
                <View style={styles.vsRow}>
                  <View style={styles.side}>
                    <ThemedText style={styles.name} numberOfLines={1}>{result.name_a}</ThemedText>
                    <ThemedText style={[styles.rating, { color: theme.primary }]}>{num(result.rating_a)}</ThemedText>
                    <ThemedText style={styles.muted}>±{num(result.rd_a)}</ThemedText>
                  </View>
                  <ThemedText style={styles.vs}>vs</ThemedText>
                  <View style={styles.side}>
                    <ThemedText style={styles.name} numberOfLines={1}>{result.name_b}</ThemedText>
                    <ThemedText style={[styles.rating, { color: theme.primary }]}>{num(result.rating_b)}</ThemedText>
                    <ThemedText style={styles.muted}>±{num(result.rd_b)}</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.headline}>
                  {result.name_a} wins {pct(result.win_prob_a)}
                </ThemedText>

                <ThemedText style={styles.detail}>
                  {result.played_directly
                    ? 'Played directly'
                    : result.connection_depth == null
                      ? 'Not connected in this group'
                      : `Never played directly · connected at depth ${result.connection_depth}` +
                        (result.shared_opponents.length
                          ? ` via ${result.shared_opponents.join(', ')}`
                          : '')}
                </ThemedText>
                <ThemedText style={styles.detail}>
                  Confidence: {pct(result.confidence)}
                </ThemedText>
              </View>
            )}

            <Pressable onPress={onClose} style={styles.close}>
              <ThemedText type="link">Close</ThemedText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChipRow({
  players,
  selected,
  disabled,
  onSelect,
  theme,
}: {
  players: ComparePlayer[];
  selected: string | null;
  disabled: string | null;
  onSelect: (id: string) => void;
  theme: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.chips}>
      {players.map((p) => {
        const isSelected = p.id === selected;
        const isDisabled = p.id === disabled;
        return (
          <Pressable
            key={p.id}
            disabled={isDisabled}
            onPress={() => onSelect(p.id)}
            style={[
              styles.chip,
              { borderColor: theme.border },
              isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
              isDisabled && styles.chipDisabled,
            ]}>
            <ThemedText style={{ color: isSelected ? theme.headerText : theme.text }} numberOfLines={1}>
              {p.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  title: { marginBottom: 8 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDisabled: { opacity: 0.35 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { color: '#e5484d', textAlign: 'center', marginTop: 12 },
  result: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { flex: 1, alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  rating: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  muted: { opacity: 0.6, fontSize: 12 },
  vs: { paddingHorizontal: 8, opacity: 0.6 },
  headline: { textAlign: 'center', fontSize: 17, fontWeight: '600', marginTop: 14 },
  detail: { textAlign: 'center', opacity: 0.75, marginTop: 6, fontSize: 13 },
  close: { alignItems: 'center', marginTop: 16 },
});
