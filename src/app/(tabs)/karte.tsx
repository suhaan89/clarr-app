import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Card } from '@/components';
import { Radius, Shadow, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type MapReport = {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  waste_type: string | null;
  case_id: string | null;
  case_status: string | null;
};

// Startausschnitt: Deutschland-Mitte; die Karte springt auf echte Marker.
const INITIAL_REGION = {
  latitude: 51.16,
  longitude: 10.45,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

/** Marker mit Icon (nicht nur Farbe): offen = Müll, erledigt = Häkchen. */
function MapPin({ done }: { done: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.pin, { backgroundColor: done ? colors.primary : colors.danger }]}>
      <Ionicons name={done ? 'checkmark-sharp' : 'trash'} size={15} color="#fff" />
    </View>
  );
}

export default function KarteScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const [reports, setReports] = useState<MapReport[]>([]);
  // Custom-Marker: kurz nachzeichnen lassen, dann fixieren (Android-Perf).
  const [tracksChanges, setTracksChanges] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // RLS liefert nur veroeffentlichte/eigene Meldungen (Paket 8);
      // Fotos kommen ausschliesslich geblurrt aus public-blurred.
      // `reports_map` liefert Koordinaten gerundet auf den Geohash8-
      // Zentroid statt exakter Lat/Lng (Migration 018) — schuetzt den
      // genauen Meldeort auf der oeffentlichen Karte.
      supabase
        .from('reports_map')
        .select('id, latitude, longitude, status, waste_type, case_id, case_status')
        .in('status', ['veroeffentlicht', 'erledigt'])
        .limit(500)
        .then(({ data }) => {
          if (data) setReports(data as unknown as MapReport[]);
        });
    }, [])
  );

  useEffect(() => {
    setTracksChanges(true);
    const timer = setTimeout(() => setTracksChanges(false), 900);
    return () => clearTimeout(timer);
  }, [reports]);

  const closedCount = reports.filter(
    (r) => r.case_status === 'erledigt' || r.case_status === 'geschlossen'
  ).length;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        accessibilityLabel={t('map.a11y')}>
        {reports.map((r) => {
          const closed = r.case_status === 'erledigt' || r.case_status === 'geschlossen';
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              tracksViewChanges={tracksChanges}
              title={closed ? t('map.marker_done') : (r.waste_type ?? t('map.marker_open_fallback'))}
              description={closed ? t('map.marker_done_desc') : t('map.marker_open_desc')}
              accessibilityLabel={
                closed
                  ? t('map.marker_done_a11y')
                  : `${t('map.marker_open_a11y')}${r.waste_type ? `: ${r.waste_type}` : ''}`
              }
              onCalloutPress={() => {
                if (r.case_id) router.push({ pathname: '/case/[id]', params: { id: r.case_id } });
              }}>
              <MapPin done={closed} />
            </Marker>
          );
        })}
      </MapView>

      <Card
        style={styles.legend}
        accessibilityRole="summary"
        accessibilityLabel={t('map.summary_a11y', { total: reports.length, closed: closedCount })}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendChip, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="trash" size={13} color={colors.danger} />
            </View>
            <Text style={[styles.legendText, { color: colors.text }]} allowFontScaling>
              {t('map.legend_open')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendChip, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="checkmark-sharp" size={13} color={colors.primaryStrong} />
            </View>
            <Text style={[styles.legendText, { color: colors.text }]} allowFontScaling>
              {t('map.legend_done')}
            </Text>
          </View>
          {/* See-Übersicht im „Wasser"-Teal – Locate-Akzent, kein Status. */}
          <Text style={[styles.legendSummary, { color: colors.waterStrong }]} allowFontScaling>
            {t('map.legend_summary', { total: reports.length, closed: closedCount })}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  legend: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  legendChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: { fontSize: 14, fontWeight: '600' },
  legendSummary: { fontSize: 13, fontWeight: '600', marginLeft: 'auto' },
});
