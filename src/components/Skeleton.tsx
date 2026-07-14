// CLAR — Skeleton-Loader (Runde 6, Paket F.22): Shimmer-Platzhalter fuer
// Karten/Listen, damit Screens beim ersten Render nicht kurz einen leeren
// Null-Zustand (0 Punkte, „noch nichts" o. ae.) zeigen, bevor echte Daten da
// sind. Respektiert „Bewegung reduzieren" (dann ein ruhiger, statischer Ton
// statt Shimmer-Animation).

import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Radius, useThemeColors } from '@/constants/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Einzelner Shimmer-Block (Text-/Bild-Platzhalter). */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: Props) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [reduceMotion, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.6 : 0.4 + pulse.value * 0.3,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.backgroundSelected },
        animStyle,
        style,
      ]}
    />
  );
}

/** Vorgefertigte Zeile aus zwei Zeilen Text (Titel + Untertitel). */
export function SkeletonLine({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.line, style]}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="90%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { gap: 6 },
});
