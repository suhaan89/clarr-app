import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, LoadingState } from '@/components';
import { Radius, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type CleanupEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  max_participants: number;
  // RLS zeigt nur EIGENE Anmeldungen (Migration 014) — mehr braucht der
  // Screen nicht; der Gesamtzaehler kommt aus event_signup_counts.
  my_signup: { id: string }[];
  signup_count: number;
};

export default function EventsScreen() {
  const colors = useThemeColors();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: rows }, { data: counts }] = await Promise.all([
      supabase
        .from('cleanup_events')
        .select('id, title, description, event_date, max_participants, my_signup:cleanup_signups(id)')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true }),
      supabase.from('event_signup_counts').select('event_id, signup_count'),
    ]);
    if (rows) {
      const countMap = new Map(
        (counts ?? []).map((c) => [c.event_id as string, c.signup_count as number])
      );
      setEvents(
        (rows as unknown as Omit<CleanupEvent, 'signup_count'>[]).map((e) => ({
          ...e,
          signup_count: countMap.get(e.id) ?? 0,
        }))
      );
    }
    setLoaded(true);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleSignup(ev: CleanupEvent) {
    if (!session) return;
    let error;
    if (ev.my_signup.length > 0) {
      ({ error } = await supabase.from('cleanup_signups').delete().eq('id', ev.my_signup[0].id));
    } else {
      ({ error } = await supabase
        .from('cleanup_signups')
        .insert({ event_id: ev.id, user_id: session.user.id }));
    }
    if (error) {
      Alert.alert(t('events.error_title'), t('events.error_body'));
    }
    load();
  }

  if (!loaded) return <LoadingState label={t('events.loading')} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={events}
      keyExtractor={(e) => e.id}
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title={t('events.empty_title')}
          body={t('events.empty_body')}
        />
      }
      renderItem={({ item }) => {
        const joined = item.my_signup.length > 0;
        const count = item.signup_count;
        const full = !joined && count >= item.max_participants;
        const date = new Date(item.event_date);
        const fillRatio = Math.min(1, count / Math.max(1, item.max_participants));
        return (
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              {/* Datumsblock: Tag gross, Monat klein — auf einen Blick planbar. */}
              <View style={[styles.dateBlock, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.dateDay, { color: colors.primaryStrong }]} allowFontScaling>
                  {date.toLocaleDateString(dateLocale, { day: '2-digit' })}
                </Text>
                <Text style={[styles.dateMonth, { color: colors.primaryStrong }]} allowFontScaling>
                  {date.toLocaleDateString(dateLocale, { month: 'short' })}
                </Text>
              </View>
              <View style={styles.headText}>
                <Text style={[styles.title, { color: colors.text }]} allowFontScaling>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
                  {date.toLocaleString(dateLocale, {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {joined && <Badge label={t('events.joined_badge')} tone="success" dot />}
              {full && <Badge label={t('events.full')} tone="warning" />}
            </View>

            {item.description ? (
              <Text style={[styles.description, { color: colors.text }]} allowFontScaling>
                {item.description}
              </Text>
            ) : null}

            {/* Teilnehmer-Fortschritt: Balken + Zahl, ehrlich ohne Dringlichkeits-Alarm. */}
            <View
              style={styles.capacityRow}
              accessibilityLabel={t('events.spots', { count, max: item.max_participants })}>
              <View style={[styles.track, { backgroundColor: colors.backgroundSelected }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: colors.primary, width: `${fillRatio * 100}%` },
                  ]}
                />
              </View>
              <Text style={[styles.capacityText, { color: colors.textSecondary }]} allowFontScaling>
                {t('events.spots', { count, max: item.max_participants })}
              </Text>
            </View>

            <Button
              label={joined ? t('events.leave') : full ? t('events.full') : t('events.join')}
              accessibilityLabel={
                joined
                  ? t('events.leave_a11y', { title: item.title })
                  : full
                    ? t('events.full_a11y', { title: item.title })
                    : t('events.join_a11y', { title: item.title })
              }
              onPress={() => toggleSignup(item)}
              disabled={full}
              variant={joined ? 'ghost' : 'primary'}
            />
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  card: { gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dateBlock: {
    width: 52,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  dateMonth: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 14 },
  description: { fontSize: 15, lineHeight: 21 },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  capacityText: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
