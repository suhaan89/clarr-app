import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * CLAR-Maskottchen „Clari": der freundliche Spross vom Ufer. Rendert die
 * freigestellte 3D-Grafik (transparentes PNG). Die `pose` bleibt in der
 * Schnittstelle, damit spaeter dedizierte Renders (celebrate/levelup/hint)
 * ohne Aenderung am Aufrufcode ergaenzt werden koennen: neue Datei in
 * assets/mascot/ ablegen und in SOURCES eintragen. Solange es nur die
 * Idle-Pose gibt, nutzen alle Auftritte dieselbe Grafik.
 */
export type MascotPose = 'idle' | 'celebrate' | 'levelup' | 'hint';

const IDLE = require('../../assets/mascot/clari-idle.png');

// Sobald es weitere Posen gibt: hier die jeweilige Datei eintragen.
const SOURCES: Record<MascotPose, number> = {
  idle: IDLE,
  celebrate: IDLE,
  levelup: IDLE,
  hint: IDLE,
};

type Props = {
  pose?: MascotPose;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Mascot({ pose = 'idle', size = 96, style, accessibilityLabel }: Props) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? 'Clari, das CLAR-Maskottchen'}
      style={[{ width: size, height: size }, style]}>
      <Image
        source={SOURCES[pose]}
        style={styles.img}
        contentFit="contain"
        accessible={false}
        transition={200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '100%' },
});
