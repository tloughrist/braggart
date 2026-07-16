import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export type GameOption = { id: string; name: string };

type Props = {
  games: GameOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * A searchable game select: tap to open a sheet, type to filter, pick one.
 * Scales to large libraries (hundreds of games) where a chip row wouldn't.
 */
export function GameSelect({ games, selectedId, onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = games.find((g) => g.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.name.toLowerCase().includes(q));
  }, [games, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(id: string) {
    onSelect(id);
    close();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: theme.card, borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel="Select game">
        <ThemedText style={styles.triggerText} numberOfLines={1}>
          {selected?.name ?? 'Select a game'}
        </ThemedText>
        <IconSymbol name="chevron.down" size={22} color={theme.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* backdrop closes; the sheet absorbs taps so it stays open */}
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {}}>
            <View style={[styles.searchRow, { borderColor: theme.border }]}>
              <IconSymbol name="magnifyingglass" size={18} color={theme.muted} />
              <TextInput
                style={[styles.search, { color: theme.text }]}
                placeholder="Search games…"
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
              keyExtractor={(g) => g.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<ThemedText style={styles.empty}>No games found</ThemedText>}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <Pressable
                    onPress={() => choose(item.id)}
                    style={[styles.option, isSelected && { backgroundColor: theme.stripe }]}>
                    <ThemedText style={{ color: isSelected ? theme.primary : theme.text }}>
                      {item.name}
                    </ThemedText>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerText: { flex: 1, marginRight: 8, fontSize: 16 },
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
