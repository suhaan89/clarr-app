import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { blurredPhotoUrl, callFunction, uploadOriginal } from '@/lib/api';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type CaseRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type PhotoRow = { id: string; blurred_path: string | null; report_id: string };

const STATUS_LABELS: Record<string, string> = {
  gemeldet: 'Gemeldet',
  geprueft: 'Geprüft',
  weitergeleitet: 'An Behörde weitergeleitet',
  erledigt: 'Erledigt 🎉',
  geschlossen: 'Abgeschlossen',
};

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [reportIds, setReportIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

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
    // (Trigger, Paket 8) — bis ein Mensch sie geprüft hat.
    Alert.alert('Meldung melden', 'Warum sollte sich das jemand ansehen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zeigt Personen/Privates',
        onPress: () => submitFlag('personenbezogene_daten'),
      },
      {
        text: 'Liegt auf Privatgrund',
        onPress: () => submitFlag('privatgrund_verdacht'),
      },
      { text: 'Anderes Problem', onPress: () => submitFlag('sonstiges') },
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
      error ? 'Fehler' : 'Danke!',
      error
        ? 'Das hat leider nicht geklappt. Bitte versuche es erneut.'
        : 'Die Meldung ist jetzt unsichtbar, bis unser Team sie geprüft hat.'
    );
    load();
  }

  async function closeCase() {
    setBusy(true);
    try {
      // Nachher-Foto MUSS frisch aus der Kamera kommen (Anti-Kollusion) —
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
        Alert.alert('Stark! 💪', 'Der Fall ist als erledigt markiert. Danke fürs Aufräumen!');
      } else {
        Alert.alert(
          'Das hat nicht geklappt',
          result?.error === 'too_far_from_case'
            ? 'Du musst dafür vor Ort sein (max. 100 m entfernt).'
            : 'Der Fall konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
        );
      }
      load();
    } catch {
      Alert.alert('Fehler', 'Abschluss nicht möglich. Prüfe Kamera- und Standortfreigabe.');
    } finally {
      setBusy(false);
    }
  }

  if (!caseRow) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel="Fall wird geladen" />
      </View>
    );
  }

  const open = ['gemeldet', 'geprueft', 'weitergeleitet'].includes(caseRow.status);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
        {caseRow.title}
      </Text>
      <Text
        style={[styles.status, { color: open ? '#C0392B' : '#1B7A43' }]}
        accessibilityLabel={`Status: ${STATUS_LABELS[caseRow.status] ?? caseRow.status}`}
        allowFontScaling>
        {STATUS_LABELS[caseRow.status] ?? caseRow.status}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
        Gemeldet am {new Date(caseRow.created_at).toLocaleDateString('de-DE')} ·{' '}
        {reportIds.length} Meldung(en)
      </Text>

      {photos.map((p) => (
        <Image
          key={p.id}
          source={{ uri: blurredPhotoUrl(p.blurred_path!) }}
          style={styles.photo}
          accessibilityLabel="Anonymisiertes Foto des Müllfunds"
        />
      ))}
      {photos.length === 0 && (
        <Text style={[styles.meta, { color: colors.textSecondary }]} allowFontScaling>
          Foto wird noch geprüft/anonymisiert.
        </Text>
      )}

      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ich habe hier aufgeräumt — Fall mit Nachher-Foto abschließen"
          disabled={busy}
          onPress={closeCase}
          style={[styles.primaryButton, busy && styles.disabled]}>
          <Text style={styles.primaryLabel} allowFontScaling>
            {busy ? 'Wird gesendet…' : 'Ich habe aufgeräumt (Nachher-Foto)'}
          </Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diese Meldung dem Moderationsteam melden"
        onPress={flagCase}
        style={styles.flagButton}>
        <Text style={[styles.flagLabel, { color: colors.textSecondary }]} allowFontScaling>
          ⚑ Problem mit dieser Meldung?
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  title: { fontSize: 22, fontWeight: '700' },
  status: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 14, lineHeight: 20 },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    marginTop: Spacing.two,
    backgroundColor: '#8884',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1B7A43',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  primaryLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  flagButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  flagLabel: { fontSize: 14 },
});
