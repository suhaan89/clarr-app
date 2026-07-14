import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Gradients, Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

/**
 * Hochwertiger Marken-Splash beim Kaltstart: Logo-Kachel steigt sanft auf,
 * ein weicher Ring pulsiert dahinter, Wortmarke + kurzer Ladetext. Nach ~1,9 s
 * blendet er aus und ruft `onFinish`. Rein dekorativ, keine Logik, kein Warten
 * auf Netzwerk – der erste Eindruck soll ruhig und wertig sein.
 */
export function BrandSplash({ onFinish }: { onFinish: () => void }) {
  const scheme = useColorScheme();
  const { t } = useI18n();
  const grad = Gradients[scheme === 'dark' ? 'dark' : 'light'];

  const container = useSharedValue(1);
  const logo = useSharedValue(0);
  const ring = useSharedValue(0);
  const text = useSharedValue(0);

  useEffect(() => {
    // Auftritt: Logo skaliert/fadet ein, Text folgt kurz danach.
    logo.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    text.value = withDelay(360, withTiming(1, { duration: 460 }));
    // Ruhiger Puls des Rings (Leben, ohne Unruhe).
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    // Nach kurzer Standzeit ausblenden und Kontrolle abgeben.
    container.value = withDelay(
      1550,
      withTiming(0, { duration: 360, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onFinish)();
      })
    );
  }, [container, logo, ring, text, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: container.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: 0.82 + logo.value * 0.18 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 0.5 }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 8 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.fill, containerStyle]}
      accessibilityRole="image"
      accessibilityLabel="CLAR">
      <LinearGradient
        colors={grad.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.logoTile, logoStyle]}>
            {/* Logo-Kachel ist bewusst immer weiss (beide Modi) — daher fest
                Colors.light.primary statt des theme-abhaengigen Gruens, das
                im Dunkelmodus fuer dunkle Flaechen aufgehellt ist und auf
                Weiss zu blass waere. Vorher stand hier abweichend "#1B7A43"
                (Runde 7, Design-Audit: zwei leicht unterschiedliche Gruens). */}
            <Ionicons name="leaf" size={52} color={Colors.light.primary} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.copy, textStyle]}>
          <Text style={styles.wordmark} allowFontScaling>
            CLAR
          </Text>
          <Text style={styles.tagline} allowFontScaling accessibilityLiveRegion="polite">
            {t('splash.tagline')}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { zIndex: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  logoWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
  },
  logoTile: {
    width: 104,
    height: 104,
    borderRadius: Radius.xl + 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // Weiche Tiefe unter dem Logo.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  copy: { alignItems: 'center', gap: Spacing.two },
  wordmark: {
    ...Type.display,
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  tagline: { ...Type.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
});
