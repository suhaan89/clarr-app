import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card } from '@/components';
import { Spacing, useThemeColors } from '@/constants/theme';

// !!! PLATZHALTER — JURISTISCH PRUEFEN !!!
// Dieser Text ist KEINE gueltige Datenschutzerklaerung. Vor jedem
// oeffentlichen Release muss eine juristisch geprüfte Fassung rein
// (Rechtsgrundlagen, Auftragsverarbeiter, Speicherfristen, Minderjaehrige).
// Bewusst NUR auf Deutsch — Rechtstexte werden nicht maschinell uebersetzt.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Was CLAR speichert',
    body:
      'E-Mail-Adresse (Login), deine Meldungen mit Standort und Zeitpunkt, Fotos ' +
      '(Original privat, veröffentlicht nur anonymisiert), Punkte-Historie und deine ' +
      'Einwilligungen. Kein Klarname, kein Geburtsdatum, keine Werbe-IDs.',
  },
  {
    title: 'Wohin Daten fließen',
    body:
      'Supabase (Hosting/Datenbank/Auth), Anthropic (automatische Foto-Prüfung), ' +
      'optional Expo-Push (Benachrichtigungen) und E-Mail-Versand für den Behörden-Digest ' +
      '(nur anonymisierte Fallinfos). Details: docs/legal/data-flows.md. [JURISTISCH PRÜFEN]',
  },
  {
    title: 'Deine Rechte',
    body:
      'Auskunft (Datenexport im Profil), Löschung (Konto löschen im Profil — entfernt ' +
      'Profil, Meldungen, Fotos samt Kopien und Punkte), Widerruf von Einwilligungen ' +
      'jederzeit im Profil. [JURISTISCH PRÜFEN: Kontakt/Aufsichtsbehörde ergänzen]',
  },
  {
    title: 'Minderjährige',
    body: '[JURISTISCH PRÜFEN: Alters-/Einwilligungslogik, Art. 8 DSGVO]',
  },
];

export default function DatenschutzScreen() {
  const colors = useThemeColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        Datenschutz
      </Text>
      <Card style={{ backgroundColor: colors.dangerSoft }}>
        <Text style={[styles.warn, { color: colors.danger }]} allowFontScaling>
          ENTWURF — JURISTISCH PRÜFEN, vor Release ersetzen.
        </Text>
      </Card>
      {SECTIONS.map((s) => (
        <Text key={s.title} style={[styles.section, { color: colors.text }]} allowFontScaling>
          <Text style={styles.sectionTitle}>{s.title}{'\n'}</Text>
          {s.body}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 24, fontWeight: '700' },
  warn: { fontSize: 14, fontWeight: '600' },
  section: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontWeight: '600' },
});
