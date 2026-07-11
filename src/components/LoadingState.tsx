import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';

/** Zentrierter Ladezustand mit Screenreader-freundlichem Label. */
export function LoadingState({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} accessibilityLabel={label} />
      <Text style={[styles.label, { color: colors.textSecondary }]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  label: { fontSize: 14 },
});
