import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Celebration, LoadingState } from '@/components';
import { getCaseStatus, isOpenStatus } from '@/constants/status';
import { DisplayFont, Spacing, useThemeColors } from '@/constants/theme';
import { blurredPhotoUrl, callFunction, uploadOriginal } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type CaseRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type PhotoRow = { id: string; blurred_path: string | null; report_id: string };

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [reportIds, setReportIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: c } = await supabase.from('cases').select('*').eq('id', id).maybeSingle();
    setCaseRow(c as CaseRow | null);
    const { data: reports } = await supabase.from('reports').select('id').eq('case_id', id);
    const ids = (reports ?? []).map((r) => r.id);
    setReportIds(ids);
    if (ids.length > 0) {
      // Anzeige NUR aus public-blurred (approved + blurred_path).
      const { data: ph } = await supabase
        .from('report_photos')
        .select('id, blurred_path, report_id')
        .in('report_id', ids)
        .eq('approved', true)
        .not('blurred_path', 'is', null);
      setPhotos((ph as PhotoRow[]) ?? []);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function flagCase() {
    if (!session || reportIds.length === 0) return;
    // Fail-safe: das Flag nimmt die Meldung SOFORT aus der Öffentlichkeit
    // (Trigger, Paket 8) – bis ein Mensch sie geprüft hat.
    Alert.alert(t('case.flag_title'), t('case.flag_body'), [
      { text: t('case.flag_cancel'), style: 'cancel' },
      { text: t('case.flag_privacy'), onPress: () => submitFlag('personenbezogene_daten') },
      { text: t('case.flag_private_land'), onPress: () => submitFlag('privatgrund_verdacht') },
      { text: t('case.flag_other'), onPress: () => submitFlag('sonstiges') },
    ]);
  }

  async function submitFlag(reason: string) {
    if (!session) return;
    const { error } = await supabase.from('moderation_flags').insert({
      user_id: session.user.id,
      report_id: reportIds[0],
      reason,
    });
    Alert.alert(
      error ? t('profil.error_generic') : t('case.flag_ok_title'),
      error ? t('case.flag_err_body') : t('case.flag_ok_body')
    );
    load();
  }

  async function closeCase() {
    setBusy(true);
    try {
      // Nachher-Foto MUSS frisch aus der Kamera kommen (Anti-Kollusion) –
      // der Server verlangt zusaetzlich Standort <= 100 m am Fall.
      const photo = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (photo.canceled || !photo.assets[0]?.uri) return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const path = await uploadOriginal(photo.assets[0].uri);
      const result = await callFunction<{ ok?: boolean; error?: string }>('close-case', {
        case_id: id,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        mocked: loc.mocked === true,
        photoPaths: [path],
      });
      if (result?.ok) {
        // Feier-Moment statt trockenem Alert: der stärkste Reward ist echte
        // Wirkung („dein gemeldeter Müll ist weg").
        setCelebrate(true);
      } else {
        Alert.alert(
          t('case.close_fail_title'),
          result?.error === 'too_far_from_case' ? t('case.too_far') : t('case.close_fail_body')
        );
      }
      load();
    } catch {
      Alert.alert(t('profil.error_generic'), t('case.close_error'));
    } finally {
      setBusy(false);
    }
  }

  if (!caseRow) {
    return <LoadingState label={t('case.loading')} />;
  }

  const open = isOpenStatus(caseRow.status);
  const status = getCaseStatus(caseRow.status, t);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        {caseRow.title}
      </Text>
      <View
        style={styles.statusRow}
        accessibilityLabel={`${t('case.status_a11y')}: ${status.label}`}>
        <Badge label={status.label} tone={status.tone} icon={status.icon} />
        <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
          {t('case.meta', {
            date: new Date(caseRow.created_at).toLocaleDateString(dateLocale),
            count: reportIds.length,
          })}
        </Text>
      </View>

      {photos.map((p) => (
        <Card key={p.id} padded={false}>
          <Image
            source={{ uri: blurredPhotoUrl(p.blurred_path!) }}
            style={styles.photo}
            accessibilityLabel={t('case.photo_a11y')}
          />
        </Card>
      ))}
      {photos.length === 0 && (
        <Card style={styles.pendingCard}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
            {t('case.photo_pending')}
          </Text>
        </Card>
      )}

      {open && (
        <View style={styles.closeAction}>
          <Button
            label={busy ? t('case.close_busy') : t('case.close')}
            accessibilityLabel={t('case.close_a11y')}
            onPress={closeCase}
            loading={busy}
            icon="camera-outline"
          />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('case.flag_a11y')}
        onPress={flagCase}
        style={({ pressed }) => [styles.flagButton, pressed && styles.pressed]}>
        <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.flagLabel, { color: colors.textSecondary }]} allowFontScaling>
          {t('case.flag')}
        </Text>
      </Pressable>

      <Celebration
        visible={celebrate}
        onDone={() => setCelebrate(false)}
        title={t('celebrate.close_title')}
        message={t('celebrate.close_message')}
        pose="celebrate"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontFamily: DisplayFont.regular, fontSize: 22, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  meta: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  closeAction: { marginTop: Spacing.two },
  flagButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
  },
  flagLabel: { fontSize: 14 },
  pressed: { opacity: 0.6 },
});
