// Wochen-Bestenliste: nur mit Opt-in und Pseudonym, Reset jeden Montag.

import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Radius, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import type { BoardRow } from '@/lib/useProfilData';

import { profilStyles } from './styles';

type Props = {
  optIn: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
  board: BoardRow[];
  save: (optIn: boolean) => void;
};

export function LeaderboardCard({ optIn, displayName, setDisplayName, board, save }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <Card style={profilStyles.sectionCard}>
      <View style={profilStyles.switchRow}>
        <Text style={[profilStyles.switchLabel, { color: colors.text }]} allowFontScaling>
          {t('profil.optin')}
        </Text>
        <Switch
          accessibilityLabel={t('profil.optin_a11y')}
          value={optIn}
          onValueChange={save}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {optIn && (
        <Input
          accessibilityLabel={t('profil.pseudonym_a11y')}
          placeholder={t('profil.pseudonym_placeholder')}
          value={displayName}
          onChangeText={setDisplayName}
          onEndEditing={() => save(true)}
          maxLength={24}
        />
      )}
      <Text style={[profilStyles.note, { color: colors.textSecondary }]} allowFontScaling>
        {t('profil.reset_note')}
      </Text>
      {board.map((row) => {
        const top = row.rank <= 3;
        return (
          <View key={`${row.rank}-${row.display_name}`} style={styles.row}>
            <View
              style={[
                styles.rankBubble,
                { backgroundColor: top ? colors.primarySoft : colors.backgroundSelected },
              ]}>
              <Text
                style={[styles.rankText, { color: top ? colors.primaryStrong : colors.textSecondary }]}
                allowFontScaling>
                {row.rank}
              </Text>
            </View>
            <Text style={[styles.name, { color: colors.text }]} allowFontScaling>
              {row.display_name}
            </Text>
            <Text style={[styles.points, { color: colors.textSecondary }]} allowFontScaling>
              {row.points}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  rankBubble: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 15, flex: 1 },
  points: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
