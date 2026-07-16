import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

export type StatColumn = {
  key: string;
  label: string;
  /** Flex weight for this column's width. Default 1. */
  flex?: number;
  align?: 'left' | 'center' | 'right';
};

export type StatRow = Record<string, string | number>;

type Props = {
  columns: StatColumn[];
  rows: StatRow[];
};

/**
 * A striped, bordered leaderboard table (per the mockup): a header row over
 * alternating cream/gray body rows. Column widths are flex-based so it fills
 * the card on wide screens.
 */
export function StatTable({ columns, rows }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  return (
    <View style={[styles.table, { borderColor: theme.border }]}>
      {/* header */}
      <View style={[styles.row, styles.headerRow, { backgroundColor: theme.stripe, borderColor: theme.border }]}>
        {columns.map((col) => (
          <Cell
            key={col.key}
            flex={col.flex}
            align={col.align ?? 'center'}
            borderColor={theme.border}
            last={col.key === columns[columns.length - 1].key}>
            <ThemedText style={[styles.headerText, { fontFamily: Fonts.brandSemiBold }]}>
              {col.label}
            </ThemedText>
          </Cell>
        ))}
      </View>

      {/* body */}
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
              flex={col.flex}
              align={col.align ?? 'center'}
              borderColor={theme.border}
              last={col.key === columns[columns.length - 1].key}>
              <ThemedText style={styles.cellText}>{String(row[col.key] ?? '')}</ThemedText>
            </Cell>
          ))}
        </View>
      ))}
    </View>
  );
}

function Cell({
  children,
  flex = 1,
  align,
  borderColor,
  last,
}: {
  children: React.ReactNode;
  flex?: number;
  align: 'left' | 'center' | 'right';
  borderColor: string;
  last: boolean;
}) {
  const alignItems =
    align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <View
      style={[
        styles.cell,
        { flex, alignItems, borderColor, borderRightWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
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
