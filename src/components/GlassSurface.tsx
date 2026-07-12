import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GlassShadow, Radius, useGlass } from '@/constants/theme';

/** iOS „Transparenz reduzieren": dann opakere Flaechen fuer Lesbarkeit. */
function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => alive && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v: boolean) =>
      setReduce(!!v)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Innenabstand-freie Flaeche; Radius Standard xl. */
  radius?: number;
  /** Kraeftigeres Highlight fuer die zentrale Aktion (Melden-Knopf). */
  intense?: boolean;
};

/**
 * Schwebende „Liquid Glass"-Flaeche. Auf iOS 26+ (und ohne „Transparenz
 * reduzieren") traegt echtes Liquid Glass (expo-glass-effect) den Effekt;
 * ueberall sonst eine gefrostete, transluzente Flaeche mit feinem Rand und
 * einem wandernden Licht-Highlight an der Oberkante. Weicher Schatten gibt
 * Tiefe. Reine Praesentation, keine Logik.
 */
export function GlassSurface({ children, style, radius = Radius.xl, intense = false }: Props) {
  const glass = useGlass();
  const reduceTransparency = useReduceTransparency();
  const liquid = isLiquidGlassAvailable() && !reduceTransparency;

  // Feiner Lichtsaum an Ober- und linker Kante (auf Glas wie auf Fallback).
  const edge = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[glass.highlight, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { opacity: intense ? 0.6 : 0.4 }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.border }]}
      />
    </>
  );

  if (liquid) {
    return (
      <View style={[{ borderRadius: radius }, GlassShadow, style]}>
        <GlassView
          glassEffectStyle="regular"
          tintColor={glass.tint}
          style={[styles.clip, { borderRadius: radius }]}>
          {edge}
          {children}
        </GlassView>
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: radius }, GlassShadow, style]}>
      <View
        style={[
          styles.clip,
          { borderRadius: radius, backgroundColor: reduceTransparency ? glass.fallbackBgStrong : glass.fallbackBg },
        ]}>
        {edge}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
