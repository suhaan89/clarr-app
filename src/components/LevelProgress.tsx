import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from './ProgressBar';
import { levelProgress, nextRank } from '@/constants/levels';
import { DisplayFont, Radius, Spacing, Type, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  /** Serverseitiger Saldo (View points_level). */
  balance: number;
  /** Rang-Name aus der View (Starter/Bronze/Silber/Gold, uebersetzt angezeigt). */
  levelName: string;
};

/**
 * Fortschritt zur naechsten Stufe. Bernstein/Accent = Belohnung & Waerme
 * (nie Status). Zeigt den aktuellen Rang, den Balken innerhalb der Stufe und
 * den klaren naechsten Schritt („noch X Punkte"). Ableitung nur aus dem
 * Saldo (siehe constants/levels), keine Reward-Logik im Client.
 */
export function LevelProgress({ balance, levelName }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const prog = levelProgress(balance);
  const rank = nextRank(balance);

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.accentSoft }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: prog.pointsIntoLevel }}
      accessibilityLabel={t('level.a11y', {
        level: prog.level,
        points: prog.pointsToNext,
        next: prog.level + 1,
      })}>
      <View style={styles.head}>
        <View style={[styles.levelPill, { backgroundColor: colors.accent }]}>
          <Ionicons name="trophy" size={13} color={colors.onAccent} />
          <Text style={[styles.levelText, { color: colors.onAccent }]} allowFontScaling>
            {t('level.badge', { level: prog.level })}
          </Text>
        </View>
        <Text style={[styles.rankName, { color: colors.accent }]} allowFontScaling numberOfLines={1}>
          {levelName}
        </Text>
        <Text style={[styles.fraction, { color: colors.textSecondary }]} allowFontScaling>
          {prog.pointsIntoLevel}/100
        </Text>
      </View>

      <ProgressBar fraction={prog.fraction} fillColor={colors.accent} trackColor={colors.background} />

      <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
        {t('level.to_next', { points: prog.pointsToNext, next: prog.level + 1 })}
        {rank ? `  ·  ${t('level.next_rank', { rank: rank.name, points: rank.pointsAway })}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  levelText: { fontFamily: DisplayFont.bold, fontSize: 13, fontWeight: '800' },
  rankName: { ...Type.label, fontWeight: '700', flex: 1 },
  fraction: { ...Type.caption, fontVariant: ['tabular-nums'], fontWeight: '600' },
  hint: { ...Type.caption },
});
