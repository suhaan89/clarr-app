import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radius, useThemeColors } from '@/constants/theme';

type Props = {
  /** Fortschritt 0 .. 1. Wird bei Aenderung weich animiert. */
  fraction: number;
  /** Balkenhoehe (Standard 10). */
  height?: number;
  /** Fuellfarben als Verlauf; Standard ist der Marken-Verlauf (Gruen). */
  fillColors?: readonly [string, string];
  /** Einfarbige Fuellung statt Verlauf (uebersteuert fillColors). */
  fillColor?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Beschreibung fuer Screenreader (z. B. "Wochenziel: 12 von 20 Fällen"). */
  accessibilityLabel?: string;
};

/**
 * Schlanker, animierter Fortschrittsbalken (UI-Thread via Reanimated). Wird
 * fuer Level-Fortschritt und Gemeinschafts-Challenge genutzt. Respektiert die
 * System-Einstellung „Bewegung reduzieren": dann springt der Balken direkt auf
 * den Zielwert statt zu animieren.
 */
export function ProgressBar({
  fraction,
  height = 10,
  fillColors,
  fillColor,
  trackColor,
  style,
  accessibilityLabel,
}: Props) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);

  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  useEffect(() => {
    progress.value = reduceMotion
      ? clamped
      : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduceMotion, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth * progress.value }));

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  const gradient = fillColors ?? [colors.primary, colors.primaryBright];

  return (
    <View
      onLayout={onLayout}
      // Eigene Rolle/Wert, damit auch eine freistehende ProgressBar (ohne
      // umschliessendes accessibility-Element wie LevelProgress) fuer
      // Screenreader verstaendlich ist.
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.backgroundSelected },
        style,
      ]}>
      <Animated.View style={[styles.fill, { height, borderRadius: height / 2 }, fillStyle]}>
        {fillColor ? (
          <View style={[styles.fillInner, { width: trackWidth, backgroundColor: fillColor }]} />
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fillInner, { width: trackWidth }]}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { overflow: 'hidden' },
  fillInner: { flex: 1, borderRadius: Radius.pill },
});
