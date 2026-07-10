import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// !!! PLATZHALTER — JURISTISCH PRUEFEN !!!
// Anbieterkennzeichnung (§ 5 DDG) muss vor Release vollstaendig und
// juristisch geprueft sein. KEINE echten Privatadressen der (schuelerischen)
// Betreiber ohne Beratung veroeffentlichen — Alternativen pruefen.
export default function ImpressumScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        Impressum
      </Text>
      <Text style={[styles.warn, { color: '#C0392B' }]} allowFontScaling>
        ENTWURF — JURISTISCH PRUEFEN, vor Release ersetzen.
      </Text>
      <Text style={[styles.body, { color: colors.text }]} allowFontScaling>
        Anbieter: [JURISTISCH PRUEFEN — Name/Organisation]{'\n'}
        Anschrift: [JURISTISCH PRUEFEN — ladungsfähige Anschrift]{'\n'}
        Kontakt: [JURISTISCH PRUEFEN — E-Mail]{'\n'}
        Verantwortlich i. S. d. § 18 MStV: [JURISTISCH PRUEFEN]
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 24, fontWeight: '700' },
  warn: { fontSize: 14, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 24 },
});
