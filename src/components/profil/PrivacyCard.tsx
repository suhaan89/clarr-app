// Datenschutz-Abschnitt: Einwilligungen (widerrufbar), Datenexport
// (Art. 15/20 DSGVO) und Konto-Loeschung (Art. 17 DSGVO).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Share, Switch, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { useThemeColors } from '@/constants/theme';
import { callFunction } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { clearLocalReportData } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';
import { CONSENT_KEYS, type ConsentKey } from '@/lib/useProfilData';

import { profilStyles } from './styles';

type Props = {
  consents: Record<string, boolean>;
  setConsent: (key: ConsentKey, granted: boolean) => void;
};

export function PrivacyCard({ consents, setConsent }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();

  async function exportData() {
    try {
      const data = await callFunction('export-my-data', {});
      await Share.share({
        title: t('profil.export_share_title'),
        message: JSON.stringify(data, null, 2),
      });
    } catch {
      Alert.alert(t('profil.error_generic'), t('profil.export_error'));
    }
  }

  async function deleteAccount() {
    try {
      await callFunction('delete-account', { confirm: 'KONTO ENDGUELTIG LOESCHEN' });
      // Der Server ist abgeraeumt; jetzt auch das Geraet. Ohne das blieben
      // noch nicht gesendete Meldungen samt Fotos und die Install-ID lokal
      // liegen (Art. 17 DSGVO).
      await clearLocalReportData();
      await supabase.auth.signOut();
    } catch {
      Alert.alert(t('profil.error_generic'), t('profil.delete_error'));
    }
  }

  function confirmDelete() {
    Alert.alert(t('profil.delete_title'), t('profil.delete_body'), [
      { text: t('profil.delete_cancel'), style: 'cancel' },
      { text: t('profil.delete_confirm'), style: 'destructive', onPress: deleteAccount },
    ]);
  }

  return (
    <Card style={profilStyles.sectionCard}>
      {CONSENT_KEYS.map((key) => {
        const label = t(`consent.${key}`);
        return (
          <View key={key} style={profilStyles.switchRow}>
            <Text style={[profilStyles.switchLabel, { color: colors.text }]} allowFontScaling>
              {label}
            </Text>
            <Switch
              accessibilityLabel={t('consent.a11y', { label })}
              value={consents[key] ?? false}
              trackColor={{ true: colors.primary }}
              onValueChange={(granted) => setConsent(key, granted)}
            />
          </View>
        );
      })}
      <Text style={[profilStyles.note, { color: colors.textSecondary }]} allowFontScaling>
        {t('consent.ki_training_hint')}
      </Text>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('profil.export_a11y')}
        onPress={exportData}
        haptic="light"
        style={profilStyles.actionRow}>
        <Ionicons name="download-outline" size={18} color={colors.text} />
        <Text style={[profilStyles.actionLabel, { color: colors.text }]} allowFontScaling>
          {t('profil.export')}
        </Text>
      </PressableScale>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('profil.delete_a11y')}
        onPress={confirmDelete}
        haptic="medium"
        style={profilStyles.actionRow}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={[profilStyles.actionLabel, { color: colors.danger }]} allowFontScaling>
          {t('profil.delete')}
        </Text>
      </PressableScale>
    </Card>
  );
}
