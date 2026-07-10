import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type MapReport = {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  waste_type: string | null;
  case_id: string | null;
  cases: { status: string } | null;
};

// Startausschnitt: Deutschland-Mitte; die Karte springt auf echte Marker.
const INITIAL_REGION = {
  latitude: 51.16,
  longitude: 10.45,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

export default function KarteScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const [reports, setReports] = useState<MapReport[]>([]);

  useFocusEffect(
    useCallback(() => {
      // RLS liefert nur veroeffentlichte/eigene Meldungen (Paket 8);
      // Fotos kommen ausschliesslich geblurrt aus public-blurred.
      supabase
        .from('reports')
        .select('id, latitude, longitude, status, waste_type, case_id, cases(status)')
        .in('status', ['veroeffentlicht', 'erledigt'])
        .limit(500)
        .then(({ data }) => {
          if (data) setReports(data as unknown as MapReport[]);
        });
    }, [])
  );

  const closedCount = reports.filter(
    (r) => r.cases?.status === 'erledigt' || r.cases?.status === 'geschlossen'
  ).length;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        accessibilityLabel="Karte mit geprüften Müll-Meldungen">
        {reports.map((r) => {
          const closed = r.cases?.status === 'erledigt' || r.cases?.status === 'geschlossen';
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              // Geschlossene Faelle hervorgehoben (gruen), offene rot.
              pinColor={closed ? '#1B7A43' : '#C0392B'}
              title={closed ? 'Erledigt 🎉' : (r.waste_type ?? 'Müllfund')}
              description={closed ? 'Dieser Fall wurde aufgeräumt.' : 'Tippen für Details'}
              accessibilityLabel={
                closed ? 'Erledigter Müllfund' : `Offener Müllfund${r.waste_type ? `: ${r.waste_type}` : ''}`
              }
              onCalloutPress={() => {
                if (r.case_id) router.push({ pathname: '/case/[id]', params: { id: r.case_id } });
              }}
            />
          );
        })}
      </MapView>

      <View
        style={[styles.legend, { backgroundColor: colors.background }]}
        accessibilityRole="summary"
        accessibilityLabel={`${reports.length} Meldungen auf der Karte, davon ${closedCount} erledigt`}>
        <Text style={[styles.legendText, { color: colors.text }]} allowFontScaling>
          🔴 offen · 🟢 erledigt — {reports.length} Meldungen, {closedCount} erledigt
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  legend: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    opacity: 0.95,
  },
  legendText: { fontSize: 14, textAlign: 'center' },
});
