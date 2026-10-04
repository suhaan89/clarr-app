import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'none';

type Props = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  /** Style der animierten (skalierenden) Box. */
  style?: StyleProp<ViewStyle>;
  /** Style der äußeren Pressable – z. B. `alignSelf: 'stretch'` für Buttons. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Zielskalierung im gedrückten Zustand (1 = keine). */
  scaleTo?: number;
  /** Taktiles Feedback beim Auslösen. Additiv – Fallback ist lautlos. */
  haptic?: HapticKind;
};

/** Haptik ist rein additiv: auf Web/Simulator ein No-op, nie ein harter Fehler. */
function fireHaptic(kind: HapticKind) {
  if (kind === 'none') return;
  try {
    if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'selection') {
      Haptics.selectionAsync();
    } else {
      Haptics.impactAsync(
        kind === 'heavy'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : kind === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
      );
    }
  } catch {
    // Gerät ohne Haptik-Motor – bewusst ignorieren.
  }
}

/**
 * Druckbare Fläche mit Feder-Skalierung und Haptik – das taktile Grundelement
 * des Design-Systems. Skalierung läuft über den Native-Driver (ruckelfrei,
 * ohne Babel-/Worklet-Abhängigkeit). Reicht Accessibility-Props durch.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.96,
  haptic = 'light',
  onPress,
  disabled,
  ...rest
}: Props) {
  const [scale] = useState(() => new Animated.Value(1));

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      disabled={disabled}
      style={containerStyle}
      onPressIn={() => !disabled && spring(scaleTo)}
      onPressOut={() => spring(1)}
      onPress={(e: GestureResponderEvent) => {
        if (disabled) return;
        fireHaptic(haptic);
        onPress?.(e);
      }}
      {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
