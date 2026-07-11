import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Radius, Spacing, useThemeColors } from '@/constants/theme';

/**
 * Themed-Textfeld mit sichtbarem Fokus-Rahmen (Grün) — Orientierungshilfe
 * auch ohne Farbwahrnehmung, da sich zusätzlich die Rahmenstärke ändert.
 */
export function Input({ style, multiline, onFocus, onBlur, ...rest }: TextInputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      allowFontScaling
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.base,
        multiline && styles.multiline,
        {
          color: colors.text,
          backgroundColor: colors.backgroundElement,
          borderColor: focused ? colors.primary : colors.border,
          borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  multiline: {
    minHeight: 88,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    textAlignVertical: 'top',
  },
});
