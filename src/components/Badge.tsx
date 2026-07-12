import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useThemeColors } from '@/constants/theme';

type Tone = 'success' | 'danger' | 'warning' | 'neutral';

type Props = {
  label: string;
  tone?: Tone;
  /** Aussagekräftiges Icon vor dem Label – bevorzugt für Status (nicht nur Farbe). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Kleiner Farbpunkt vor dem Label (Alternative zum Icon). */
  dot?: boolean;
};

/** Status-Pille, z. B. „Erledigt", „Voll belegt", „Du bist dabei". */
export function Badge({ label, tone = 'neutral', icon, dot = false }: Props) {
  const colors = useThemeColors();
  const palette = {
    success: { bg: colors.successSoft, fg: colors.primaryStrong },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    neutral: { bg: colors.backgroundSelected, fg: colors.textSecondary },
  }[tone];

  return (
    <View style={[styles.base, { backgroundColor: palette.bg }]}>
      {icon ? (
        <Ionicons name={icon} size={14} color={palette.fg} />
      ) : dot ? (
        <View style={[styles.dot, { backgroundColor: palette.fg }]} />
      ) : null}
      <Text style={[styles.label, { color: palette.fg }]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
