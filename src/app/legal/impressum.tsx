import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card } from '@/components';
import { Spacing, useThemeColors } from '@/constants/theme';

// !!! PLATZHALTER – JURISTISCH PRUEFEN !!!
// Anbieterkennzeichnung (§ 5 DDG) muss vor Release vollstaendig und
// juristisch geprueft sein. KEINE echten Privatadressen der (schuelerischen)
// Betreiber ohne Beratung veroeffentlichen – Alternativen pruefen.
// Bewusst NUR auf Deutsch – Rechtstexte werden nicht maschinell uebersetzt.
export default function ImpressumScreen() {
  const colors = useThemeColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        Impressum
      </Text>
      <Card style={{ backgroundColor: colors.dangerSoft }}>
        <Text style={[styles.warn, { color: colors.danger }]} allowFontScaling>
          ENTWURF – JURISTISCH PRÜFEN, vor Release ersetzen.
        </Text>
      </Card>
      <Text style={[styles.body, { color: colors.text }]} allowFontScaling>
        Anbieter: [JURISTISCH PRÜFEN – Name/Organisation]{'\n'}
        Anschrift: [JURISTISCH PRÜFEN – ladungsfähige Anschrift]{'\n'}
        Kontakt: [JURISTISCH PRÜFEN – E-Mail]{'\n'}
        Verantwortlich i. S. d. § 18 MStV: [JURISTISCH PRÜFEN]
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
