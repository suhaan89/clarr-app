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
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { newClientKey, type PendingReport, type PhotoSource } from '@/lib/api';
import { enqueueReport, readQueue, syncQueue } from '@/lib/offline-queue';

type Step = 'foto' | 'details' | 'fertig';

export default function MeldenScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>('foto');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [source, setSource] = useState<PhotoSource>('camera');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultText, setResultText] = useState('');
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
      setResultText(
        sync.remaining === 0
          ? source === 'camera'
            ? 'Danke! Deine Meldung ist eingegangen. Punkte gibt es nach der Prüfung.'
            : 'Danke! Deine Meldung ist eingegangen. (Galerie-Fotos geben keine Punkte.)'
          : 'Gespeichert! Du bist offline — die Meldung wird automatisch gesendet, sobald du wieder Netz hast.'
      );
      setStep('fertig');
    } catch {
      setResultText(
        'Standort nicht verfügbar. Bitte erlaube den Standortzugriff in den Einstellungen — ohne Ort können wir den Müll nicht zuordnen.'
      );
      setStep('fertig');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhotoUri(null);
    setDescription('');
    setResultText('');
    setStep('foto');
  }

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  if (step === 'foto') {
    if (!permission?.granted) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.text, { color: colors.text }]} allowFontScaling>
            CLAR braucht die Kamera, um Müll zu melden. Fotos werden automatisch anonymisiert
            (Gesichter und Kennzeichen), bevor sie jemand sieht.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kamerazugriff erlauben"
            onPress={requestPermission}
            style={styles.primaryButton}>
            <Text style={styles.primaryLabel} allowFontScaling>
              Kamera erlauben
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Foto aus der Galerie wählen, ohne Punkte"
            onPress={pickFromGallery}
            style={styles.linkButton}>
            <Text style={[styles.link, { color: colors.textSecondary }]} allowFontScaling>
              Oder aus der Galerie wählen (ohne Punkte)
            </Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraControls}>
          {queueLength > 0 && (
            <Text style={styles.queueBadge} accessibilityLiveRegion="polite" allowFontScaling>
              {queueLength} Meldung(en) warten auf Sync
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Foto aufnehmen — Meldungen mit der Kamera zählen für Punkte"
            onPress={takePhoto}
            style={styles.shutter}>
            <Ionicons name="camera" size={32} color="#000" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Foto aus der Galerie wählen, ohne Punkte"
            onPress={pickFromGallery}
            style={styles.galleryButton}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.galleryLabel} allowFontScaling>
              Galerie (ohne Punkte)
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
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            accessibilityLabel="Vorschau deines Fotos"
          />
        )}
        {source === 'gallery' && (
          <Text style={[styles.galleryHint, { color: colors.textSecondary }]} allowFontScaling>
            Galerie-Foto: Die Meldung hilft trotzdem — Punkte gibt es nur für Fotos direkt aus
            der App-Kamera.
          </Text>
        )}
        <TextInput
          accessibilityLabel="Beschreibung des Müllfunds, optional"
          placeholder="Was liegt da? (optional)"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />
        <Text style={[styles.privacyNote, { color: colors.textSecondary }]} allowFontScaling>
          Standort und Zeitpunkt werden serverseitig geprüft. Dein Foto wird vor jeder
          Veröffentlichung anonymisiert; das Original bleibt privat.
        </Text>
        {busy ? (
          <ActivityIndicator accessibilityLabel="Meldung wird gesendet" />
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Meldung absenden"
              onPress={submit}
              style={styles.primaryButton}>
              <Text style={styles.primaryLabel} allowFontScaling>
                Meldung absenden
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abbrechen und neues Foto machen"
              onPress={reset}
              style={styles.linkButton}>
              <Text style={[styles.link, { color: colors.textSecondary }]} allowFontScaling>
                Abbrechen
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text
        style={[styles.text, { color: colors.text }]}
        accessibilityLiveRegion="polite"
        allowFontScaling>
        {resultText}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Weitere Meldung erfassen"
        onPress={reset}
        style={styles.primaryButton}>
        <Text style={styles.primaryLabel} allowFontScaling>
          Neue Meldung
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  text: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  cameraControls: {
    position: 'absolute',
    bottom: Spacing.five,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.three,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  galleryLabel: { color: '#fff', fontSize: 15 },
  queueBadge: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
    fontSize: 13,
  },
  details: { padding: Spacing.four, gap: Spacing.three },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  galleryHint: { fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 80,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  privacyNote: { fontSize: 13, lineHeight: 19 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1B7A43',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    alignSelf: 'stretch',
  },
  primaryLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 15 },
});
