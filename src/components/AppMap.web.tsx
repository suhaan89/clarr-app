// Web-Fallback für AppMap: react-native-maps hat keine Web-Unterstützung
// (importiert native Codegen-Module). Statt die ganze App im Web zu brechen,
// zeigt der Platzhalter den Hinweis, dass die Karte nur in der App existiert.
// Overlays des Screens (Legende, Aktualisieren-Button) funktionieren weiter.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  // Von der nativen Karte bekannte Props – hier bewusst ignoriert.
  initialRegion?: unknown;
  children?: ReactNode;
};

export function MapView({ style, accessibilityLabel }: MapViewProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View
      style={[styles.fallback, { backgroundColor: colors.background }, style]}
      accessibilityLabel={accessibilityLabel}>
      <Ionicons name="map-outline" size={48} color={colors.textSecondary} />
      <Text style={[styles.title, { color: colors.text }]} allowFontScaling>
        {t('map.web_fallback_title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]} allowFontScaling>
        {t('map.web_fallback_body')}
      </Text>
    </View>
  );
}

/** Marker existieren nur auf der echten Karte – im Web nichts rendern. */
export function MapMarker(_props: { children?: ReactNode; [key: string]: unknown }) {
  return null;
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', maxWidth: 320 },
});
