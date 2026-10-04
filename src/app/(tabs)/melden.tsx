import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, EmptyState, Input, PressableScale } from '@/components';
import { Radius, Spacing, Type, useThemeColors } from '@/constants/theme';
import { newClientKey, type PendingReport, type PhotoSource } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { enqueueReport, readQueue, syncQueue } from '@/lib/offline-queue';
import { useVision, type VisionResult, type VisionStatus } from '@/lib/vision';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Step = 'foto' | 'details' | 'fertig';
type Result =
  | 'ok-camera'
  | 'ok-gallery'
  | 'offline'
  | 'not-active'
  | 'limit'
  | 'rejected'
  | 'error-location'
  | 'error-save';

type Position = Location.LocationObject;

export default function MeldenScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // Sperrt den Ausloeser, solange eine Aufnahme laeuft (Doppel-Tipp).
  const capturing = useRef(false);
  // Standort im Moment der Aufnahme. Erst beim Absenden zu fragen hiesse:
  // wer nach dem Foto weitergeht, meldet den falschen Ort.
  const position = useRef<Promise<Position | null> | null>(null);

  const [step, setStep] = useState<Step>('foto');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [source, setSource] = useState<PhotoSource>('camera');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>('ok-camera');
  const [queueLength, setQueueLength] = useState(0);
  const vision = useVision();

  useEffect(() => {
    readQueue().then((q) => setQueueLength(q.length));
  }, [step]);

  function capturePosition() {
    position.current = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);
  }

  async function takePhoto() {
    if (capturing.current) return;
    capturing.current = true;
    try {
      capturePosition();
      // In-App-Kamera: Foto entsteht JETZT und HIER -> wertbar (Punkte).
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setSource('camera');
        setStep('details');
        // Advisory-Analyse on-device – rein informativ, blockiert nie die Meldung.
        vision.analyze(photo.uri);
      }
    } finally {
      capturing.current = false;
    }
  }

  async function pickFromGallery() {
    // Galerie: Alter/Ort unbekannt -> Meldung ja, Punkte nein (fair &
    // missbrauchssicher; der Server erzwingt das unabhaengig vom Client).
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      const uri = res.assets[0].uri;
      capturePosition();
      setPhotoUri(uri);
      setSource('gallery');
      setStep('details');
      vision.analyze(uri);
    }
  }

  async function submit() {
    if (!photoUri) return;
    setBusy(true);
    try {
      // Standort von der Aufnahme; war er dort nicht zu bekommen (z. B. die
      // Erlaubnis kam erst danach), jetzt noch einmal versuchen.
      let loc = await position.current;
      if (!loc) {
        capturePosition();
        loc = await position.current;
      }
      if (!loc) {
        setResult('error-location');
        setStep('fertig');
        return;
      }
      const item: PendingReport = {
        clientKey: newClientKey(), // EINMAL erzeugt – verhindert Doppel-Sync
        description: description.trim().slice(0, 500),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        mocked: loc.mocked === true, // ehrlich mitsenden; Server bewertet
        source,
        photoUris: [photoUri],
        createdAt: new Date().toISOString(),
        // On-Device-Score nur als Signal mitsenden; der Server vertraut ihm
        // nicht blind und vergibt darauf nie Punkte.
        ondevice:
          vision.status === 'done' && vision.result
            ? { score: vision.result.score, modelVersion: vision.result.modelVersion }
            : null,
      };
      // Immer erst in die Queue, dann Sync-Versuch: App-Absturz oder
      // Funkloch verlieren nichts, und der clientKey entdoppelt Retries.
      await enqueueReport(item);
      const sync = await syncQueue();
      setResult(
        sync.blocked === 'not_active'
          ? 'not-active'
          : sync.blocked === 'limit'
            ? 'limit'
            : sync.rejected > 0
              ? 'rejected'
              : sync.remaining === 0
                ? source === 'camera'
                  ? 'ok-camera'
                  : 'ok-gallery'
                : 'offline'
      );
      setStep('fertig');
    } catch {
      // Standort ist hier schon da: gescheitert ist das Speichern in der Queue.
      setResult('error-save');
      setStep('fertig');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhotoUri(null);
    setDescription('');
    setStep('foto');
    position.current = null;
    vision.reset();
  }

  // Bei einem Fehler vor dem Speichern bleibt das Foto erhalten.
  const canRetry = result === 'error-location' || result === 'error-save';

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  if (step === 'foto') {
    if (!permission?.granted) {
      return (
        <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
          <EmptyState
            icon="camera-outline"
            title={t('report.permission_title')}
            body={t('report.permission_text')}>
            <View style={styles.permissionActions}>
              <Button label={t('report.allow_camera')} onPress={requestPermission} icon="camera" />
              <Button
                label={t('report.gallery_link')}
                accessibilityLabel={t('report.gallery_a11y')}
                onPress={pickFromGallery}
                variant="ghost"
              />
            </View>
          </EmptyState>
        </View>
      );
    }
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraControls}>
          {queueLength > 0 && (
            <Text
              style={[styles.queueBadge, { backgroundColor: colors.overlay }]}
              accessibilityLiveRegion="polite"
              allowFontScaling>
              {t('report.queue_badge', { count: queueLength })}
            </Text>
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('report.shutter_a11y')}
            onPress={takePhoto}
            haptic="medium"
            hitSlop={12}
            containerStyle={styles.shutterOuter}
            style={styles.shutterInner}>
            {null}
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('report.gallery_a11y')}
            onPress={pickFromGallery}
            haptic="light"
            hitSlop={8}
            style={[styles.galleryButton, { backgroundColor: colors.overlay }]}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={styles.galleryLabel} allowFontScaling>
              {t('report.gallery_short')}
            </Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (step === 'details') {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.details}
        keyboardShouldPersistTaps="handled">
        {photoUri && (
          <Card padded={false}>
            <Image
              source={{ uri: photoUri }}
              style={styles.preview}
              accessibilityLabel={t('report.preview_a11y')}
            />
          </Card>
        )}
        <VisionAdvisory status={vision.status} result={vision.result} onRetake={reset} />
        {source === 'gallery' && (
          <Card style={{ backgroundColor: colors.warningSoft }}>
            <Text style={[styles.galleryHint, { color: colors.warning }]} allowFontScaling>
              {t('report.gallery_hint')}
            </Text>
          </Card>
        )}
        <Input
          accessibilityLabel={t('report.desc_a11y')}
          placeholder={t('report.desc_placeholder')}
          multiline
          value={description}
          onChangeText={setDescription}
        />
        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.privacyNote, { color: colors.textSecondary }]} allowFontScaling>
            {t('report.privacy_note')}
          </Text>
        </View>
        {/* Staendig sichtbarer Hinweis zur automatisierten Foto-Pruefung
            (Art. 13 (2) (f) / Art. 22 (3) DSGVO, Art. 17 DSA) – bewusst ohne
            Klapp-Panel, Info-Icon oder Zustimm-Haekchen, da hier keine
            Einwilligung eingeholt wird, sondern informiert wird. */}
        <Card style={{ backgroundColor: colors.backgroundElement }}>
          <View style={styles.visionRow}>
            <Ionicons name="flash-outline" size={18} color={colors.textSecondary} />
            <View style={styles.visionText}>
              <Text style={[styles.visionTitle, { color: colors.text }]} allowFontScaling>
                {t('report.ai_review_title')}
              </Text>
              <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
                {t('report.ai_review_body')}
              </Text>
              {vision.status === 'done' && (
                <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
                  {t('report.ai_ondevice_body')}
                </Text>
              )}
            </View>
          </View>
        </Card>
        {busy ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel={t('report.sending')} />
        ) : (
          <View style={styles.detailActions}>
            <Button label={t('report.submit')} onPress={submit} icon="paper-plane-outline" />
            <Button
              label={t('report.cancel')}
              accessibilityLabel={t('report.cancel_a11y')}
              onPress={reset}
              variant="ghost"
            />
          </View>
        )}
      </ScrollView>
    );
  }

  const resultView = {
    'ok-camera': { icon: 'checkmark-circle' as const, title: t('report.done_title'), body: t('report.done_camera') },
    'ok-gallery': { icon: 'checkmark-circle' as const, title: t('report.done_title'), body: t('report.done_gallery') },
    offline: { icon: 'cloud-offline-outline' as const, title: t('report.offline_title'), body: t('report.done_offline') },
    'not-active': { icon: 'document-text-outline' as const, title: t('report.not_active_title'), body: t('report.not_active_body') },
    limit: { icon: 'time-outline' as const, title: t('report.offline_title'), body: t('report.limit_body') },
    rejected: { icon: 'close-circle-outline' as const, title: t('report.rejected_title'), body: t('report.rejected_body') },
    'error-location': { icon: 'location-outline' as const, title: t('report.error_title'), body: t('report.error_location') },
    'error-save': { icon: 'alert-circle-outline' as const, title: t('report.error_save_title'), body: t('report.error_save') },
  }[result];

  return (
    <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
      <EmptyState icon={resultView.icon} title={resultView.title} body={resultView.body}>
        <View style={styles.permissionActions}>
          {result === 'not-active' && (
            <Button label={t('report.to_rules')} onPress={() => router.push('/regeln')} />
          )}
          {canRetry && (
            <Button label={t('report.retry')} onPress={() => setStep('details')} icon="refresh" />
          )}
          {result === 'error-location' && (
            <Button
              label={t('report.open_settings')}
              onPress={() => Linking.openSettings()}
              variant="secondary"
            />
          )}
          <Button
            label={t('report.new')}
            accessibilityLabel={t('report.new_a11y')}
            onPress={reset}
            icon="camera-outline"
            variant={canRetry || result === 'not-active' ? 'ghost' : 'primary'}
          />
        </View>
      </EmptyState>
    </View>
  );
}

/**
 * Advisory-Hinweis der On-Device-Erkennung. Rein informativ: bei hohem Score
 * „könnte Müll sein", bei niedrigem ein freundliches „Wir erkennen hier
 * keinen Müll, trotzdem melden?" mit der Wahl zwischen neuem Foto und
 * Weitermachen. Der Absende-Knopf bleibt IMMER aktiv. Ohne Modell (Flag aus,
 * nichts geladen) zeigt die Komponente gar nichts.
 */
function VisionAdvisory({
  status,
  result,
  onRetake,
}: {
  status: VisionStatus;
  result: VisionResult | null;
  onRetake: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  // „Trotzdem melden" klappt den Hinweis nur zu; gemeldet wird wie immer
  // über den Absende-Knopf.
  // Der Zustand lebt nur fuer ein Foto: „Neues Foto"/Abbrechen fuehrt in den
  // Kamera-Schritt, dabei wird diese Komponente abgebaut.
  const [dismissed, setDismissed] = useState(false);

  if (status === 'idle' || status === 'skipped') return null;

  if (status === 'analyzing') {
    return (
      <Card style={{ backgroundColor: colors.backgroundElement }}>
        <View style={styles.visionRow} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.visionTitle, { color: colors.text }]} allowFontScaling>
            {t('report.vision_analyzing')}
          </Text>
        </View>
      </Card>
    );
  }

  if (status === 'unavailable' || !result) {
    return (
      <Card style={{ backgroundColor: colors.backgroundElement }}>
        <View style={styles.visionRow}>
          <Ionicons name="flash-off-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
            {t('report.vision_unavailable')}
          </Text>
        </View>
      </Card>
    );
  }

  if (result.verdict === 'trash' || dismissed) {
    const icon: IoniconName = result.verdict === 'trash' ? 'checkmark-circle' : 'information-circle';
    const title = result.verdict === 'trash' ? t('report.vision_trash') : t('report.vision_no_trash_title');
    return (
      <Card style={{ backgroundColor: result.verdict === 'trash' ? colors.successSoft : colors.backgroundElement }}>
        <View
          style={styles.visionRow}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${title}. ${t('report.vision_advisory_note')}`}>
          <Ionicons name={icon} size={22} color={colors.textSecondary} />
          <View style={styles.visionText}>
            <Text style={[styles.visionTitle, { color: colors.text }]} allowFontScaling>
              {title}
            </Text>
            <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
              {t('report.vision_advisory_note')}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const title = t('report.vision_no_trash_title');
  const body = t('report.vision_no_trash_body');
  return (
    <Card style={{ backgroundColor: colors.warningSoft }}>
      <View
        style={styles.visionRow}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title}. ${body}`}>
        <Ionicons name="information-circle" size={22} color={colors.warning} />
        <View style={styles.visionText}>
          <Text style={[styles.visionTitle, { color: colors.warning }]} allowFontScaling>
            {title}
          </Text>
          <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
            {body}
          </Text>
        </View>
      </View>
      <View style={styles.visionActions}>
        <Button
          label={t('report.vision_report_anyway')}
          accessibilityLabel={t('report.vision_report_anyway_a11y')}
          onPress={() => setDismissed(true)}
          variant="ghost"
        />
        <Button
          label={t('report.vision_retake')}
          accessibilityLabel={t('report.vision_retake_a11y')}
          onPress={onRetake}
          icon="camera-outline"
          variant="ghost"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  centerScreen: { flex: 1, justifyContent: 'center' },
  permissionActions: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three },
  cameraControls: {
    position: 'absolute',
    bottom: Spacing.five,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Klassischer Kamera-Ausloeser: weisser Ring + innerer Kreis.
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  galleryButton: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  galleryLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  queueBadge: {
    color: '#fff',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    fontSize: 13,
    overflow: 'hidden',
  },
  details: { padding: Spacing.four, gap: Spacing.three },
  preview: { width: '100%', aspectRatio: 4 / 3 },
  visionRow: { flexDirection: 'row', gap: Spacing.twoHalf, alignItems: 'center' },
  visionText: { flex: 1, gap: 2 },
  visionTitle: { ...Type.heading, flexShrink: 1 },
  visionNote: { ...Type.caption, flexShrink: 1 },
  visionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  galleryHint: { fontSize: 14, lineHeight: 20 },
  privacyRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  privacyNote: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  detailActions: { gap: Spacing.two },
});
