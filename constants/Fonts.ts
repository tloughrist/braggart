/**
 * Braggart typography. The rounded Fredoka family is the brand/display face
 * (wordmark + headings). Font family strings must match the keys the fonts are
 * registered under in the root layout's useFonts() call.
 *
 * With per-weight font files you set `fontFamily` (the weight is baked in) —
 * don't also rely on `fontWeight`.
 */
export const Fonts = {
  brand: 'Fredoka_700Bold', // wordmark, screen titles
  brandSemiBold: 'Fredoka_600SemiBold', // subtitles, section headers
  brandMedium: 'Fredoka_500Medium', // emphasized labels
} as const;
