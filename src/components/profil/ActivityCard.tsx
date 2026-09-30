// Letzte Punkte-Buchungen aus dem serverseitigen Ledger (nur Anzeige).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { SkeletonLine } from '@/components/Skeleton';
import { Spacing, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type { LedgerRow } from '@/lib/useProfilData';

import { profilStyles } from './styles';

const REASON_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  report_verified: 'checkmark-circle-outline',
  case_confirmed: 'people-outline',
  case_closed_after: 'sparkles-outline',
};

export function ActivityCard({ ledger, loaded }: { ledger: LedgerRow[]; loaded: boolean }) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <Card style={profilStyles.sectionCard}>
      {!loaded ? (
        <>
          <SkeletonLine />
          <SkeletonLine />
        </>
      ) : ledger.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.no_points')}
        </Text>
      ) : (
        ledger.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Ionicons
              name={REASON_ICONS[entry.reason] ?? 'ellipse-outline'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.reason, { color: colors.text }]} allowFontScaling>
              {/* Unbekannte Server-Reasons werden roh angezeigt statt uebersetzt. */}
              {entry.reason in REASON_ICONS
                ? t(`reason.${entry.reason}` as TranslationKey)
                : entry.reason}
            </Text>
            <Text
              style={[
                styles.delta,
                { color: entry.delta > 0 ? colors.primaryStrong : colors.danger },
              ]}
              allowFontScaling>
              {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  reason: { fontSize: 15, flex: 1 },
  delta: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
