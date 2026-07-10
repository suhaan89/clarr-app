// Impact-Profil (Paket 9): zeigt den SERVERSEITIGEN Punktestand (View
// points_level) — der Client setzt nie Punkte. Bewusst OHNE Streaks,
// Tages-Serien oder Zufallsbelohnungen (keine Grind-/Dark-Patterns,
// Zielgruppe teils minderjaehrig). Leaderboard nur mit Opt-in, Pseudonym,
// Wochen-Reset.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Pressable,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type LevelRow = { balance: number; level: number; level_name: string } | null;
type LedgerRow = { id: number; delta: number; reason: string; created_at: string };
type BoardRow = { display_name: string; points: number; rank: number };

const REASON_LABELS: Record<string, string> = {
  report_verified: 'Meldung bestätigt',
  case_confirmed: 'Fall mitbestätigt',
  case_closed_after: 'Fall aufgeräumt',
};

export default function ProfilScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [level, setLevel] = useState<LevelRow>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [board, setBoard] = useState<BoardRow[]>([]);

  const load = useCallback(() => {
    if (!session) return;
    supabase
      .from('points_level')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setLevel(data as LevelRow));
    supabase
      .from('points_ledger')
      .select('id, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLedger((data as LedgerRow[]) ?? []));
    supabase
      .from('user_profiles')
      .select('leaderboard_opt_in, display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOptIn(Boolean(data.leaderboard_opt_in));
          setDisplayName(data.display_name ?? '');
        }
      });
    supabase
      .from('leaderboard_week')
      .select('*')
      .then(({ data }) => setBoard((data as BoardRow[]) ?? []));
  }, [session]);

  useFocusEffect(load);

  async function saveLeaderboardPrefs(nextOptIn: boolean) {
    setOptIn(nextOptIn);
    await supabase.rpc('set_leaderboard_prefs', {
      p_opt_in: nextOptIn,
      p_display_name: displayName.trim() || null,
    });
    load();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <View
        style={[styles.impactCard, { backgroundColor: colors.backgroundElement }]}
        accessibilityRole="summary"
        accessibilityLabel={`Dein Impact: ${level?.balance ?? 0} Punkte, Level ${level?.level_name ?? 'Einsteiger'}`}>
        <Text style={[styles.points, { color: colors.text }]} allowFontScaling>
          {level?.balance ?? 0}
        </Text>
        <Text style={[styles.pointsLabel, { color: colors.textSecondary }]} allowFontScaling>
          Impact-Punkte · {level?.level_name ?? 'Einsteiger'}
        </Text>
        <Text style={[styles.cosmeticNote, { color: colors.textSecondary }]} allowFontScaling>
          Punkte zeigen deinen Beitrag — sie sind nicht einlösbar.
        </Text>
      </View>

      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]} allowFontScaling>
        Letzte Aktivität
      </Text>
      {ledger.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]} allowFontScaling>
          Noch keine Punkte — deine erste geprüfte Meldung ändert das.
        </Text>
      ) : (
        ledger.map((entry) => (
          <View key={entry.id} style={styles.ledgerRow}>
            <Text style={[styles.ledgerReason, { color: colors.text }]} allowFontScaling>
              {REASON_LABELS[entry.reason] ?? entry.reason}
            </Text>
            <Text
              style={[styles.ledgerDelta, { color: entry.delta > 0 ? '#1B7A43' : '#C0392B' }]}
              allowFontScaling>
              {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
            </Text>
          </View>
        ))
      )}

      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]} allowFontScaling>
        Wochen-Bestenliste
      </Text>
      <View style={styles.optInRow}>
        <Text style={[styles.optInLabel, { color: colors.text }]} allowFontScaling>
          Teilnehmen (freiwillig, mit Pseudonym)
        </Text>
        <Switch
          accessibilityLabel="An der Wochen-Bestenliste teilnehmen"
          value={optIn}
          onValueChange={saveLeaderboardPrefs}
        />
      </View>
      {optIn && (
        <TextInput
          accessibilityLabel="Pseudonym für die Bestenliste"
          placeholder="Pseudonym (2–24 Zeichen)"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          onEndEditing={() => saveLeaderboardPrefs(true)}
          maxLength={24}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />
      )}
      <Text style={[styles.resetNote, { color: colors.textSecondary }]} allowFontScaling>
        Die Liste startet jeden Montag bei null — es zählt die Woche, nicht der Dauer-Grind.
      </Text>
      {board.map((row) => (
        <View key={`${row.rank}-${row.display_name}`} style={styles.ledgerRow}>
          <Text style={[styles.ledgerReason, { color: colors.text }]} allowFontScaling>
            {row.rank}. {row.display_name}
          </Text>
          <Text style={[styles.ledgerDelta, { color: colors.text }]} allowFontScaling>
            {row.points}
          </Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abmelden"
        onPress={() => supabase.auth.signOut()}
        style={styles.signOut}>
        <Text style={[styles.signOutLabel, { color: colors.textSecondary }]} allowFontScaling>
          Abmelden
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  impactCard: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  points: { fontSize: 44, fontWeight: '700' },
  pointsLabel: { fontSize: 15 },
  cosmeticNote: { fontSize: 12, marginTop: Spacing.one },
  heading: { fontSize: 17, fontWeight: '600', marginTop: Spacing.four },
  emptyText: { fontSize: 14, lineHeight: 20 },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
    alignItems: 'center',
  },
  ledgerReason: { fontSize: 15, flexShrink: 1 },
  ledgerDelta: { fontSize: 15, fontWeight: '600' },
  optInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  optInLabel: { fontSize: 15, flexShrink: 1, paddingRight: Spacing.two },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: Spacing.three, fontSize: 16 },
  resetNote: { fontSize: 12, lineHeight: 17 },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.five },
  signOutLabel: { fontSize: 15 },
});
