// Open-Source-Lizenzhinweise.
//
// CLAR nutzt freie Software. MIT, ISC, BSD und Apache 2.0 verlangen, dass
// Urheberrechts- und Lizenzhinweis mitgeliefert werden; in einer mobilen App
// ist ein erreichbarer Lizenz-Bildschirm der uebliche Weg.
//
// Die Liste ist der Stand der DIREKTEN Abhaengigkeiten aus package.json. Sie
// wird beim Aktualisieren von Abhaengigkeiten mit gepflegt — der Befehl dafuer
// steht in docs/ops.md.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
import { POLICY_DATE } from '@/constants/legal';
import { useI18n } from '@/lib/i18n';

type Dependency = { name: string; version: string; license: string };

const DEPENDENCIES: Dependency[] = [
  { name: '@expo/ui', version: '0.2.0', license: 'MIT' },
  { name: '@react-native-async-storage/async-storage', version: '2.2.0', license: 'MIT' },
  { name: '@react-native-community/netinfo', version: '11.4.1', license: 'MIT' },
  { name: '@react-navigation/native', version: '7.3.8', license: 'MIT' },
  { name: '@rn-primitives/dialog', version: '1.5.2', license: 'MIT' },
  { name: '@rn-primitives/slot', version: '1.5.2', license: 'MIT' },
  { name: '@supabase/supabase-js', version: '2.110.2', license: 'MIT' },
  { name: '@wrack/react-native-tour-guide', version: '1.0.1', license: 'MIT' },
  { name: 'aes-js', version: '3.1.2', license: 'MIT' },
  { name: 'base64-arraybuffer', version: '1.0.2', license: 'MIT' },
  { name: 'class-variance-authority', version: '0.7.1', license: 'Apache-2.0' },
  { name: 'clsx', version: '2.1.1', license: 'MIT' },
  { name: 'expo', version: '54.0.35', license: 'MIT' },
  { name: 'expo-camera', version: '17.0.10', license: 'MIT' },
  { name: 'expo-constants', version: '18.0.13', license: 'MIT' },
  { name: 'expo-crypto', version: '15.0.9', license: 'MIT' },
  { name: 'expo-dev-client', version: '6.0.21', license: 'MIT' },
  { name: 'expo-device', version: '8.0.10', license: 'MIT' },
  { name: 'expo-file-system', version: '19.0.23', license: 'MIT' },
  { name: 'expo-font', version: '14.0.12', license: 'MIT' },
  { name: 'expo-glass-effect', version: '0.1.10', license: 'MIT' },
  { name: 'expo-haptics', version: '15.0.8', license: 'MIT' },
  { name: 'expo-image', version: '3.0.11', license: 'MIT' },
  { name: 'expo-image-manipulator', version: '14.0.8', license: 'MIT' },
  { name: 'expo-image-picker', version: '17.0.11', license: 'MIT' },
  { name: 'expo-linear-gradient', version: '15.0.8', license: 'MIT' },
  { name: 'expo-linking', version: '8.0.12', license: 'MIT' },
  { name: 'expo-location', version: '19.0.8', license: 'MIT' },
  { name: 'expo-router', version: '6.0.24', license: 'MIT' },
  { name: 'expo-secure-store', version: '15.0.8', license: 'MIT' },
  { name: 'expo-splash-screen', version: '31.0.13', license: 'MIT' },
  { name: 'expo-status-bar', version: '3.0.9', license: 'MIT' },
  { name: 'expo-symbols', version: '1.0.8', license: 'MIT' },
  { name: 'expo-system-ui', version: '6.0.9', license: 'MIT' },
  { name: 'expo-web-browser', version: '15.0.11', license: 'MIT' },
  { name: 'jpeg-js', version: '0.4.4', license: 'BSD-3-Clause' },
  { name: 'lucide-react-native', version: '1.30.0', license: 'ISC' },
  { name: 'nativewind', version: '4.2.6', license: 'MIT' },
  { name: 'react', version: '19.1.0', license: 'MIT' },
  { name: 'react-dom', version: '19.1.0', license: 'MIT' },
  { name: 'react-native', version: '0.81.5', license: 'MIT' },
  { name: 'react-native-fast-tflite', version: '3.0.1', license: 'MIT' },
  { name: 'react-native-gesture-handler', version: '2.28.0', license: 'MIT' },
  { name: 'react-native-maps', version: '1.20.1', license: 'MIT' },
  { name: 'react-native-nitro-modules', version: '0.36.1', license: 'MIT' },
  { name: 'react-native-reanimated', version: '4.1.7', license: 'MIT' },
  { name: 'react-native-safe-area-context', version: '5.6.2', license: 'MIT' },
  { name: 'react-native-screens', version: '4.16.0', license: 'MIT' },
  { name: 'react-native-svg', version: '15.12.1', license: 'MIT' },
  { name: 'react-native-url-polyfill', version: '3.0.0', license: 'MIT' },
  { name: 'react-native-web', version: '0.21.2', license: 'MIT' },
  { name: 'react-native-worklets', version: '0.5.1', license: 'MIT' },
  { name: 'tailwind-merge', version: '3.6.0', license: 'MIT' },
  { name: 'tailwindcss', version: '3.4.19', license: 'MIT' },
  { name: 'tailwindcss-animate', version: '1.0.7', license: 'MIT' },
];

export default function LizenzenScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
        allowFontScaling>
        {t('legal.licenses_title')}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
        {t('legal.updated', { date: POLICY_DATE })}
      </Text>
      <Card tone="soft">
        <Text style={[styles.intro, { color: colors.textSecondary }]} allowFontScaling>
          {t('legal.licenses_intro')}
        </Text>
      </Card>
      <Card>
        {DEPENDENCIES.map((dep) => (
          <View key={dep.name} style={styles.row}>
            <Text style={[styles.name, { color: colors.text }]} allowFontScaling>
              {dep.name} {dep.version}
            </Text>
            <Text style={[styles.license, { color: colors.textSecondary }]} allowFontScaling>
              {dep.license}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { ...Type.title },
  meta: { ...Type.meta },
  intro: { fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 32,
  },
  name: { fontSize: 14, flexShrink: 1 },
  license: { fontSize: 13 },
});
