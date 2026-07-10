import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type CleanupEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  max_participants: number;
  signups: { count: number }[];
  my_signup: { id: string }[];
};

export default function EventsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [events, setEvents] = useState<CleanupEvent[]>([]);

  const load = useCallback(() => {
    if (!session) return;
    supabase
      .from('cleanup_events')
      .select(
        'id, title, description, event_date, max_participants, signups:cleanup_signups(count), my_signup:cleanup_signups(id)'
      )
      .eq('my_signup.user_id', session.user.id)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        if (data) setEvents(data as unknown as CleanupEvent[]);
      });
  }, [session]);

  useFocusEffect(load);

  async function toggleSignup(ev: CleanupEvent) {
    if (!session) return;
    if (ev.my_signup.length > 0) {
      await supabase.from('cleanup_signups').delete().eq('id', ev.my_signup[0].id);
    } else {
      await supabase
        .from('cleanup_signups')
        .insert({ event_id: ev.id, user_id: session.user.id });
    }
    load();
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={events}
      keyExtractor={(e) => e.id}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textSecondary }]} allowFontScaling>
          Gerade sind keine Cleanup-Aktionen geplant. Schau bald wieder vorbei!
        </Text>
      }
      renderItem={({ item }) => {
        const joined = item.my_signup.length > 0;
        const count = item.signups[0]?.count ?? 0;
        const full = !joined && count >= item.max_participants;
        return (
          <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.title, { color: colors.text }]} allowFontScaling>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
              {new Date(item.event_date).toLocaleString('de-DE', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              Uhr · {count}/{item.max_participants} dabei
            </Text>
            {item.description ? (
              <Text style={[styles.description, { color: colors.text }]} allowFontScaling>
                {item.description}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                joined
                  ? `Abmelden von ${item.title}`
                  : full
                    ? `${item.title} ist voll`
                    : `Anmelden für ${item.title}`
              }
              disabled={full}
              onPress={() => toggleSignup(item)}
              style={[styles.button, joined ? styles.leave : styles.join, full && styles.disabled]}>
              <Text style={joined ? [styles.leaveLabel, { color: colors.text }] : styles.joinLabel} allowFontScaling>
                {joined ? 'Abmelden' : full ? 'Voll belegt' : 'Mitmachen'}
              </Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.three },
  empty: { textAlign: 'center', marginTop: Spacing.six, fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  title: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 14 },
  description: { fontSize: 15, lineHeight: 21 },
  button: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  join: { backgroundColor: '#1B7A43' },
  joinLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  leave: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#888' },
  leaveLabel: { fontSize: 16 },
  disabled: { opacity: 0.5 },
});
