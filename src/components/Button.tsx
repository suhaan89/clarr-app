import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useThemeColors } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
};

/**
 * Standard-Button des Design-Systems. Touch-Ziel >= 48dp, klare
 * Pressed-/Disabled-Zustände, optionales Icon links vom Label.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  accessibilityLabel,
}: Props) {
  const colors = useThemeColors();

  const background =
    variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.primarySoft : 'transparent';
  const labelColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.primaryStrong
        : variant === 'destructive'
          ? colors.danger
          : colors.text;
  const borderStyle =
    variant === 'ghost' || variant === 'destructive'
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: variant === 'destructive' ? colors.danger : colors.border }
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background },
        borderStyle,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={20} color={labelColor} />}
          <Text style={[styles.label, { color: labelColor }]} allowFontScaling>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontSize: 17, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
