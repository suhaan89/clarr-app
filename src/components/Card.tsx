import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Shadow, Spacing, useThemeColors } from '@/constants/theme';

type Props = ViewProps & {
  /** 'soft' = grüne Akzentfläche (z. B. Impact-Held), 'plain' = neutrale Fläche. */
  tone?: 'plain' | 'soft';
  /** Ohne Innenabstand, z. B. wenn ein Bild bündig anliegen soll. */
  padded?: boolean;
};

/** Karten-Grundfläche: runde Ecken, dezenter Schatten, klare Kante. */
export function Card({ tone = 'plain', padded = true, style, children, ...rest }: Props) {
  const colors = useThemeColors();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        Shadow,
        {
          backgroundColor: tone === 'soft' ? colors.primarySoft : colors.backgroundElement,
          borderColor: colors.border,
        },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: { padding: Spacing.three },
});
