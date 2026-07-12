import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Shadow, useGradients } from '@/constants/theme';

/**
 * CLAR-Maskottchen „Clari". PLATZHALTER: rendert vorerst die Marken-Kachel
 * (Blatt), damit Layout und Auftritte schon stehen. Sobald die gerenderten
 * 3D-PNGs unter assets/mascot/ liegen (clari-idle/celebrate/levelup/hint),
 * wird hier nur der Innenteil gegen ein <Image> je `pose` getauscht, die
 * Schnittstelle (pose, size, accessibilityLabel) bleibt gleich.
 */
export type MascotPose = 'idle' | 'celebrate' | 'levelup' | 'hint';

type Props = {
  pose?: MascotPose;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const POSE_ICON: Record<MascotPose, keyof typeof Ionicons.glyphMap> = {
  idle: 'leaf',
  celebrate: 'sparkles',
  levelup: 'trophy',
  hint: 'chatbubble-ellipses',
};

export function Mascot({ pose = 'idle', size = 96, style, accessibilityLabel }: Props) {
  const grad = useGradients();
  const inner = Math.round(size * 0.46);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? 'CLAR'}
      style={[
        styles.tile,
        Shadow,
        { width: size, height: size, borderRadius: Radius.xl + 4 },
        style,
      ]}>
      <LinearGradient
        colors={grad.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl + 4 }]}
      />
      <Ionicons name={POSE_ICON[pose]} size={inner} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
