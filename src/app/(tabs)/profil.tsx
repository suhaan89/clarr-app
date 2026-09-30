// Impact-Profil (Paket 9): zeigt den SERVERSEITIGEN Punktestand (View
// points_level) – der Client setzt nie Punkte. Bewusst OHNE Streaks,
// Tages-Serien oder Zufallsbelohnungen (keine Grind-/Dark-Patterns,
// Zielgruppe teils minderjaehrig). Leaderboard nur mit Opt-in, Pseudonym,
// Wochen-Reset.
//
// Daten und Schreibwege: src/lib/useProfilData.ts. Die einzelnen Abschnitte
// liegen in src/components/profil.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Badges,
  Card,
  Celebration,
  LanguagePicker,
  LevelProgress,
  PressableScale,
  SectionHeader,
  Skeleton,
  WeeklyChallenge,
} from '@/components';
import {
  ActivityCard,
  LeaderboardCard,
  PrivacyCard,
  ProfilFooter,
  profilStyles,
} from '@/components/profil';
import { Radius, Spacing, Type, useThemeColors } from '@/constants/theme';
import { computeAchievements, earnedCount } from '@/lib/achievements';
import { useI18n } from '@/lib/i18n';
import { TOUR_IDS, useFocusTour, useResetAllTours } from '@/lib/tour';
import { useProfilData } from '@/lib/useProfilData';

export default function ProfilScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const data = useProfilData();
  const { level, loaded, counts } = data;

  // Onboarding-Tour (Coachmarks): Punktestand, Fortschritt, Abzeichen.
  const impactRef = useRef<View>(null);
  const progressRef = useRef<View>(null);
  const badgesRef = useRef<View>(null);
  const resetAllTours = useResetAllTours();
  // Impact-Karte und Fortschritt existieren erst, sobald `loaded` steht.
  useFocusTour(TOUR_IDS.profil, loaded, (tr) => [
    {
      id: 'impact',
      targetRef: impactRef,
      title: tr('tour.profil.step_impact_title'),
      description: tr('tour.profil.step_impact_desc'),
      tooltipPosition: 'auto',
    },
    {
      id: 'progress',
      targetRef: progressRef,
      title: tr('tour.profil.step_progress_title'),
      description: tr('tour.profil.step_progress_desc'),
      tooltipPosition: 'auto',
    },
    {
      id: 'badges',
      targetRef: badgesRef,
      title: tr('tour.profil.step_badges_title'),
      description: tr('tour.profil.step_badges_desc'),
      tooltipPosition: 'auto',
    },
  ]);

  async function restartTour() {
    await resetAllTours();
    router.replace('/');
  }

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    await data.load();
    setRefreshing(false);
  }

  const balance = level?.balance ?? 0;
  const levelName = level?.level_name ?? t('profil.level_default');
  const achievements = computeAchievements({
    balance,
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
            accessibilityLabel={t('profil.impact_a11y', { points: balance, level: levelName })}>
            <View style={[styles.impactIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="leaf" size={22} color={colors.onPrimary} />
            </View>
            <Text style={[styles.points, { color: colors.primaryStrong }]} allowFontScaling>
              {balance}
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
          <LevelProgress balance={balance} levelName={levelName} />
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
        <Card style={profilStyles.sectionCard}>
          <Badges items={achievements} />
        </Card>
      </View>

      <SectionHeader title={t('profil.activity')} />
      <ActivityCard ledger={data.ledger} loaded={loaded} />

      {/* Gemeinschafts-Challenge: geteiltes Wochenziel, kein Zeitdruck.
          Gehoert hier zur Gemeinschafts-Sektion (Bestenliste), nicht auf den
          bewusst minimalistischen Home-Screen. */}
      {loaded && <WeeklyChallenge count={data.weekCount} />}

      <SectionHeader title={t('profil.leaderboard')} />
      <LeaderboardCard {...data.leaderboard} />

      <SectionHeader title={t('profil.language')} />
      <Card style={profilStyles.sectionCard}>
        <LanguagePicker />
        <Text style={[profilStyles.note, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.language_hint')}
        </Text>
      </Card>

      <SectionHeader title={t('tour.restart_section')} />
      <Card style={profilStyles.sectionCard}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('tour.restart_a11y')}
          onPress={restartTour}
          haptic="light"
          style={profilStyles.actionRow}>
          <Ionicons name="help-circle-outline" size={18} color={colors.text} />
          <Text style={[profilStyles.actionLabel, { color: colors.text }]} allowFontScaling>
            {t('tour.restart_label')}
          </Text>
        </PressableScale>
        <Text style={[profilStyles.note, { color: colors.textSecondary }]} allowFontScaling>
          {t('tour.restart_hint')}
        </Text>
      </Card>

      <SectionHeader title={t('profil.privacy')} />
      <PrivacyCard consents={data.consents} setConsent={data.setConsent} />

      <ProfilFooter isModerator={data.isModerator} />

      <Celebration
        visible={data.levelUp != null}
        onDone={data.clearLevelUp}
        title={t('celebrate.levelup_title', { level: data.levelUp ?? 0 })}
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
  badgesHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  badgesCount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
