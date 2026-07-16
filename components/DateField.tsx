import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type Props = { value: Date; onChange: (d: Date) => void };

/** Native date field: tap to open the platform date picker. */
export function DateField({ value, onChange }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const [show, setShow] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText>{value.toLocaleDateString()}</ThemedText>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={new Date()}
          onChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShow(false);
            if (d) onChange(d);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
