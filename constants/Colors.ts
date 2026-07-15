/**
 * Braggart brand palette — a warm tabletop identity:
 *   parchment/cream surfaces, brick-red primary, coral accent.
 * Derived from the design mockup (dice logo + brick header + cream stat cards).
 *
 * The keys used by the Expo template's themed components
 * (text, background, tint, icon, tabIconDefault, tabIconSelected) are kept so
 * existing screens re-theme automatically. Extra brand tokens (primary, accent,
 * card, surface, border, stripe, headerText, muted) are for Braggart's own UI.
 *
 * The mockup is light-only; the dark palette keeps the same identity with a
 * deep espresso ground and brightened red/coral for contrast.
 */

const brick = '#9B2D2D'; // primary — header band, CTAs
const brickBright = '#B23A3A'; // primary on dark
const coral = '#D2604F'; // accent — dice, outlines, links
const coralBright = '#E07A67'; // accent on dark
const cream = '#F4E6CF'; // page background
const parchment = '#FAF1E1'; // raised cards / surfaces

export const Colors = {
  light: {
    text: '#241C17',
    background: cream,
    tint: brick,
    icon: '#7A5E4A',
    tabIconDefault: '#A98F76',
    tabIconSelected: brick,

    // brand tokens
    primary: brick,
    accent: coral,
    card: parchment,
    surface: parchment,
    border: '#D9C3A5',
    stripe: '#ECEAE6', // alternating table row
    headerText: cream, // text on the brick header band
    muted: '#7A5E4A',
  },
  dark: {
    text: '#F1E5D4',
    background: '#1C1512',
    tint: coralBright,
    icon: '#B79E86',
    tabIconDefault: '#B79E86',
    tabIconSelected: coralBright,

    // brand tokens
    primary: brickBright,
    accent: coralBright,
    card: '#2A211C',
    surface: '#241D18',
    border: '#3A2F28',
    stripe: '#241D18',
    headerText: '#F1E5D4',
    muted: '#B79E86',
  },
};
