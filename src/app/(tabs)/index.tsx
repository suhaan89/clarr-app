// Home / Übersicht — der einladende Einstieg (statt direkt in die Karte).
// Nur Anzeige: liest serverseitige Views/Tabellen, schreibt nichts. Bewusst
// ohne Streaks/Countdowns — ehrliche Motivation über sichtbare Wirkung.

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, SectionHeader } from '@/components';
import { getCaseStatus } from '@/constants/status';
import { Radius, Shadow, Spacing, Type, useGradients, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type LevelRow = { balance: number; level_name: string } | null;
type CaseRow = { id: string; title: string; status: string; created_at: string };
type EventRow = { id: string; title: string; event_date: string };

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 11) return 'home.greeting_morning';
  if (h < 18) return 'home.greeting_day';
  return 'home.greeting_evening';
}

/** Kompakte Kennzahl-Kachel: Icon + große Zahl + Label. */
function StatTile({
  icon,
  value,
  label,
  fg,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  fg: string;
  bg: string;
}) {
  const colors = useThemeColors();
  return (
    <Card style={styles.statTile} accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={fg} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]} allowFontScaling>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]} allowFontScaling>
        {label}
      </Text>
    </Card>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const grad = useGradients();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const router = useRouter();

  const [level, setLevel] = useState<LevelRow>(null);
  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [closedCases, setClosedCases] = useState<CaseRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      supabase
        .from('points_level')
        .select('balance, level_name')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => setLevel(data as LevelRow));
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .in('status', ['gemeldet', 'geprueft', 'weitergeleitet'])
        .then(({ count }) => setOpenCount(count ?? 0));
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .in('status', ['erledigt', 'geschlossen'])
        .then(({ count }) => setClosedCount(count ?? 0));
      supabase
        .from('cleanup_events')
        .select('id, title, event_date')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(2)
        .then(({ data }) => setEvents((data as EventRow[]) ?? []));
      supabase
        .from('cases')
        .select('id, title, status, created_at')
        .in('status', ['erledigt', 'geschlossen'])
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => setClosedCases((data as CaseRow[]) ?? []));
    }, [session])
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      {/* Begrüßung auf zartem Verlauf — warmer, ruhiger Empfang. */}
      <LinearGradient
        colors={grad.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.greetRow}>
          <Ionicons name="sunny" size={18} color={colors.accent} />
          <Text style={[styles.greet, { color: colors.textSecondary }]} allowFontScaling>
            {t(greetingKey())}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.heroTitle, { color: colors.text }]}
          allowFontScaling>
          {t('home.headline')}
        </Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]} allowFontScaling>
          {t('home.subline')}
        </Text>
      </LinearGradient>

      {/* Primärer Aufruf: Müll melden. Der Held des Screens. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.cta_a11y')}
        onPress={() => router.push('/melden')}
        style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
        <LinearGradient
          colors={grad.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <View style={styles.ctaIcon}>
            <Ionicons name="camera" size={26} color="#fff" />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle} allowFontScaling>
              {t('home.cta_title')}
            </Text>
            <Text style={styles.ctaSub} allowFontScaling>
              {t('home.cta_sub')}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>

      {/* Wirkung in Zahlen: offene vs. aufgeräumte Fälle. */}
      <View style={styles.statRow}>
        <StatTile
          icon="alert-circle"
          value={openCount}
          label={t('home.stat_open')}
          fg={colors.danger}
          bg={colors.dangerSoft}
        />
        <StatTile
          icon="checkmark-done-circle"
          value={closedCount}
          label={t('home.stat_closed')}
          fg={colors.primaryStrong}
          bg={colors.successSoft}
        />
      </View>

      {/* Eigener Impact, kompakt — führt tiefer ins Profil. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.impact_a11y', {
          points: level?.balance ?? 0,
          level: level?.level_name ?? t('profil.level_default'),
        })}
        onPress={() => router.push('/profil')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Card tone="soft" style={styles.impactCard}>
          <View style={[styles.impactIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="leaf" size={20} color={colors.onPrimary} />
          </View>
          <View style={styles.impactText}>
            <Text style={[styles.impactValue, { color: colors.primaryStrong }]} allowFontScaling>
              {level?.balance ?? 0} {t('profil.points_unit')}
            </Text>
            <Text style={[styles.impactLevel, { color: colors.textSecondary }]} allowFontScaling>
              {level?.level_name ?? t('profil.level_default')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Card>
      </Pressable>

      {/* Nächste Aktionen — Gemeinschaft sichtbar machen. */}
      <View style={styles.sectionHead}>
        <SectionHeader title={t('home.events_title')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.see_all_events')}
          onPress={() => router.push('/events')}
          hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.primaryStrong }]} allowFontScaling>
            {t('home.see_all')}
          </Text>
        </Pressable>
      </View>
      {events.length === 0 ? (
        <Card>
          <Text style={[styles.emptyLine, { color: colors.textSecondary }]} allowFontScaling>
            {t('home.events_empty')}
          </Text>
        </Card>
      ) : (
        events.map((ev) => {
          const date = new Date(ev.event_date);
          return (
            <Pressable
              key={ev.id}
              accessibilityRole="button"
              accessibilityLabel={ev.title}
              onPress={() => router.push('/events')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Card style={styles.eventRow}>
                <View style={[styles.dateBlock, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.dateDay, { color: colors.primaryStrong }]} allowFontScaling>
                    {date.toLocaleDateString(dateLocale, { day: '2-digit' })}
                  </Text>
                  <Text style={[styles.dateMonth, { color: colors.primaryStrong }]} allowFontScaling>
                    {date.toLocaleDateString(dateLocale, { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.eventText}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} allowFontScaling numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={[styles.eventMeta, { color: colors.textSecondary }]} allowFontScaling>
                    {date.toLocaleString(dateLocale, {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Card>
            </Pressable>
          );
        })
      )}

      {/* Zuletzt aufgeräumt — ehrlicher Beweis, dass Melden wirkt. */}
      <SectionHeader title={t('home.recent_title')} />
      {closedCases.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title={t('home.recent_empty_title')}
          body={t('home.recent_empty_body')}
        />
      ) : (
        closedCases.map((c) => {
          const status = getCaseStatus(c.status, t);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.title} — ${status.label}`}
              onPress={() => router.push({ pathname: '/case/[id]', params: { id: c.id } })}
              style={({ pressed }) => pressed && styles.pressed}>
              <Card style={styles.caseRow}>
                <View style={[styles.caseIcon, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name={status.icon} size={18} color={colors.primaryStrong} />
                </View>
                <View style={styles.caseText}>
                  <Text style={[styles.caseTitle, { color: colors.text }]} allowFontScaling numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Badge label={status.label} tone={status.tone} icon={status.icon} />
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  greet: { ...Type.label, fontWeight: '600' },
  heroTitle: { ...Type.title, marginTop: Spacing.one },
  heroSub: { ...Type.body },

  ctaWrap: { borderRadius: Radius.lg, ...Shadow },
  cta: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  ctaIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { ...Type.heading, fontSize: 19, color: '#fff' },
  ctaSub: { ...Type.body, color: 'rgba(255,255,255,0.9)' },

  statRow: { flexDirection: 'row', gap: Spacing.three },
  statTile: { flex: 1, gap: Spacing.one, padding: Spacing.three },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  statValue: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { ...Type.caption },

  impactCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  impactIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactText: { flex: 1, gap: 2 },
  impactValue: { ...Type.heading, fontVariant: ['tabular-nums'] },
  impactLevel: { ...Type.caption },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  seeAll: { ...Type.caption, fontWeight: '700', minHeight: 44, textAlignVertical: 'center' },
  emptyLine: { ...Type.body },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dateBlock: {
    width: 48,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 19, fontWeight: '800', lineHeight: 22 },
  dateMonth: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  eventText: { flex: 1, gap: 2 },
  eventTitle: { ...Type.label, fontWeight: '700' },
  eventMeta: { ...Type.caption },

  caseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  caseIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseText: { flex: 1, gap: Spacing.one },
  caseTitle: { ...Type.label, fontWeight: '700' },

  pressed: { opacity: 0.7 },
});
