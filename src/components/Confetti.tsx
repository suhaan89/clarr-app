import { useEffect, useMemo } from 'react';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type PieceParams = {
  startX: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  spin: number;
};

function ConfettiPiece({ p }: { p: PieceParams }) {
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
        { width: p.size, height: p.size * 0.6, backgroundColor: p.color, borderRadius: 2 },
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
  const reduceMotion = useReducedMotion();

  const pieces = useMemo<PieceParams[]>(() => {
    const palette = [colors.primary, colors.primaryBright, colors.accent, '#FFFFFF'];
    return Array.from({ length: count }, () => ({
      startX: Math.random() * SCREEN_W,
      drift: (Math.random() - 0.5) * 140,
      delay: Math.random() * 400,
      duration: 1600 + Math.random() * 1200,
      size: 7 + Math.random() * 7,
      color: palette[Math.floor(Math.random() * palette.length)],
      spin: (Math.random() - 0.5) * 720,
    }));
  }, [count, colors.primary, colors.primaryBright, colors.accent]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} p={p} />
      ))}
    </View>
  );
}
