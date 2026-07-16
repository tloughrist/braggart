import { createElement } from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type Props = { value: Date; onChange: (d: Date) => void };

// Local YYYY-MM-DD (avoids the UTC shift toISOString would introduce).
function toYMD(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Web date field: a native <input type="date">. */
export function DateField({ value, onChange }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  return createElement('input', {
    type: 'date',
    value: toYMD(value),
    max: toYMD(new Date()),
    onChange: (e: any) => {
      const v = e.target.value;
      if (v) onChange(new Date(v + 'T12:00:00')); // noon local to dodge TZ edges
    },
    style: {
      backgroundColor: theme.card,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      fontSize: 16,
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
    },
  });
}
