import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { DisplayFont, Radius, Spacing, Type, useGradients, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

/** Gemeinsames Wochenziel (Fälle am Bodensee). Bewusst als GEMEINSCHAFTSziel,
 *  nicht als persönlicher Druck. Ohne Countdown/FOMO. */
export const WEEKLY_GOAL = 20;

type Props = {
  /** Fälle, die diese Woche gemeldet wurden (gemeinschaftlich). */
  count: number;
  target?: number;
};

/**
 * Wochen-Challenge als Gemeinschaftsziel mit gemeinsamem Fortschrittsbalken
 * (Grün = Aktion/Gemeinschaft). Motiviert über ein geteiltes Ziel, nicht über
 * Verlustangst: kein Timer, keine Strafe, nur „zusammen schaffen wir das".
 */
export function WeeklyChallenge({ count, target = WEEKLY_GOAL }: Props) {
  const colors = useThemeColors();
  const grad = useGradients();
  const { t } = useI18n();

  const safeCount = Math.max(0, Math.floor(count));
  const reached = safeCount >= target;
  const remaining = Math.max(0, target - safeCount);

  return (
    <Card
      accessibilityRole="summary"
      accessibilityLabel={t('home.challenge_a11y', { count: safeCount, target })}
      style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="people" size={18} color={colors.primaryStrong} />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]} allowFontScaling>
            {t('home.challenge_title')}
          </Text>
          <Text style={[styles.goal, { color: colors.textSecondary }]} allowFontScaling>
            {t('home.challenge_goal', { target })}
          </Text>
        </View>
        <Text style={[styles.count, { color: colors.primaryStrong }]} allowFontScaling>
          {safeCount}
          <Text style={[styles.countTotal, { color: colors.textSecondary }]}>/{target}</Text>
        </Text>
      </View>

      <ProgressBar fraction={safeCount / target} fillColors={grad.brand} height={12} />

      <Text
        style={[styles.footer, { color: reached ? colors.primaryStrong : colors.textSecondary }]}
        allowFontScaling>
        {reached ? t('home.challenge_reached') : t('home.challenge_remaining', { count: remaining })}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 1 },
  title: { ...Type.label, fontWeight: '700' },
  goal: { ...Type.caption },
  count: { fontFamily: DisplayFont.bold, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countTotal: { fontSize: 15, fontWeight: '600' },
  footer: { ...Type.caption },
});
