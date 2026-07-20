import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export type PlayerOption = { id: string; name: string };

type Props = {
  /** Players available to add (already-added ones filtered out by the caller). */
  players: PlayerOption[];
  onSelect: (player: PlayerOption) => void;
};

/**
 * "Add player" button that opens a searchable sheet. Multi-add (adds one player
 * per pick), so it stays separate from the single-select SearchSelect.
 */
export function PlayerPicker({ players, onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
  }, [players, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }
  function choose(p: PlayerOption) {
    onSelect(p);
    close();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.addBtn, { borderColor: theme.primary }]}
        accessibilityRole="button">
        <IconSymbol name="plus" size={20} color={theme.primary} />
        <ThemedText style={{ color: theme.primary }}>Add player</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {}}>
            <View style={[styles.searchRow, { borderColor: theme.border }]}>
              <IconSymbol name="magnifyingglass" size={18} color={theme.muted} />
              <TextInput
                style={[styles.search, { color: theme.text }]}
                placeholder="Search players…"
                placeholderTextColor={theme.muted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <ThemedText style={styles.empty}>
                  {players.length === 0 ? 'Everyone is already added' : 'No players found'}
                </ThemedText>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => choose(item)} style={styles.option}>
                  <ThemedText style={{ color: theme.text }}>{item.name}</ThemedText>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 16 },
  list: { flexShrink: 1 },
  option: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  empty: { textAlign: 'center', padding: 16, opacity: 0.6 },
});
