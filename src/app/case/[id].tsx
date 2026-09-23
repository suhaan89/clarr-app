import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Badge, Button, Card, Celebration, EmptyState, LoadingState, PressableScale } from '@/components';
import { getCaseStatus, isOpenStatus } from '@/constants/status';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
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

type ReportRow = {
  id: string;
  status: string;
  verification: string;
  ai_confidence: number | null;
};

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  // Unterscheidet "laedt noch" von "geladen, aber nicht gefunden/RLS
  // verweigert" — sonst haengt der Screen bei einem ungueltigen/fremden
  // Link fuer immer im Spinner (Paket G.29).
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [reportIds, setReportIds] = useState<string[]>([]);
  // Der urspruengliche Report des Falls (aeltester) – traegt KI-Verdikt und
  // Status fuer die Transparenz-/Widerspruchs-Anzeige (Automatisierte
  // Entscheidungen, Art. 22 DSGVO / Art. 17 DSA).
  const [primaryReport, setPrimaryReport] = useState<ReportRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  // Sanfter Fade/Scale-Uebergang, sobald der Fall geladen ist (statt eines
  // harten Umschlags vom Spinner auf den fertigen Inhalt).
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(0);

  const load = useCallback(async () => {
    if (!id) return;
    // Nur die Spalten, die der Screen tatsaechlich anzeigt — kein select('*'),
    // das auch die exakten location_lat/location_lng an den Client schicken
    // wuerde (Fall-Detail zeigt keine Karte, braucht sie nicht).
    const { data: c } = await supabase
      .from('cases')
      .select('id, title, status, created_at')
      .eq('id', id)
      .maybeSingle();
    setCaseRow(c as CaseRow | null);
    if (c) {
      const { data: reportRows } = await supabase
        .from('reports')
        .select('id, status, verification, ai_confidence, created_at')
        .eq('case_id', id)
        .order('created_at', { ascending: true });
      const ids = (reportRows ?? []).map((r) => r.id);
      setReportIds(ids);
      setPrimaryReport((reportRows as ReportRow[] | null)?.[0] ?? null);
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
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!caseRow) return;
    enter.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [caseRow, reduceMotion, enter]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.97 + enter.value * 0.03 }],
  }));

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

  // Widerspruch gegen eine automatisierte Ablehnung (Art. 22 (3) DSGVO,
  // Art. 17 DSA): nutzt bewusst denselben Mechanismus wie das Flaggen
  // (moderation_flags -> review_queue) statt eines neuen Kanals. `note`
  // markiert den Grund fuer die Moderation, ohne den `reason`-Enum
  // (flag_reason) zu erweitern.
  async function requestAppeal() {
    if (!session || reportIds.length === 0) return;
    const { error } = await supabase.from('moderation_flags').insert({
      user_id: session.user.id,
      report_id: reportIds[0],
      reason: 'sonstiges',
      note: 'ki_ablehnung_widerspruch',
    });
    Alert.alert(
      error ? t('profil.error_generic') : t('case.flag_ok_title'),
      error ? t('case.flag_err_body') : t('case.rejected_appeal_ok_body')
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

  if (loading) {
    return <LoadingState label={t('case.loading')} />;
  }

  if (!caseRow) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="help-circle-outline"
          title={t('case.not_found_title')}
          body={t('case.not_found_body')}
        />
      </View>
    );
  }

  const open = isOpenStatus(caseRow.status);
  const status = getCaseStatus(caseRow.status, t);
  // Automatisierte Entscheidung erkennbar machen (Art. 13 (2) (f) DSGVO):
  // verification 'ki_verifiziert' ist IMMER automatisiert (apply_vision_result).
  // ai_confidence gesetzt heisst ebenfalls, dass die KI beteiligt war – auch
  // wenn ein Mensch die Meldung danach noch abgelehnt hat. Im Zweifel wird
  // hier eher zu oft als zu selten auf die KI-Beteiligung hingewiesen.
  const aiInvolved =
    primaryReport != null &&
    (primaryReport.verification === 'ki_verifiziert' || primaryReport.ai_confidence != null);
  const isRejected = primaryReport?.status === 'abgelehnt';

  return (
    <Animated.ScrollView
      style={[{ backgroundColor: colors.background }, enterStyle]}
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

      {aiInvolved && (
        <View
          style={styles.aiBadgeRow}
          accessibilityLabel={t('case.ai_badge_a11y')}>
          <Ionicons name="flash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.aiBadgeLabel, { color: colors.textSecondary }]} allowFontScaling>
            {t('case.ai_badge')}
          </Text>
        </View>
      )}

      {isRejected && (
        <Card style={{ backgroundColor: colors.dangerSoft, gap: Spacing.two }}>
          <View style={styles.rejectedHead}>
            <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.rejectedTitle, { color: colors.danger }]} allowFontScaling>
              {t('case.rejected_title')}
            </Text>
          </View>
          <Text style={[styles.rejectedText, { color: colors.text }]} allowFontScaling>
            {t('case.rejected_summary')}
          </Text>
          <Text style={[styles.rejectedText, { color: colors.text }]} allowFontScaling>
            {aiInvolved ? t('case.rejected_automated') : t('case.rejected_human')}
          </Text>
          <Text style={[styles.rejectedText, { color: colors.text }]} allowFontScaling>
            {t('case.rejected_appeal_info')}
          </Text>
          <Button
            label={t('case.rejected_appeal_button')}
            accessibilityLabel={t('case.rejected_appeal_a11y')}
            onPress={requestAppeal}
            variant="ghost"
            icon="people-outline"
          />
        </Card>
      )}

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

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('case.flag_a11y')}
        onPress={flagCase}
        haptic="light"
        hitSlop={8}
        style={styles.flagButton}>
        <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.flagLabel, { color: colors.textSecondary }]} allowFontScaling>
          {t('case.flag')}
        </Text>
      </PressableScale>

      <Celebration
        visible={celebrate}
        onDone={() => setCelebrate(false)}
        title={t('celebrate.close_title')}
        message={t('celebrate.close_message')}
        pose="celebrate"
      />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { ...Type.title },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  meta: { ...Type.meta, flexShrink: 1 },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  closeAction: { marginTop: Spacing.two },
  aiBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.oneHalf },
  aiBadgeLabel: { fontSize: 12 },
  rejectedHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rejectedTitle: { ...Type.heading },
  rejectedText: { fontSize: 14, lineHeight: 20 },
  flagButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.oneHalf,
  },
  flagLabel: { fontSize: 14 },
});
