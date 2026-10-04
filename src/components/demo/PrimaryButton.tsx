import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { DemoColors as C } from './DemoBadge';

export function PrimaryButton({
  label,
  icon,
  onPress,
  gold,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  gold?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <LinearGradient
        colors={gold ? [C.gold, C.goldDeep] : [C.green, C.greenDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primary}>
        <Ionicons name={icon} size={20} color={gold ? '#2A1A05' : '#06210F'} />
        <Text style={[styles.primaryText, gold && { color: '#2A1A05' }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#06210F', fontSize: 17, fontWeight: '800' },
});
