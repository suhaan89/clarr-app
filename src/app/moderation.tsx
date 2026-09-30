// CLAR — Moderations-Screen (Runde 6, Paket B.5)
//
// review_queue/moderate_report/approve_photo existieren serverseitig
// vollstaendig (Migration 010), hatten aber keine Client-UI — das
// Fail-Safe-Flagging war dadurch praktisch wirkungslos, solange niemand
// die Queue abarbeiten kann. Nur fuer user_profiles.role = 'moderator'
// erreichbar (kein Tab-Eintrag, nur ein Link im Profil-Screen); die
// eigentliche Durchsetzung passiert serverseitig ueber RLS/is_moderator().

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, LoadingState } from '@/components';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
import { blurredPhotoUrl } from '@/lib/api';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type QueueRow = { id: number; report_id: string; reason: string; created_at: string };
type ReportRow = { id: string; status: string; waste_type: string | null };
type PhotoRow = { id: string; report_id: string; blurred_path: string | null; approved: boolean };

const REASON_KEYS = new Set([
  'geflaggt', 'confidence', 'stichprobe', 'privatgrund',
  'unklassifiziert', 'personen_im_bild', 'standort_suspekt', 'duplikat_verdacht',
]);

export default function ModerationScreen() {
  const colors = useThemeColors();
  const { t, dateLocale } = useI18n();
  const { session } = useSession();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [reports, setReports] = useState<Record<string, ReportRow>>({});
  const [photos, setPhotos] = useState<Record<string, PhotoRow[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setChecking(true);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    const isModerator = profile?.role === 'moderator';
    setAllowed(isModerator);
    setChecking(false);
    if (!isModerator) return;

    setLoading(true);
    const { data: rows } = await supabase
      .from('review_queue')
      .select('id, report_id, reason, created_at')
      .eq('status', 'offen')
      .order('created_at', { ascending: true })
      .limit(50);
    const queueRows = (rows as QueueRow[]) ?? [];
    setQueue(queueRows);

    const reportIds = [...new Set(queueRows.map((r) => r.report_id))];
    if (reportIds.length > 0) {
      const [{ data: reportRows }, { data: photoRows }] = await Promise.all([
        supabase.from('reports').select('id, status, waste_type').in('id', reportIds),
        supabase.from('report_photos').select('id, report_id, blurred_path, approved').in('report_id', reportIds),
      ]);
      const reportMap: Record<string, ReportRow> = {};
      for (const r of (reportRows as ReportRow[]) ?? []) reportMap[r.id] = r;
      setReports(reportMap);

      const photoMap: Record<string, PhotoRow[]> = {};
      for (const p of (photoRows as PhotoRow[]) ?? []) {
        (photoMap[p.report_id] ??= []).push(p);
      }
      setPhotos(photoMap);
    } else {
      setReports({});
      setPhotos({});
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function decideReport(row: QueueRow, decision: 'freigeben' | 'ablehnen' | 'privat') {
    setBusyId(row.id);
    const { data, error } = await supabase.rpc('moderate_report', {
      p_report_id: row.report_id,
      p_decision: decision,
    });
    setBusyId(null);
    if (error || !data?.ok) {
      Alert.alert(t('moderation.error_generic'));
      return;
    }
    load();
  }

  async function decidePhoto(photoId: string, approve: boolean) {
    setBusyPhotoId(photoId);
    const { data, error } = await supabase.rpc('approve_photo', {
      p_photo_id: photoId,
      p_approve: approve,
    });
    setBusyPhotoId(null);
    if (error || !data?.ok) {
      Alert.alert(t('moderation.error_generic'));
      return;
    }
    load();
  }

  if (checking) {
    return <LoadingState label={t('moderation.loading')} />;
  }

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('moderation.access_denied_title')}
          body={t('moderation.access_denied_body')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      {loading ? (
        <LoadingState label={t('moderation.loading')} />
      ) : queue.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title={t('moderation.empty_title')} body={t('moderation.empty_body')} />
      ) : (
        queue.map((row) => {
          const report = reports[row.report_id];
          const reportPhotos = photos[row.report_id] ?? [];
          const reasonLabel = REASON_KEYS.has(row.reason)
            ? t(`moderation.reason.${row.reason}` as TranslationKey)
            : row.reason;
          const busy = busyId === row.id;

          return (
            <Card key={row.id} style={styles.card} accessibilityLabel={t('moderation.report_a11y', { id: row.report_id.slice(0, 8) })}>
              <View style={styles.headRow}>
                <Badge label={reasonLabel} tone="warning" icon="flag-outline" />
                <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
                  {new Date(row.created_at).toLocaleString(dateLocale)}
                </Text>
              </View>

              {report?.waste_type && (
                <Text style={[styles.wasteType, { color: colors.text }]} allowFontScaling>
                  {report.waste_type}
                </Text>
              )}

              {reportPhotos.length === 0 ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
                  {t('moderation.no_photos')}
                </Text>
              ) : (
                <View style={styles.photoRow}>
                  {reportPhotos.map((p) =>
                    p.blurred_path ? (
                      <View key={p.id} style={styles.photoWrap}>
                        <Image source={{ uri: blurredPhotoUrl(p.blurred_path) }} style={styles.photo} />
                        <Badge
                          label={p.approved ? t('moderation.photo_approved') : t('moderation.photo_pending_review')}
                          tone={p.approved ? 'success' : 'neutral'}
                        />
                        <Button
                          label={p.approved ? t('moderation.reject_photo') : t('moderation.approve_photo')}
                          variant={p.approved ? 'destructive' : 'secondary'}
                          onPress={() => decidePhoto(p.id, !p.approved)}
                          loading={busyPhotoId === p.id}
                        />
                      </View>
                    ) : (
                      <Text key={p.id} style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
                        {t('moderation.photo_pending')}
                      </Text>
                    )
                  )}
                </View>
              )}

              <View style={styles.actionRow}>
                <Button label={t('moderation.approve_report')} onPress={() => decideReport(row, 'freigeben')} loading={busy} />
                <Button label={t('moderation.reject_report')} variant="destructive" onPress={() => decideReport(row, 'ablehnen')} loading={busy} />
              </View>
              <Button label={t('moderation.privat_report')} variant="ghost" onPress={() => decideReport(row, 'privat')} loading={busy} />
              <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
                {t('moderation.privat_hint')}
              </Text>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { gap: Spacing.two },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { ...Type.meta },
  wasteType: { fontSize: 15, fontWeight: '600' },
  photoRow: { gap: Spacing.two },
  photoWrap: { gap: Spacing.one },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8 },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  hint: { fontSize: 12, lineHeight: 16 },
});
