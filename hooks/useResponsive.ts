import { useWindowDimensions } from 'react-native';

import { Breakpoints } from '@/constants/layout';

/**
 * Central place to branch layout on screen size. `isCompact` is true on phones;
 * use it to switch between phone and wider-screen layouts.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isCompact: width < Breakpoints.compact,
  };
}
