import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Shadow, Spacing, Type, useThemeColors } from '@/constants/theme';
import { type Achievement } from '@/lib/achievements';
import { useI18n, type TranslationKey } from '@/lib/i18n';

/** Einzelnes Medaillon. Verdient = warmes Bernstein mit Haekchen; noch offen =
 *  ruhig gedaempft mit Fortschritt (x/ziel). Reward-Domaene, daher Accent. */
export function AchievementMedal({ item }: { item: Achievement }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const title = t(`badge.${item.id}.title` as TranslationKey);
  const desc = t(`badge.${item.id}.desc` as TranslationKey);

  return (
    <View
      style={styles.item}
      accessibilityRole="image"
      accessibilityLabel={
        item.earned
          ? t('badge.earned_a11y', { title, desc })
          : t('badge.locked_a11y', { title, current: item.current, target: item.target })
      }>
      <View
        style={[
          styles.medal,
          item.earned
            ? [{ backgroundColor: colors.accent }, Shadow]
            : { backgroundColor: colors.backgroundSelected },
        ]}>
        <Ionicons
          name={item.icon as keyof typeof Ionicons.glyphMap}
          size={26}
          color={item.earned ? colors.onAccent : colors.textSecondary}
        />
        {item.earned && (
          <View style={[styles.check, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
          </View>
        )}
      </View>
      <Text
        style={[styles.title, { color: item.earned ? colors.text : colors.textSecondary }]}
        numberOfLines={2}
        allowFontScaling>
        {title}
      </Text>
      {!item.earned && (
        <Text style={[styles.progress, { color: colors.textSecondary }]} allowFontScaling>
          {item.current}/{item.target}
        </Text>
      )}
    </View>
  );
}

/** Raster aller Abzeichen (drei pro Reihe). */
export function Badges({ items }: { items: Achievement[] }) {
  return (
    <View style={styles.grid}>
      {items.map((a) => (
        <AchievementMedal key={a.id} item={a} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  item: { width: '31%', alignItems: 'center', gap: Spacing.one },
  medal: {
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Type.tiny, fontWeight: '600', textAlign: 'center' },
  progress: { ...Type.tiny, fontVariant: ['tabular-nums'] },
});
