/**
 * CLAR Design-System – zentrale Quelle für Farben, Abstände, Typografie,
 * Radien und Schatten. Screens verwenden NUR diese Tokens, keine festen
 * Hex-Werte. Hell- und Dunkelmodus sind vollständig abgedeckt.
 *
 * Markenidee: „warm & lebendig" – vertrauenswürdig, nicht klinisch.
 *  • GRÜN = Marke, Aktion, Erfolg („Clean"): primäre Buttons, Navigation,
 *    Held-Flächen, erledigte Fälle. Die Leitfarbe, etwas satter/wärmer.
 *  • BERNSTEIN/SAND (accent) = Belohnung & Wärme: Punkte, Level, Datumsblöcke,
 *    Begrüßung. Gibt der App Wärme und trennt Reward klar von Aktion. Nie Status.
 *  • TEAL (water) = nur noch kleiner „Locate"-Akzent auf der Karte.
 * Neutraltöne sind warm (Creme hell, warmes Anthrazit dunkel) – einladend statt
 * kühl. Kein grelles Gamification-Bunt; die App soll wie ein verlässliches,
 * freundliches Werkzeug wirken. Kein KI-Blau/Lila.
 */

import { Platform, useColorScheme, type TextStyle } from 'react-native';

export const Colors = {
  light: {
    // Basis – warme Creme: einladend, nicht klinisch.
    text: '#221E17',
    textSecondary: '#6E6558',
    background: '#FBF7F1',
    backgroundElement: '#F2EBDF',
    backgroundSelected: '#EADFCE',
    border: '#EAE0D0',

    // Marke – Grün: Aktion, Erfolg, Held-Flächen („Clean"). Etwas satter/wärmer.
    primary: '#1C8146',
    onPrimary: '#FFFFFF',
    primarySoft: '#E6F3E9',
    primaryStrong: '#0F5C31',

    // Wasser – Teal: NUR noch kleiner „Locate"-Akzent auf der Karte.
    water: '#0E6E78',
    waterStrong: '#08525A',
    waterSoft: '#DCEEF0',
    waterBright: '#16A3AF',
    onWater: '#FFFFFF',

    // Semantik (warm abgestimmt)
    success: '#1C8146',
    successSoft: '#E6F3E9',
    danger: '#C23A2A',
    dangerSoft: '#FAEAE6',
    onDanger: '#FFFFFF',
    warning: '#9A6B1B',
    warningSoft: '#F7EEDB',

    // Belohnung & Wärme – Bernstein/Sand: Punkte, Level, Datumsblöcke,
    // Begrüßung. Eigene Stimme für Reward, klar getrennt von Aktion. Nie Status.
    accent: '#C0761A',
    accentSoft: '#FBEEDA',
    onAccent: '#FFFFFF',

    // Frischeres Grün für Verläufe/lebendige Flächen (nicht für Text).
    primaryBright: '#37AE60',

    overlay: 'rgba(34, 26, 16, 0.55)',
  },
  dark: {
    // Basis – warmes Anthrazit: gemütlich statt kalt-schwarz.
    text: '#F3EEE6',
    textSecondary: '#ABA193',
    background: '#161311',
    backgroundElement: '#221D19',
    backgroundSelected: '#2D2823',
    border: '#332C26',

    // Marke – Grün.
    primary: '#4FC384',
    onPrimary: '#04220F',
    primarySoft: '#173626',
    primaryStrong: '#8FE0B4',

    // Wasser – Teal (nur Karte), hier heller für dunkle Flächen.
    water: '#35BFCB',
    waterStrong: '#7FE0E7',
    waterSoft: '#0E2E31',
    waterBright: '#4FD0DB',
    onWater: '#04262A',

    // Semantik
    success: '#4FC384',
    successSoft: '#173626',
    danger: '#E5786A',
    dangerSoft: '#3A1B16',
    // Dunkelmodus-Rot ist hell (wie primary/accent/water dort) -> dunkle Schrift/Icon statt Weiss.
    onDanger: '#33110B',
    warning: '#DFAE5B',
    warningSoft: '#33270F',

    // Belohnung & Wärme – Bernstein/Sand, heller für dunkle Flächen.
    accent: '#E8B45E',
    accentSoft: '#352A15',
    onAccent: '#241A05',

    primaryBright: '#43B972',

    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Aktuelle Farbpalette passend zum System-Farbschema. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

/**
 * Sanfte Verläufe für lebendige Flächen (Splash, Home-Held, Melden-CTA).
 * Bewusst dezent – Tiefe und Wärme, kein Regenbogen. Immer als
 * `colors={...}`-Array an `expo-linear-gradient` übergeben.
 */
export const Gradients = {
  light: {
    /** Kräftiger Marken-Verlauf (Grün) für primäre Aufrufe/Held (weiße Schrift). */
    brand: ['#1C8146', '#37AE60'] as const,
    /** Zarter warmer Creme-Wasch hinter weichen Flächen (dunkle Schrift darauf). */
    hero: ['#FDF6EA', '#FBF7F1'] as const,
    /** Wasser-Verlauf – nur „Locate"/Karte (weiße Schrift darauf). */
    water: ['#0E6E78', '#16A3AF'] as const,
  },
  dark: {
    brand: ['#1E7A46', '#2C965A'] as const,
    hero: ['#221D19', '#161311'] as const,
    water: ['#0E6E78', '#188C98'] as const,
  },
} as const;

export type GradientSet = {
  brand: readonly [string, string];
  hero: readonly [string, string];
  water: readonly [string, string];
};

/** Verläufe passend zum System-Farbschema. */
export function useGradients(): GradientSet {
  const scheme = useColorScheme();
  return Gradients[scheme === 'dark' ? 'dark' : 'light'];
}

/**
 * Display-Schrift (Bricolage Grotesque) – die Eigenstimme der Marke. NUR für
 * Wortmarke, Überschriften und Impact-Zahlen; Fließtext bleibt System
 * (beste Lesbarkeit & Performance). Die Namen entsprechen den in
 * `_layout.tsx` via expo-font geladenen Keys. Solange die Schrift lädt (oder
 * auf Plattformen ohne sie), trägt der danebenstehende fontWeight den Fallback.
 */
export const DisplayFont = {
  /** SemiBold (600) – Titel, Abschnittsüberschriften. */
  regular: 'Bricolage-SemiBold',
  /** ExtraBold (800) – Wortmarke, große Zahlen, Display. */
  bold: 'Bricolage-ExtraBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  /** Zwischenschritt zwischen `one` (4) und `two` (8) – z. B. enge Icon+Text-Zeilen. */
  oneHalf: 6,
  two: 8,
  /** Zwischenschritt zwischen `two` (8) und `three` (16) – z. B. Legenden-/Chip-Innenabstand. */
  twoHalf: 10,
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
  display: {
    fontFamily: DisplayFont.bold,
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  title: { fontFamily: DisplayFont.regular, fontSize: 24, fontWeight: '700' as const },
  /** Zwischenschritt zwischen `heading` (17) und `title` (24) – z. B. Home-Held-Label, CTA-Titel. */
  subtitle: { fontFamily: DisplayFont.regular, fontSize: 20, fontWeight: '700' as const },
  heading: { fontFamily: DisplayFont.regular, fontSize: 17, fontWeight: '700' as const },
  /** Große Impact-Zahlen (Punkte, Zähler) – Display-Schrift, tabellarische Ziffern. */
  numeric: {
    fontFamily: DisplayFont.bold,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLarge: { fontSize: 16, lineHeight: 23 },
  /** Sekundäre Meta-Zeile neben Badge/Titel (Datum, Status, „wird geprüft" …). */
  meta: { fontSize: 14, lineHeight: 20 },
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

/**
 * Glas-/Blur-/Highlight-Tokens fuer den „Liquid Glass"-Look (Home). Auf iOS 26+
 * traegt echtes Liquid Glass (expo-glass-effect) die Optik; ueberall sonst
 * greift die gefrostete Fallback-Flaeche (`fallbackBg` + `border` + `highlight`).
 * `*Strong` ist die opakere Variante fuer „Transparenz reduzieren".
 */
export const Glass = {
  light: {
    tint: 'rgba(255,255,255,0.22)',
    fallbackBg: 'rgba(255,255,255,0.55)',
    fallbackBgStrong: 'rgba(255,255,255,0.82)',
    border: 'rgba(255,255,255,0.7)',
    highlight: 'rgba(255,255,255,0.9)',
    blobGreen: 'rgba(55,174,96,0.20)',
    blobAmber: 'rgba(192,118,26,0.16)',
  },
  dark: {
    tint: 'rgba(20,18,16,0.22)',
    fallbackBg: 'rgba(36,31,26,0.5)',
    fallbackBgStrong: 'rgba(36,31,26,0.85)',
    border: 'rgba(255,255,255,0.14)',
    highlight: 'rgba(255,255,255,0.22)',
    blobGreen: 'rgba(79,195,132,0.16)',
    blobAmber: 'rgba(232,180,94,0.14)',
  },
} as const;

/** Sanfter, warmer Hintergrundverlauf des Home (drei Stopps, dezent). */
export const HomeGradient = {
  light: ['#FDF8F0', '#F4EFE6', '#E9F2EC'] as const,
  dark: ['#161311', '#191512', '#111E18'] as const,
};

/** Weicher, groSSflaechiger Schatten fuer schwebende Glas-Elemente. */
export const GlassShadow = Platform.select({
  ios: { shadowColor: '#0B1F12', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
  android: { elevation: 8 },
  default: {},
}) as object;

export function useGlass() {
  const scheme = useColorScheme();
  return Glass[scheme === 'dark' ? 'dark' : 'light'];
}

export function useHomeGradient(): readonly [string, string, string] {
  const scheme = useColorScheme();
  return HomeGradient[scheme === 'dark' ? 'dark' : 'light'];
}

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
