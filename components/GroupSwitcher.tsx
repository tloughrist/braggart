import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Compact pill in the header showing the active group, with a modal to switch.
 * Renders nothing until groups have loaded; shows a muted hint if you're in none.
 */
export function GroupSwitcher() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { groups, activeGroup, activeGroupId, setActiveGroupId, loading } = useGroup();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  if (groups.length === 0) {
    return (
      <ThemedText style={[styles.emptyLabel, { color: theme.headerText }]}>
        No group — create one in the Group tab
      </ThemedText>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.pill, { backgroundColor: theme.card }]}
        accessibilityRole="button"
        accessibilityLabel="Switch group">
        <IconSymbol name="person.2.fill" size={16} color={theme.primary} />
        <ThemedText style={[styles.pillText, { color: theme.primary }]} numberOfLines={1}>
          {activeGroup?.name ?? 'Select group'}
        </ThemedText>
        <IconSymbol name="chevron.down" size={18} color={theme.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {}}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              Your groups
            </ThemedText>
            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isActive = item.id === activeGroupId;
                return (
                  <Pressable
                    onPress={() => {
                      setActiveGroupId(item.id);
                      setOpen(false);
                    }}
                    style={styles.option}>
                    <ThemedText style={{ color: isActive ? theme.primary : theme.text }}>
                      {item.name}
                    </ThemedText>
                    {isActive && <IconSymbol name="checkmark" size={18} color={theme.primary} />}
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 14, flexShrink: 1 },
  emptyLabel: { textAlign: 'center', fontSize: 13, opacity: 0.85 },
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
    maxHeight: '70%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  sheetTitle: { marginBottom: 8 },
  list: { flexShrink: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});
