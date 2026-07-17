import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupSwitcher } from '@/components/GroupSwitcher';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

type Props = {
  /** Optional menu handler; the hamburger renders regardless (drawer wiring is TBD). */
  onMenuPress?: () => void;
  /** Show the active-group switcher below the wordmark. Off for non-group screens. */
  showGroup?: boolean;
};

/**
 * Braggart's brand header: a brick-red band with the hamburger nav and the
 * Fredoka wordmark (cream on red), matching the design mockup.
 */
export function AppHeader({ onMenuPress, showGroup = true }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.primary, paddingTop: insets.top + 8, borderBottomColor: theme.border },
      ]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onMenuPress}
          hitSlop={10}
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel="Open menu">
          <IconSymbol name="line.3.horizontal" size={28} color={theme.headerText} />
        </Pressable>

        <ThemedText style={[styles.brand, { color: theme.headerText, fontFamily: Fonts.brand }]}>
          Braggart
        </ThemedText>

        {/* Spacer balances the menu button so the wordmark stays centered. */}
        <View style={styles.menuButton} />
      </View>

      {showGroup && <GroupSwitcher />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 28,
    lineHeight: 34,
  },
});
