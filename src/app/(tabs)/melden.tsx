import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
type Result = 'ok-camera' | 'ok-gallery' | 'offline' | 'error';

export default function MeldenScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

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

  async function takePhoto() {
    // In-App-Kamera: Foto entsteht JETZT und HIER -> wertbar (Punkte).
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
      setSource('camera');
      setStep('details');
      // Advisory-Analyse on-device – rein informativ, blockiert nie die Meldung.
      vision.analyze(photo.uri);
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
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const item: PendingReport = {
        clientKey: newClientKey(), // EINMAL erzeugt – verhindert Doppel-Sync
        description: description.trim().slice(0, 500),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        mocked: loc.mocked === true, // ehrlich mitsenden; Server bewertet
        source,
        photoUris: [photoUri],
        createdAt: new Date().toISOString(),
      };
      // Immer erst in die Queue, dann Sync-Versuch: App-Absturz oder
      // Funkloch verlieren nichts, und der clientKey entdoppelt Retries.
      await enqueueReport(item);
      const sync = await syncQueue();
      setResult(
        sync.remaining === 0 ? (source === 'camera' ? 'ok-camera' : 'ok-gallery') : 'offline'
      );
      setStep('fertig');
    } catch {
      setResult('error');
      setStep('fertig');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhotoUri(null);
    setDescription('');
    setStep('foto');
    vision.reset();
  }

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
        <VisionAdvisory status={vision.status} result={vision.result} />
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
    error: { icon: 'location-outline' as const, title: t('report.error_title'), body: t('report.error_location') },
  }[result];

  return (
    <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
      <EmptyState icon={resultView.icon} title={resultView.title} body={resultView.body}>
        <View style={styles.permissionActions}>
          <Button
            label={t('report.new')}
            accessibilityLabel={t('report.new_a11y')}
            onPress={reset}
            icon="camera-outline"
          />
        </View>
      </EmptyState>
    </View>
  );
}

/**
 * Advisory-Hinweis der On-Device-Erkennung. Rein informativ: er zeigt „könnte
 * Müll sein" / „wahrscheinlich kein Müll" / „unsicher" mit Confidence,
 * blockiert die Meldung aber nie. Fehlt das Modell, erscheint ein dezenter
 * „nicht verfügbar"-Hinweis.
 */
function VisionAdvisory({ status, result }: { status: VisionStatus; result: VisionResult | null }) {
  const colors = useThemeColors();
  const { t } = useI18n();

  if (status === 'idle') return null;

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

  const percent = Math.round(result.confidence * 100);
  const meta: Record<
    VisionResult['verdict'],
    { icon: IoniconName; bg: string; fg: string; title: string; showPct: boolean }
  > = {
    trash: {
      icon: 'checkmark-circle',
      bg: colors.successSoft,
      fg: colors.primaryStrong,
      title: t('report.vision_trash'),
      showPct: true,
    },
    'no-trash': {
      icon: 'information-circle',
      bg: colors.warningSoft,
      fg: colors.warning,
      title: t('report.vision_no_trash'),
      showPct: true,
    },
    uncertain: {
      icon: 'help-circle',
      bg: colors.backgroundSelected,
      fg: colors.textSecondary,
      title: t('report.vision_uncertain'),
      showPct: false,
    },
  };
  const m = meta[result.verdict];
  const confidenceText = t('report.vision_confidence', { percent });
  const a11yLabel = m.showPct ? `${m.title}. ${confidenceText}. ${t('report.vision_advisory_note')}` : m.title;

  return (
    <Card style={{ backgroundColor: m.bg }}>
      <View
        style={styles.visionRow}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={a11yLabel}>
        <Ionicons name={m.icon} size={22} color={m.fg} />
        <View style={styles.visionText}>
          <Text style={[styles.visionTitle, { color: m.fg }]} allowFontScaling>
            {m.title}
          </Text>
          <Text style={[styles.visionNote, { color: colors.textSecondary }]} allowFontScaling>
            {m.showPct ? `${confidenceText} · ${t('report.vision_advisory_note')}` : t('report.vision_advisory_note')}
          </Text>
        </View>
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
  galleryHint: { fontSize: 14, lineHeight: 20 },
  privacyRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  privacyNote: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  detailActions: { gap: Spacing.two },
});
