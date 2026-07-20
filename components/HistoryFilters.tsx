import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { DateField } from '@/components/DateField';
import { PlayerPicker, type PlayerOption } from '@/components/PlayerPicker';
import { SearchSelect, type SelectOption } from '@/components/SearchSelect';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export type Filters = {
  gameId: string | null;
  playerIds: string[];
  dateOn: boolean;
  from: Date;
  to: Date;
  sortDesc: boolean;
};

export const defaultFilters = (): Filters => ({
  gameId: null,
  playerIds: [],
  dateOn: false,
  from: new Date(Date.now() - 30 * 86400000),
  to: new Date(),
  sortDesc: true,
});

export const filtersActive = (f: Filters) =>
  !!f.gameId || f.playerIds.length > 0 || f.dateOn;

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  games: SelectOption[];
  players: PlayerOption[];
};

export function HistoryFilters({ filters, onChange, onReset, games, players }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const selectedPlayers = useMemo(
    () => filters.playerIds.map((id) => players.find((p) => p.id === id)).filter(Boolean) as PlayerOption[],
    [filters.playerIds, players],
  );
  const availablePlayers = useMemo(
    () => players.filter((p) => !filters.playerIds.includes(p.id)),
    [filters.playerIds, players],
  );

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.title}>Filter &amp; sort</ThemedText>
        {filtersActive(filters) && (
          <Pressable onPress={onReset} hitSlop={8}>
            <ThemedText type="link">Clear</ThemedText>
          </Pressable>
        )}
      </View>

      <ThemedText style={styles.label}>Game</ThemedText>
      <SearchSelect
        options={games}
        selectedId={filters.gameId}
        onSelect={(id) => onChange({ gameId: id })}
        onClear={() => onChange({ gameId: null })}
        clearLabel="All games"
        searchPlaceholder="Search games…"
      />

      <ThemedText style={styles.label}>Players (matches including all)</ThemedText>
      {selectedPlayers.length > 0 && (
        <View style={styles.chips}>
          {selectedPlayers.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onChange({ playerIds: filters.playerIds.filter((id) => id !== p.id) })}
              style={[styles.chip, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: theme.headerText }}>{p.name}</ThemedText>
              <IconSymbol name="xmark" size={14} color={theme.headerText} />
            </Pressable>
          ))}
        </View>
      )}
      <PlayerPicker
        players={availablePlayers}
        onSelect={(p) => onChange({ playerIds: [...filters.playerIds, p.id] })}
      />

      <View style={styles.dateHeader}>
        <ThemedText style={styles.labelInline}>Date range</ThemedText>
        <Pressable
          onPress={() => onChange({ dateOn: !filters.dateOn })}
          style={[
            styles.toggle,
            filters.dateOn
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { borderColor: theme.border },
          ]}>
          <ThemedText style={{ color: filters.dateOn ? theme.headerText : theme.text, fontSize: 13 }}>
            {filters.dateOn ? 'On' : 'Off'}
          </ThemedText>
        </Pressable>
      </View>
      {filters.dateOn && (
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <ThemedText style={styles.smallLabel}>From</ThemedText>
            <DateField value={filters.from} onChange={(d) => onChange({ from: d })} />
          </View>
          <View style={styles.dateCol}>
            <ThemedText style={styles.smallLabel}>To</ThemedText>
            <DateField value={filters.to} onChange={(d) => onChange({ to: d })} />
          </View>
        </View>
      )}

      <ThemedText style={styles.label}>Sort by date</ThemedText>
      <View style={styles.sortRow}>
        {[
          { on: filters.sortDesc, label: 'Newest first', v: true },
          { on: !filters.sortDesc, label: 'Oldest first', v: false },
        ].map((o) => (
          <Pressable
            key={o.label}
            onPress={() => onChange({ sortDesc: o.v })}
            style={[
              styles.sortPill,
              o.on
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { borderColor: theme.border },
            ]}>
            <ThemedText style={{ color: o.on ? theme.headerText : theme.text, fontSize: 14 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 16 },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  labelInline: { fontWeight: '600' },
  smallLabel: { fontSize: 12, opacity: 0.6, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  toggle: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  dateRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  dateCol: { flex: 1 },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
});
