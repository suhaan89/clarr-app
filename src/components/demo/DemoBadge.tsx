import { StyleSheet, Text, View } from 'react-native';

import { DisplayFont } from '@/constants/theme';

/** Gut sichtbare Kennzeichnung: alles in src/app/demo ist simuliert. */
export function DemoBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Demo-Modus, Ergebnisse sind simuliert">
      <View style={styles.dot} />
      <Text style={styles.text}>DEMO</Text>
    </View>
  );
}

export const DemoColors = {
  bg: '#0B0D0A',
  card: '#151913',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#F4F1EA',
  textDim: 'rgba(244,241,234,0.62)',
  green: '#3DDC84',
  greenDeep: '#1C8146',
  gold: '#F5C451',
  goldDeep: '#C0761A',
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,196,81,0.7)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: DemoColors.gold },
  text: {
    color: DemoColors.gold,
    fontFamily: DisplayFont.bold,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
  },
});
