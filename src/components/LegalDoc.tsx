// Gemeinsames Geruest fuer alle Rechtstext-Screens (Datenschutz, Impressum,
// Nutzungsbedingungen, Kontaktstelle, Lizenzen).
//
// Warum die Texte NICHT durch src/lib/i18n laufen: Rechtstexte werden bewusst
// nicht maschinell uebersetzt (dieselbe Entscheidung wie bisher in
// legal/datenschutz.tsx und legal/impressum.tsx). Massgeblich ist die deutsche
// Fassung; darauf weist `legal.german_only` in DE und EN hin. Alle
// Bedien-Strings dieses Screens (Titel, Hinweis, Stand) kommen dagegen wie
// vorgeschrieben aus i18n.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

export type LegalSection = {
  /** Ueberschrift des Abschnitts (Deutsch, Rechtstext). */
  heading: string;
  /** Absaetze des Abschnitts (Deutsch, Rechtstext). */
  paragraphs: string[];
};

export function LegalDoc({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
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
        {title}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
        {t('legal.updated', { date: updatedAt })}
      </Text>
      <Card tone="soft">
        <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
          {t('legal.german_only')}
        </Text>
      </Card>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.text }]}
            allowFontScaling>
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              style={[styles.body, { color: colors.text }]}
              allowFontScaling>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { ...Type.title },
  meta: { ...Type.meta },
  hint: { fontSize: 13, lineHeight: 19 },
  section: { gap: Spacing.two },
  heading: { ...Type.heading },
  body: { fontSize: 15, lineHeight: 23 },
});
