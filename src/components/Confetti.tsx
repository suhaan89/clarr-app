import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/constants/theme';
import { useSystemReduceMotion } from '@/lib/accessibility';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type PieceParams = {
  startX: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
  /** Index in die Farbpalette (die Palette selbst haengt am Theme). */
  colorIndex: number;
  spin: number;
};

const PALETTE_SIZE = 4;

function makePieces(count: number): PieceParams[] {
  return Array.from({ length: count }, () => ({
    startX: Math.random() * SCREEN_W,
    drift: (Math.random() - 0.5) * 140,
    delay: Math.random() * 400,
    duration: 1600 + Math.random() * 1200,
    size: 7 + Math.random() * 7,
    colorIndex: Math.floor(Math.random() * PALETTE_SIZE),
    spin: (Math.random() - 0.5) * 720,
  }));
}

function ConfettiPiece({ p, color }: { p: PieceParams; color: string }) {
  const progress = useSharedValue(0);

  // Einmaliger Fall beim Mounten (Feier ist ein kurzer Moment, keine Schleife).
  useEffect(() => {
    progress.value = withDelay(
      p.delay,
      withTiming(1, { duration: p.duration, easing: Easing.out(Easing.quad) })
    );
  }, [progress, p.delay, p.duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.startX + p.drift * progress.value },
      { translateY: interpolate(progress.value, [0, 1], [-40, SCREEN_H * 0.9]) },
      { rotate: `${p.spin * progress.value}deg` },
    ],
    opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      style={[
        { width: p.size, height: p.size * 0.6, backgroundColor: color, borderRadius: 2 },
        style,
      ]}
    />
  );
}

/**
 * Kurzer Konfetti-Regen für Feier-Momente (Fallabschluss, Level-up). Läuft auf
 * dem UI-Thread (Reanimated), rein dekorativ und ohne Touch-Blockade.
 * Respektiert „Bewegung reduzieren": dann wird nichts animiert gerendert.
 */
export function Confetti({ count = 80 }: { count?: number }) {
  const colors = useThemeColors();
  // Zwei Signale kombiniert: Reanimateds Hook (schnell, aber liest den Wert
  // nur einmal beim App-Start) UND die live AccessibilityInfo-Abfrage
  // (reagiert auch auf eine waehrend der Sitzung geaenderte OS-Einstellung).
  const reanimatedReduceMotion = useReducedMotion();
  const systemReduceMotion = useSystemReduceMotion();
  const reduceMotion = reanimatedReduceMotion || systemReduceMotion;

  // Zufallswerte einmal beim Mounten wuerfeln (Lazy-Initializer), nicht bei
  // jedem Render: die Feier ist ein einzelner kurzer Moment.
  const [pieces] = useState(() => makePieces(count));
  const palette = [colors.primary, colors.primaryBright, colors.accent, '#FFFFFF'];

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} p={p} color={palette[p.colorIndex]} />
      ))}
    </View>
  );
}
