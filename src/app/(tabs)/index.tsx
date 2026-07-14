// Home / Einstieg im „Liquid Glass"-Stil: sehr ruhig, viel Weissraum, wenige
// schwebende Glas-Elemente ueber einem sanften, warmen Verlauf. Nur Anzeige,
// keine Backend-/Reward-Logik. Ehrliche Motivation ueber EINEN Held-Wert plus
// die zentrale Aktion (Muell melden). Keine ueberladenen Listen.

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Counter, GlassSurface, Mascot, PressableScale, WeeklyChallenge } from '@/components';
import { DisplayFont, Radius, Spacing, Type, useGlass, useHomeGradient, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { startOfIsoWeek } from '@/lib/week';

type EventRow = { id: string; title: string; event_date: string };

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 11) return 'home.greeting_morning';
  if (h < 18) return 'home.greeting_day';
  return 'home.greeting_evening';
}

/** Blendet ein Kind gestaffelt ein (Fade + leichtes Aufsteigen). */
function Rise({
  progress,
  index,
  children,
  style,
}: {
  progress: SharedValue<number>;
  index: number;
  children: React.ReactNode;
  style?: object;
}) {
  const anim = useAnimatedStyle(() => {
    const start = index * 0.09;
    const p = interpolate(progress.value, [start, start + 0.5], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 20 }] };
  });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const glass = useGlass();
  const homeGrad = useHomeGradient();
  const insets = useSafeAreaInsets();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [places, setPlaces] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<EventRow | null>(null);
  const [weekCount, setWeekCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      // Held-Wert: Orte, die DU sauber gemacht hast (eigene Abschluss-Buchungen).
      supabase
        .from('points_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('reason', 'case_closed_after')
        .then(({ count }) => setPlaces(count ?? 0));
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .in('status', ['gemeldet', 'geprueft', 'weitergeleitet'])
        .then(({ count }) => setOpenCount(count ?? 0));
      supabase
        .from('cleanup_events')
        .select('id, title, event_date')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(1)
        .then(({ data }) => setNextEvent((data as EventRow[])?.[0] ?? null));
      // Gemeinschafts-Challenge: neue Faelle seit Montag 00:00 (cases ist
      // fuer alle lesbar, keine PII — siehe Migration 002).
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfIsoWeek().toISOString())
        .then(({ count }) => setWeekCount(count ?? 0));
    }, [session])
  );

  // Animationen (UI-Thread). Respektiert „Bewegung reduzieren".
  const enter = useSharedValue(0);
  const drift = useSharedValue(0);
  const sheen = useSharedValue(0);
  const bob = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const [ctaW, setCtaW] = useState(0);

  useEffect(() => {
    enter.value = reduceMotion ? 1 : withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    if (reduceMotion) {
      drift.value = 0;
      sheen.value = 0;
      bob.value = 0;
      return;
    }
    drift.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.sin) }), -1, true);
    bob.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    sheen.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1800 })
      ),
      -1,
      false
    );
  }, [reduceMotion, enter, drift, sheen, bob]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-24, 22]) },
      { translateY: interpolate(drift.value, [0, 1], [-14, 24]) - scrollY.value * 0.12 },
    ],
  }));
  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [20, -18]) },
      { translateY: interpolate(drift.value, [0, 1], [12, -16]) - scrollY.value * 0.05 },
    ],
  }));
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [0, -6]) }],
  }));
  const sheenStyle = useAnimatedStyle(() => {
    const bw = ctaW * 0.4;
    return { transform: [{ translateX: interpolate(sheen.value, [0, 1], [-bw, ctaW]) }, { rotate: '18deg' }] };
  });

  const heroSub = places === 0 ? t('home.hero_sub_zero') : t('home.hero_sub');

  return (
    <View style={styles.root}>
      {/* Sanfter, warmer Hintergrund mit zwei ganz ruhig driftenden Licht-Blobs. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={homeGrad} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.blob, styles.blob1, { backgroundColor: glass.blobGreen }, blob1Style]} />
        <Animated.View style={[styles.blob, styles.blob2, { backgroundColor: glass.blobAmber }, blob2Style]} />
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.five }]}>
        {/* Begruessung plus Clari (winkt leicht). */}
        <Rise progress={enter} index={0}>
          <View style={styles.topRow}>
            <View style={styles.greetCol}>
              <Text style={[styles.greeting, { color: colors.text }]} allowFontScaling>
                {t(greetingKey())}
              </Text>
              <Text style={[styles.greetingSub, { color: colors.textSecondary }]} allowFontScaling>
                {t('home.subline')}
              </Text>
            </View>
            <Animated.View style={bobStyle}>
              <Mascot pose="idle" size={64} accessibilityLabel={t('home.mascot_a11y')} />
            </Animated.View>
          </View>
        </Rise>

        {/* EIN Held-Wert: gross, ruhig, mit Zaehl-Effekt. */}
        <Rise progress={enter} index={1} style={styles.heroBlock}>
          <View accessibilityRole="summary" accessibilityLabel={t('home.hero_a11y', { count: places })}>
            <Counter value={places} duration={1100} style={[styles.heroNumber, { color: colors.text }]} />
            <Text style={[styles.heroLabel, { color: colors.primaryStrong }]} allowFontScaling>
              {t('home.hero_label')}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]} allowFontScaling>
              {heroSub}
            </Text>
          </View>
        </Rise>

        {/* Zentrale Aktion: glaenzendes Glas-Element mit wanderndem Sheen. */}
        <Rise progress={enter} index={2}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('home.cta_a11y')}
            onPress={() => router.push('/melden')}
            haptic="medium"
            scaleTo={0.98}>
            <GlassSurface intense radius={Radius.xl} style={styles.ctaSurface}>
              <View onLayout={(e: LayoutChangeEvent) => setCtaW(e.nativeEvent.layout.width)} style={styles.ctaInner}>
                {/* Zarte gruene Identitaets-Waesche und der Licht-Sheen darueber. */}
                <LinearGradient
                  pointerEvents="none"
                  colors={[colors.primary + '2E', colors.primary + '08']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]}>
                  <LinearGradient
                    colors={['transparent', glass.highlight, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                <View style={[styles.ctaIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="camera" size={26} color={colors.onPrimary} />
                </View>
                <View style={styles.ctaText}>
                  <Text style={[styles.ctaTitle, { color: colors.primaryStrong }]} allowFontScaling>
                    {t('home.cta_title')}
                  </Text>
                  <Text style={[styles.ctaSub, { color: colors.textSecondary }]} allowFontScaling>
                    {t('home.cta_sub')}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={22} color={colors.primaryStrong} />
              </View>
            </GlassSurface>
          </PressableScale>
        </Rise>

        {/* Kompakt darunter: offene Faelle in der Naehe, naechste Aktion. */}
        <Rise progress={enter} index={3}>
          <View style={styles.chipRow}>
            <PressableScale
              containerStyle={styles.chipFlex}
              accessibilityRole="button"
              accessibilityLabel={t('home.open_a11y', { count: openCount })}
              onPress={() => router.push('/karte')}>
              <GlassSurface radius={Radius.lg} style={styles.chipFill}>
                <View style={styles.chip}>
                  <Ionicons name="location" size={18} color={colors.primaryStrong} />
                  <Counter value={openCount} style={[styles.chipValue, { color: colors.text }]} />
                  <Text style={[styles.chipLabel, { color: colors.textSecondary }]} allowFontScaling numberOfLines={2}>
                    {t('home.open_label')}
                  </Text>
                </View>
              </GlassSurface>
            </PressableScale>

            <PressableScale
              containerStyle={styles.chipFlex}
              accessibilityRole="button"
              accessibilityLabel={
                nextEvent ? t('home.event_a11y', { title: nextEvent.title }) : t('home.event_none')
              }
              onPress={() => router.push('/events')}>
              <GlassSurface radius={Radius.lg} style={styles.chipFill}>
                <View style={styles.chip}>
                  <Ionicons name="calendar" size={18} color={colors.accent} />
                  {nextEvent ? (
                    <>
                      <Text style={[styles.chipEventTitle, { color: colors.text }]} allowFontScaling numberOfLines={1}>
                        {nextEvent.title}
                      </Text>
                      <Text style={[styles.chipLabel, { color: colors.textSecondary }]} allowFontScaling>
                        {new Date(nextEvent.event_date).toLocaleDateString(dateLocale, {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.chipEventTitle, { color: colors.text }]} allowFontScaling>
                        {t('home.next_event_label')}
                      </Text>
                      <Text style={[styles.chipLabel, { color: colors.textSecondary }]} allowFontScaling>
                        {t('home.event_none')}
                      </Text>
                    </>
                  )}
                </View>
              </GlassSurface>
            </PressableScale>
          </View>
        </Rise>

        {/* Gemeinschafts-Challenge: geteiltes Wochenziel, kein Zeitdruck. */}
        <Rise progress={enter} index={4}>
          <WeeklyChallenge count={weekCount} />
        </Rise>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 400 },
  blob1: { width: 420, height: 420, top: -120, left: -140 },
  blob2: { width: 360, height: 360, bottom: -80, right: -120 },

  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  greetCol: { flex: 1, gap: 2 },
  greeting: { fontFamily: DisplayFont.regular, fontSize: 22, fontWeight: '700' },
  greetingSub: { ...Type.body },

  heroBlock: { marginTop: Spacing.two },
  heroNumber: {
    fontFamily: DisplayFont.bold,
    fontSize: 84,
    fontWeight: '800',
    lineHeight: 90,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { fontFamily: DisplayFont.regular, fontSize: 20, fontWeight: '700', marginTop: Spacing.one },
  heroSub: { ...Type.body, marginTop: Spacing.one, maxWidth: 320 },

  ctaSurface: { marginTop: Spacing.two },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  sheen: { position: 'absolute', top: -40, bottom: -40, width: '40%' },
  ctaIcon: {
    width: 54,
    height: 54,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { fontFamily: DisplayFont.regular, fontSize: 20, fontWeight: '700' },
  ctaSub: { ...Type.body },

  chipRow: { flexDirection: 'row', gap: Spacing.three },
  chipFlex: { flex: 1 },
  chipFill: { flex: 1 },
  chip: { padding: Spacing.three, gap: Spacing.one, minHeight: 96, justifyContent: 'center' },
  chipValue: { fontFamily: DisplayFont.bold, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chipEventTitle: { ...Type.label, fontWeight: '700' },
  chipLabel: { ...Type.caption },
});
