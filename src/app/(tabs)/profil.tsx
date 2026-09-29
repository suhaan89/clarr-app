// Impact-Profil (Paket 9): zeigt den SERVERSEITIGEN Punktestand (View
// points_level) – der Client setzt nie Punkte. Bewusst OHNE Streaks,
// Tages-Serien oder Zufallsbelohnungen (keine Grind-/Dark-Patterns,
// Zielgruppe teils minderjaehrig). Leaderboard nur mit Opt-in, Pseudonym,
// Wochen-Reset.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Badges,
  Card,
  Celebration,
  Input,
  LanguagePicker,
  LevelProgress,
  PressableScale,
  SectionHeader,
  Skeleton,
  SkeletonLine,
  WeeklyChallenge,
} from '@/components';
import { Radius, Spacing, Type, useThemeColors } from '@/constants/theme';
import { computeAchievements, earnedCount } from '@/lib/achievements';
import { callFunction } from '@/lib/api';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { clearLocalReportData } from '@/lib/offline-queue';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { TOUR_IDS, useResetAllTours, useTour } from '@/lib/tour';
import { isValidDisplayName } from '@/lib/validation';
import { startOfIsoWeek } from '@/lib/week';

// `ki_training` ist ein echtes Opt-in (Standard: aus), siehe Migration 023.
const CONSENT_KEYS = ['kamera', 'standort', 'behoerden_weitergabe', 'ki_training'] as const;

type LevelRow = { balance: number; level: number; level_name: string } | null;
type LedgerRow = { id: number; delta: number; reason: string; created_at: string };
type BoardRow = { display_name: string; points: number; rank: number };

const REASON_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  report_verified: 'checkmark-circle-outline',
  case_confirmed: 'people-outline',
  case_closed_after: 'sparkles-outline',
};

// Unbekannte Server-Reasons werden roh angezeigt statt uebersetzt.
const KNOWN_REASONS = new Set(['report_verified', 'case_confirmed', 'case_closed_after']);

export default function ProfilScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { session } = useSession();
  const router = useRouter();
  const [level, setLevel] = useState<LevelRow>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState({ reports: 0, confirms: 0, closes: 0, events: 0 });
  const [isModerator, setIsModerator] = useState(false);
  const [weekCount, setWeekCount] = useState(0);
  // Bis der erste Ladevorgang durch ist: Skeleton statt kurzem "0 Punkte"-Blitzer.
  const [loaded, setLoaded] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  // Zuletzt gesehene Stufe; erst ein ECHTER Anstieg (nicht der erste Ladevorgang)
  // löst die Feier aus. Keine künstlichen Trigger.
  const lastLevel = useRef<number | null>(null);

  // Onboarding-Tour (Coachmarks): Punktestand, Fortschritt, Abzeichen.
  const impactRef = useRef<View>(null);
  const progressRef = useRef<View>(null);
  const badgesRef = useRef<View>(null);
  const startTour = useTour(TOUR_IDS.profil);
  const isFocused = useIsFocused();
  const resetAllTours = useResetAllTours();
  // Ueber Refs, damit der Tour-Effekt eine stabile Abhaengigkeitsliste behaelt.
  const startTourRef = useRef(startTour);
  startTourRef.current = startTour;
  const tRef = useRef(t);
  tRef.current = t;

  // Async + Promise.all, damit RefreshControl weiss, wann der Refresh fertig ist
  // (statt der vorherigen Fire-and-forget-.then()-Ketten ohne Rueckgabewert).
  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    const levelP = supabase
      .from('points_level')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          Alert.alert(t('profil.error_title'), t('profil.error_body'), [
            { text: t('profil.error_retry'), onPress: () => load() },
          ]);
          setLoaded(true);
          return;
        }
        const row = data as LevelRow;
        setLevel(row);
        const lvl = row?.level ?? null;
        if (lvl != null) {
          if (lastLevel.current != null && lvl > lastLevel.current) setLevelUp(lvl);
          lastLevel.current = lvl;
        }
        setLoaded(true);
      });
    const ledgerP = supabase
      .from('points_ledger')
      .select('id, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLedger((data as LedgerRow[]) ?? []));
    const profileP = supabase
      .from('user_profiles')
      .select('leaderboard_opt_in, display_name, role')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOptIn(Boolean(data.leaderboard_opt_in));
          setDisplayName(data.display_name ?? '');
          setIsModerator(data.role === 'moderator');
        }
      });
    const boardP = supabase
      .from('leaderboard_week')
      .select('*')
      .then(({ data }) => setBoard((data as BoardRow[]) ?? []));
    const consentsP = supabase
      .from('current_consents')
      .select('consent_key, granted')
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        for (const row of data ?? []) map[row.consent_key] = row.granted;
        setConsents(map);
      });
    // Zaehlwerte fuer die Abzeichen (nur eigene Zeilen via RLS). Reine
    // Anzeige, keine Reward-Buchung.
    const countsP = Promise.all([
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'report_verified'),
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'case_confirmed'),
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'case_closed_after'),
      supabase.from('cleanup_signups').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    ]).then(([r, c, cl, ev]) => {
      setCounts({
        reports: r.count ?? 0,
        confirms: c.count ?? 0,
        closes: cl.count ?? 0,
        events: ev.count ?? 0,
      });
    });

    // Gemeinschafts-Challenge: neue Faelle seit Montag 00:00 (cases ist fuer
    // alle lesbar, keine PII — siehe Migration 002). Gehoert thematisch zur
    // Bestenliste (Gemeinschaft), nicht auf den bewusst minimalistischen
    // Home-Screen (Redesign-Runde 5, docs/design-notes.md).
    const weekP = supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfIsoWeek().toISOString())
      .then(({ count }) => setWeekCount(count ?? 0));

    await Promise.all([levelP, ledgerP, profileP, boardP, consentsP, countsP, weekP]);
  }, [session, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    // Impact-Karte und Fortschritt existieren erst, sobald `loaded` steht.
    // Bei jedem Fokus anstossen (idempotent per AsyncStorage) – so kommt die Tour
    // auch nach dem "erneut anzeigen"-Reset wieder, obwohl der Screen gemountet
    // bleibt.
    if (!isFocused || !loaded) return;
    const t = tRef.current;
    startTourRef.current([
      {
        id: 'impact',
        targetRef: impactRef,
        title: t('tour.profil.step_impact_title'),
        description: t('tour.profil.step_impact_desc'),
        tooltipPosition: 'auto',
      },
      {
        id: 'progress',
        targetRef: progressRef,
        title: t('tour.profil.step_progress_title'),
        description: t('tour.profil.step_progress_desc'),
        tooltipPosition: 'auto',
      },
      {
        id: 'badges',
        targetRef: badgesRef,
        title: t('tour.profil.step_badges_title'),
        description: t('tour.profil.step_badges_desc'),
        tooltipPosition: 'auto',
      },
    ]);
  }, [isFocused, loaded]);

  async function restartTour() {
    await resetAllTours();
    router.replace('/');
  }

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function saveLeaderboardPrefs(nextOptIn: boolean) {
    const trimmedName = displayName.trim();
    if (nextOptIn && trimmedName && !isValidDisplayName(trimmedName)) {
      Alert.alert(t('profil.pseudonym_invalid_title'), t('profil.pseudonym_invalid_body'));
      return;
    }
    setOptIn(nextOptIn);
    const { error } = await supabase.rpc('set_leaderboard_prefs', {
      p_opt_in: nextOptIn,
      p_display_name: trimmedName || null,
    });
    if (error) {
      setOptIn(!nextOptIn);
      Alert.alert(t('profil.error_title'), t('profil.error_body'));
      return;
    }
    load();
  }

  const levelName = level?.level_name ?? t('profil.level_default');
  const achievements = computeAchievements({
    balance: level?.balance ?? 0,
    reportsVerified: counts.reports,
    casesConfirmed: counts.confirms,
    casesClosed: counts.closes,
    events: counts.events,
  });
  const earned = earnedCount(achievements);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }>
      {/* Impact-Held: der eigene Beitrag zuerst, ruhig und stolz. */}
      {!loaded ? (
        <Card tone="soft" style={styles.impactCard}>
          <Skeleton width={44} height={44} radius={999} />
          <Skeleton width={100} height={48} style={{ marginTop: Spacing.two }} />
          <Skeleton width={80} height={16} />
        </Card>
      ) : (
        <View ref={impactRef} collapsable={false}>
          <Card
            tone="soft"
            style={styles.impactCard}
            accessibilityRole="summary"
            accessibilityLabel={t('profil.impact_a11y', {
              points: level?.balance ?? 0,
              level: levelName,
            })}>
            <View style={[styles.impactIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="leaf" size={22} color={colors.onPrimary} />
            </View>
            <Text style={[styles.points, { color: colors.primaryStrong }]} allowFontScaling>
              {level?.balance ?? 0}
            </Text>
            <Text style={[styles.pointsLabel, { color: colors.text }]} allowFontScaling>
              {t('profil.points_unit')}
            </Text>
            <Badge label={levelName} tone="success" />
            <Text style={[styles.cosmeticNote, { color: colors.textSecondary }]} allowFontScaling>
              {t('profil.cosmetic_note')}
            </Text>
          </Card>
        </View>
      )}

      {/* Fortschritt zur naechsten Stufe – klarer naechster Schritt, aus dem
          Saldo abgeleitet (keine Reward-Logik im Client). */}
      {loaded && (
        <View ref={progressRef} collapsable={false}>
          <LevelProgress balance={level?.balance ?? 0} levelName={levelName} />
        </View>
      )}

      {/* Sammelbare Abzeichen fuer echte Meilensteine (kein Geldwert). */}
      <View style={styles.badgesHead}>
        <SectionHeader title={t('profil.badges')} />
        <Text style={[styles.badgesCount, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.badges_count', { earned, total: achievements.length })}
        </Text>
      </View>
      <View ref={badgesRef} collapsable={false}>
        <Card style={styles.sectionCard}>
          <Badges items={achievements} />
        </Card>
      </View>

      <SectionHeader title={t('profil.activity')} />
      <Card style={styles.sectionCard}>
        {!loaded ? (
          <>
            <SkeletonLine />
            <SkeletonLine />
          </>
        ) : ledger.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.no_points')}
          </Text>
        ) : (
          ledger.map((entry) => (
            <View key={entry.id} style={styles.ledgerRow}>
              <Ionicons
                name={REASON_ICONS[entry.reason] ?? 'ellipse-outline'}
                size={18}
                color={colors.textSecondary}
              />
              <Text style={[styles.ledgerReason, { color: colors.text }]} allowFontScaling>
                {KNOWN_REASONS.has(entry.reason)
                  ? t(`reason.${entry.reason}` as TranslationKey)
                  : entry.reason}
              </Text>
              <Text
                style={[
                  styles.ledgerDelta,
                  { color: entry.delta > 0 ? colors.primaryStrong : colors.danger },
                ]}
                allowFontScaling>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Gemeinschafts-Challenge: geteiltes Wochenziel, kein Zeitdruck.
          Gehoert hier zur Gemeinschafts-Sektion (Bestenliste), nicht auf den
          bewusst minimalistischen Home-Screen. */}
      {loaded && <WeeklyChallenge count={weekCount} />}

      <SectionHeader title={t('profil.leaderboard')} />
      <Card style={styles.sectionCard}>
        <View style={styles.optInRow}>
          <Text style={[styles.optInLabel, { color: colors.text }]} allowFontScaling>
            {t('profil.optin')}
          </Text>
          <Switch
            accessibilityLabel={t('profil.optin_a11y')}
            value={optIn}
            onValueChange={saveLeaderboardPrefs}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {optIn && (
          <Input
            accessibilityLabel={t('profil.pseudonym_a11y')}
            placeholder={t('profil.pseudonym_placeholder')}
            value={displayName}
            onChangeText={setDisplayName}
            onEndEditing={() => saveLeaderboardPrefs(true)}
            maxLength={24}
          />
        )}
        <Text style={[styles.resetNote, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.reset_note')}
        </Text>
        {board.map((row) => (
          <View key={`${row.rank}-${row.display_name}`} style={styles.boardRow}>
            <View
              style={[
                styles.rankBubble,
                { backgroundColor: row.rank <= 3 ? colors.primarySoft : colors.backgroundSelected },
              ]}>
              <Text
                style={[
                  styles.rankText,
                  { color: row.rank <= 3 ? colors.primaryStrong : colors.textSecondary },
                ]}
                allowFontScaling>
                {row.rank}
              </Text>
            </View>
            <Text style={[styles.boardName, { color: colors.text }]} allowFontScaling>
              {row.display_name}
            </Text>
            <Text style={[styles.boardPoints, { color: colors.textSecondary }]} allowFontScaling>
              {row.points}
            </Text>
          </View>
        ))}
      </Card>

      <SectionHeader title={t('profil.language')} />
      <Card style={styles.sectionCard}>
        <LanguagePicker />
        <Text style={[styles.resetNote, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.language_hint')}
        </Text>
      </Card>

      <SectionHeader title={t('tour.restart_section')} />
      <Card style={styles.sectionCard}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('tour.restart_a11y')}
          onPress={restartTour}
          haptic="light"
          style={styles.rightsButton}>
          <Ionicons name="help-circle-outline" size={18} color={colors.text} />
          <Text style={[styles.rightsLabel, { color: colors.text }]} allowFontScaling>
            {t('tour.restart_label')}
          </Text>
        </PressableScale>
        <Text style={[styles.resetNote, { color: colors.textSecondary }]} allowFontScaling>
          {t('tour.restart_hint')}
        </Text>
      </Card>

      <SectionHeader title={t('profil.privacy')} />
      <Card style={styles.sectionCard}>
        {CONSENT_KEYS.map((key) => {
          const label = t(`consent.${key}` as TranslationKey);
          return (
            <View key={key} style={styles.optInRow}>
              <Text style={[styles.optInLabel, { color: colors.text }]} allowFontScaling>
                {label}
              </Text>
              <Switch
                accessibilityLabel={t('consent.a11y', { label })}
                value={consents[key] ?? false}
                trackColor={{ true: colors.primary }}
                onValueChange={async (granted) => {
                  setConsents((c) => ({ ...c, [key]: granted }));
                  // Nachweisbar: jede Aenderung wird serverseitig als neue
                  // Journal-Zeile gespeichert (append-only, Migration 013).
                  await supabase.rpc('record_consent', {
                    p_consent_key: key,
                    p_granted: granted,
                  });
                }}
              />
            </View>
          );
        })}
        <Text style={[styles.resetNote, { color: colors.textSecondary }]} allowFontScaling>
          {t('consent.ki_training_hint')}
        </Text>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('profil.export_a11y')}
          onPress={async () => {
            try {
              const data = await callFunction('export-my-data', {});
              await Share.share({
                title: t('profil.export_share_title'),
                message: JSON.stringify(data, null, 2),
              });
            } catch {
              Alert.alert(t('profil.error_generic'), t('profil.export_error'));
            }
          }}
          haptic="light"
          style={styles.rightsButton}>
          <Ionicons name="download-outline" size={18} color={colors.text} />
          <Text style={[styles.rightsLabel, { color: colors.text }]} allowFontScaling>
            {t('profil.export')}
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('profil.delete_a11y')}
          onPress={() => {
            Alert.alert(t('profil.delete_title'), t('profil.delete_body'), [
              { text: t('profil.delete_cancel'), style: 'cancel' },
              {
                text: t('profil.delete_confirm'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await callFunction('delete-account', {
                      confirm: 'KONTO ENDGUELTIG LOESCHEN',
                    });
                    // Der Server ist abgeraeumt; jetzt auch das Geraet.
                    // Ohne das blieben noch nicht gesendete Meldungen samt
                    // Fotos und die Install-ID lokal liegen (Art. 17 DSGVO).
                    await clearLocalReportData();
                    await supabase.auth.signOut();
                  } catch {
                    Alert.alert(t('profil.error_generic'), t('profil.delete_error'));
                  }
                },
              },
            ]);
          }}
          haptic="medium"
          style={styles.rightsButton}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.rightsLabel, { color: colors.danger }]} allowFontScaling>
            {t('profil.delete')}
          </Text>
        </PressableScale>
      </Card>

      {isModerator && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('moderation.title')}
          onPress={() => router.push('/moderation')}
          haptic="light"
          style={styles.rightsButton}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          <Text style={[styles.rightsLabel, { color: colors.text }]} allowFontScaling>
            {t('moderation.title')}
          </Text>
        </PressableScale>
      )}

      {/* Rechtliches vollstaendig und ohne Suchen erreichbar: Datenschutz
          (Art. 13 DSGVO), Nutzungsbedingungen (Art. 14 DSA), Melde- und
          Kontaktstelle (Art. 11, 12, 16, 20 DSA), Impressum (§ 5 DDG) und die
          Open-Source-Lizenzhinweise. */}
      <View style={styles.legalLinks}>
        <Link href="/legal/datenschutz" accessibilityLabel={t('profil.datenschutz_a11y')}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.datenschutz')}
          </Text>
        </Link>
        <Link href="/legal/agb" accessibilityLabel={t('profil.agb_a11y')}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.agb')}
          </Text>
        </Link>
        <Link href="/legal/kontakt" accessibilityLabel={t('profil.kontakt_a11y')}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.kontakt')}
          </Text>
        </Link>
        <Link href="/legal/impressum" accessibilityLabel={t('profil.impressum_a11y')}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.impressum')}
          </Text>
        </Link>
        <Link href="/legal/lizenzen" accessibilityLabel={t('profil.lizenzen_a11y')}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('profil.lizenzen')}
          </Text>
        </Link>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('profil.signout')}
        onPress={() => supabase.auth.signOut()}
        haptic="light"
        style={styles.signOut}>
        <Text style={[styles.footerLabel, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.signout')}
        </Text>
      </PressableScale>

      <Celebration
        visible={levelUp != null}
        onDone={() => setLevelUp(null)}
        title={t('celebrate.levelup_title', { level: levelUp ?? 0 })}
        message={t('celebrate.levelup_message')}
        pose="levelup"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  impactCard: { alignItems: 'center', gap: Spacing.one, padding: Spacing.four },
  impactIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  points: { ...Type.numeric, fontSize: 48 },
  pointsLabel: { fontSize: 15, fontWeight: '600', marginBottom: Spacing.one },
  cosmeticNote: { fontSize: 12, marginTop: Spacing.two, textAlign: 'center' },
  sectionCard: { gap: Spacing.two },
  badgesHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  badgesCount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyText: { fontSize: 14, lineHeight: 20 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 36,
  },
  ledgerReason: { fontSize: 15, flex: 1 },
  ledgerDelta: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  optInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    gap: Spacing.two,
  },
  optInLabel: { fontSize: 15, flexShrink: 1 },
  resetNote: { fontSize: 12, lineHeight: 17 },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 36,
  },
  rankBubble: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '700' },
  boardName: { fontSize: 15, flex: 1 },
  boardPoints: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  rightsLabel: { fontSize: 15, fontWeight: '600' },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    rowGap: Spacing.two,
    justifyContent: 'center',
    marginTop: Spacing.three,
    alignItems: 'center',
  },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  footerLabel: { fontSize: 15 },
});
