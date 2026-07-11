import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Card } from '@/components';
import { Radius, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
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
  const colors = useThemeColors();
  const { t } = useI18n();
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
        accessibilityLabel={t('map.a11y')}>
        {reports.map((r) => {
          const closed = r.cases?.status === 'erledigt' || r.cases?.status === 'geschlossen';
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              // Geschlossene Faelle hervorgehoben (gruen), offene rot.
              pinColor={closed ? colors.primary : colors.danger}
              title={closed ? t('map.marker_done') : (r.waste_type ?? t('map.marker_open_fallback'))}
              description={closed ? t('map.marker_done_desc') : t('map.marker_open_desc')}
              accessibilityLabel={
                closed
                  ? t('map.marker_done_a11y')
                  : `${t('map.marker_open_a11y')}${r.waste_type ? `: ${r.waste_type}` : ''}`
              }
              onCalloutPress={() => {
                if (r.case_id) router.push({ pathname: '/case/[id]', params: { id: r.case_id } });
              }}
            />
          );
        })}
      </MapView>

      <Card
        style={styles.legend}
        accessibilityRole="summary"
        accessibilityLabel={t('map.summary_a11y', { total: reports.length, closed: closedCount })}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.legendText, { color: colors.text }]} allowFontScaling>
              {t('map.legend_open')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.text }]} allowFontScaling>
              {t('map.legend_done')}
            </Text>
          </View>
          <Text style={[styles.legendSummary, { color: colors.textSecondary }]} allowFontScaling>
            {t('map.legend_summary', { total: reports.length, closed: closedCount })}
          </Text>
        </View>
      </Card>
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 14, fontWeight: '600' },
  legendSummary: { fontSize: 13, marginLeft: 'auto' },
});
