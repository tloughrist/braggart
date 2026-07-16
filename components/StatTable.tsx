import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';

export type StatColumn = {
  key: string;
  label: string;
  /** Flex weight when the table fills the width (wide screens). Default 1. */
  flex?: number;
  /** Fixed width used on compact (phone) screens where the table scrolls. */
  width?: number;
  align?: 'left' | 'center' | 'right';
};

export type StatRow = Record<string, string | number>;

type Props = {
  columns: StatColumn[];
  rows: StatRow[];
};

/**
 * Striped leaderboard table. On wide screens columns flex to fill the card; on
 * phones they take fixed widths and the whole table scrolls horizontally so the
 * cells never get crushed.
 */
export function StatTable({ columns, rows }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { isCompact } = useResponsive();

  const lastKey = columns[columns.length - 1].key;

  const table = (
    <View style={[styles.table, { borderColor: theme.border }, !isCompact && styles.fill]}>
      <View style={[styles.row, { backgroundColor: theme.stripe, borderColor: theme.border }]}>
        {columns.map((col) => (
          <Cell
            key={col.key}
            col={col}
            compact={isCompact}
            borderColor={theme.border}
            last={col.key === lastKey}>
            <ThemedText style={[styles.headerText, { fontFamily: Fonts.brandSemiBold }]}>
              {col.label}
            </ThemedText>
          </Cell>
        ))}
      </View>

      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.row,
            { backgroundColor: i % 2 === 0 ? theme.card : theme.stripe, borderColor: theme.border },
          ]}>
          {columns.map((col) => (
            <Cell
              key={col.key}
              col={col}
              compact={isCompact}
              borderColor={theme.border}
              last={col.key === lastKey}>
              <ThemedText style={styles.cellText}>{String(row[col.key] ?? '')}</ThemedText>
            </Cell>
          ))}
        </View>
      ))}
    </View>
  );

  if (isCompact) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.hscroll}>
        {table}
      </ScrollView>
    );
  }
  return table;
}

function Cell({
  col,
  compact,
  borderColor,
  last,
  children,
}: {
  col: StatColumn;
  compact: boolean;
  borderColor: string;
  last: boolean;
  children: React.ReactNode;
}) {
  const align = col.align ?? 'center';
  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const sizeStyle = compact ? { width: col.width ?? 90 } : { flex: col.flex ?? 1 };
  return (
    <View
      style={[
        styles.cell,
        sizeStyle,
        { alignItems, borderColor, borderRightWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hscroll: { minWidth: '100%' },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fill: { width: '100%' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  cellText: {
    fontSize: 14,
  },
});
