import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from './Confetti';
import { Mascot, type MascotPose } from './Mascot';
import { DisplayFont, Radius, Spacing, Type, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  visible: boolean;
  onDone: () => void;
  title: string;
  message: string;
  pose?: MascotPose;
  /** Automatischer Abschluss nach dieser Zeit (ms). Tippen schließt sofort. */
  autoHideMs?: number;
};

/**
 * Feier-Overlay für echte Meilensteine (Fallabschluss, Level-up): Konfetti,
 * Maskottchen, kurze Botschaft, Erfolgs-Haptik. Bewusst kurz und schließbar
 * (kein Zwang, kein Timer-Druck). Respektiert „Bewegung reduzieren": dann kein
 * Konfetti und kein Einschwingen, nur die Botschaft und die Haptik.
 */
export function Celebration({ visible, onDone, title, message, pose = 'celebrate', autoHideMs = 3600 }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    enter.value = reduceMotion ? 1 : withTiming(1, { duration: 360, easing: Easing.out(Easing.back(1.4)) });
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Gerät ohne Haptik-Motor: bewusst ignorieren.
    }
    const id = setTimeout(onDone, autoHideMs);
    return () => {
      clearTimeout(id);
      enter.value = 0;
    };
  }, [visible, reduceMotion, autoHideMs, onDone, enter]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.85 + enter.value * 0.15 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        accessibilityRole="button"
        accessibilityLabel={t('celebrate.dismiss_a11y')}
        onPress={onDone}>
        {visible && <Confetti />}
        <Animated.View
          accessibilityRole="alert"
          style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }, cardStyle]}>
          <Mascot pose={pose} size={104} />
          <Text style={[styles.title, { color: colors.text }]} allowFontScaling>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]} allowFontScaling>
            {message}
          </Text>
          <View style={[styles.hintPill, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
              {t('celebrate.tap_to_continue')}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: { fontFamily: DisplayFont.bold, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { ...Type.bodyLarge, textAlign: 'center' },
  hintPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.one,
  },
  hint: { ...Type.caption, fontWeight: '600' },
});
