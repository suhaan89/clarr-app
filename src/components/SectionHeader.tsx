import { StyleSheet, Text } from 'react-native';

import { DisplayFont, Spacing, useThemeColors } from '@/constants/theme';

/** Abschnittsüberschrift mit einheitlichem Abstand nach oben. */
export function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]} allowFontScaling>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: DisplayFont.regular,
    fontSize: 17,
    fontWeight: '700',
    marginTop: Spacing.four,
    marginBottom: Spacing.one,
  },
});
