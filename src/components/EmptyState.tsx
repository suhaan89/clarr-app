import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useThemeColors } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  /** Optionaler Aktionsbereich unter dem Text (z. B. ein Button). */
  children?: React.ReactNode;
};

/** Freundlicher Leer-/Hinweiszustand: Icon in grüner Kreisfläche + Text. */
export function EmptyState({ icon, title, body, children }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={32} color={colors.primaryStrong} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        {title}
      </Text>
      {body ? (
        <Text style={[styles.body, { color: colors.textSecondary }]} allowFontScaling>
          {body}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
