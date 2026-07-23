import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupSwitcher } from '@/components/GroupSwitcher';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

type Props = {
  /** Show the active-group switcher below the wordmark. Off for non-group screens. */
  showGroup?: boolean;
};

/**
 * Braggart's brand header: a brick-red band with the Fredoka wordmark
 * (cream on red), matching the design mockup.
 */
export function AppHeader({ showGroup = true }: Props) {
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
        <ThemedText style={[styles.brand, { color: theme.headerText, fontFamily: Fonts.brand }]}>
          Braggart
        </ThemedText>
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
    justifyContent: 'center',
  },
  brand: {
    fontSize: 28,
    lineHeight: 34,
  },
});
