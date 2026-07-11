/**
 * CLAR Design-System — zentrale Quelle für Farben, Abstände, Typografie,
 * Radien und Schatten. Screens verwenden NUR diese Tokens, keine festen
 * Hex-Werte. Hell- und Dunkelmodus sind vollständig abgedeckt.
 *
 * Markenidee: „Vertrauensgrün" — ruhig, seriös, naturnah. Kein grelles
 * Gamification-Bunt; die App soll wie ein verlässliches Werkzeug wirken.
 */

import '@/global.css';

import { Platform, useColorScheme } from 'react-native';

export const Colors = {
  light: {
    // Basis
    text: '#171D19',
    textSecondary: '#5C665F',
    background: '#FAFBF9',
    backgroundElement: '#F0F3F0',
    backgroundSelected: '#E2E7E2',
    border: '#E2E7E2',

    // Marke
    primary: '#1B7A43',
    onPrimary: '#FFFFFF',
    primarySoft: '#E5F2EA',
    primaryStrong: '#0E5A2F',

    // Semantik
    success: '#1B7A43',
    successSoft: '#E5F2EA',
    danger: '#B3362A',
    dangerSoft: '#F9EBE8',
    warning: '#9A6B1B',
    warningSoft: '#F8F0DF',

    overlay: 'rgba(23, 29, 25, 0.55)',
  },
  dark: {
    // Basis
    text: '#F1F4F1',
    textSecondary: '#A6B1A9',
    background: '#0E120F',
    backgroundElement: '#1A211C',
    backgroundSelected: '#252E27',
    border: '#2A332C',

    // Marke
    primary: '#4CC183',
    onPrimary: '#04220F',
    primarySoft: '#153524',
    primaryStrong: '#8FE0B4',

    // Semantik
    success: '#4CC183',
    successSoft: '#153524',
    danger: '#E5786A',
    dangerSoft: '#3A1B16',
    warning: '#DFAE5B',
    warningSoft: '#33270F',

    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Aktuelle Farbpalette passend zum System-Farbschema. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Typo-Skala. Immer mit `allowFontScaling` (Standard) verwenden, damit
 * Systemschriftgrößen respektiert werden.
 */
export const Type = {
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLarge: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 12, lineHeight: 17 },
} as const;

/** Dezente Karten-Schatten; im Dunkelmodus trägt die Flächenfarbe. */
export const Shadow = Platform.select({
  ios: {
    shadowColor: '#101511',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
}) as object;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
