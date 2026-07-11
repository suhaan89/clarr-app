import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, EmptyState, Input } from '@/components';
import { Radius, Spacing, useThemeColors } from '@/constants/theme';
import { newClientKey, type PendingReport, type PhotoSource } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { enqueueReport, readQueue, syncQueue } from '@/lib/offline-queue';

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
      setPhotoUri(res.assets[0].uri);
      setSource('gallery');
      setStep('details');
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
        clientKey: newClientKey(), // EINMAL erzeugt — verhindert Doppel-Sync
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
            <Text style={styles.queueBadge} accessibilityLiveRegion="polite" allowFontScaling>
              {t('report.queue_badge', { count: queueLength })}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('report.shutter_a11y')}
            onPress={takePhoto}
            style={({ pressed }) => [styles.shutterOuter, pressed && styles.pressed]}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('report.gallery_a11y')}
            onPress={pickFromGallery}
            style={({ pressed }) => [styles.galleryButton, pressed && styles.pressed]}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={styles.galleryLabel} allowFontScaling>
              {t('report.gallery_short')}
            </Text>
          </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  galleryLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  queueBadge: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    fontSize: 13,
    overflow: 'hidden',
  },
  details: { padding: Spacing.four, gap: Spacing.three },
  preview: { width: '100%', aspectRatio: 4 / 3 },
  galleryHint: { fontSize: 14, lineHeight: 20 },
  privacyRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  privacyNote: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  detailActions: { gap: Spacing.two },
  pressed: { opacity: 0.7 },
});
