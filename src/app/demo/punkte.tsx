// DEMO fuer das Pitch-Video: Punktestand + lokale Gutscheine. Alles simuliert
// (src/lib/demoStore.ts), keine echten Partner, nichts wird gebucht.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DemoBadge, DemoColors as C } from '@/components/demo/DemoBadge';
import { Burst, useAppear, useCountUp } from '@/components/demo/effects';
import { DisplayFont } from '@/constants/theme';
import { demoStore, useDemoState } from '@/lib/demoStore';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const VOUCHERS: {
  id: string;
  shop: string;
  title: string;
  cost: number;
  icon: IconName;
  tint: [string, string];
  distance: string;
}[] = [
  { id: 'baeckerei', shop: 'Bäckerei am Markt', title: '3 Brötchen gratis', cost: 120, icon: 'cafe', tint: ['#E9A84C', '#9C5B16'], distance: '250 m' },
  { id: 'haehnchen', shop: 'Hähnchen-Grill nebenan', title: '20 % auf dein Menü', cost: 250, icon: 'fast-food', tint: ['#E2673F', '#9A2E14'], distance: '400 m' },
  { id: 'eis', shop: 'Eiscafé Venezia', title: 'Eine Kugel Eis', cost: 80, icon: 'ice-cream', tint: ['#E58AB5', '#8E3463'], distance: '600 m' },
  { id: 'unverpackt', shop: 'Unverpackt-Laden', title: '5 € Einkaufsgutschein', cost: 300, icon: 'leaf', tint: ['#4FC37E', '#1C6B3D'], distance: '900 m' },
  { id: 'freibad', shop: 'Stadtbad', title: 'Tageskarte Freibad', cost: 400, icon: 'water', tint: ['#4AA8D8', '#155E86'], distance: '1,2 km' },
];

const NEXT_GOAL = 400;

export default function DemoPunkte() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { points, shownPoints, redeemed } = useDemoState();
  // Startwert einfrieren: beim Oeffnen von "alt" auf "neu" hochzaehlen.
  const [from] = useState(shownPoints);
  const [prev, setPrev] = useState(from);
  const [burst, setBurst] = useState(0);
  const gained = points - from;

  useEffect(() => {
    demoStore.markShown();
  }, [points]);

  const value = useCountUp(points, prev, prev === from ? 1600 : 700, prev === from ? 500 : 0);

  // Feier, wenn der Zaehler oben ankommt.
  useEffect(() => {
    if (gained <= 0) return;
    const t = setTimeout(() => {
      setBurst((b) => b + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [gained]);

  const bar = useState(() => new Animated.Value(from / NEXT_GOAL))[0];
  useEffect(() => {
    Animated.timing(bar, {
      toValue: Math.min(1, points / NEXT_GOAL),
      duration: 1600,
      delay: prev === from ? 500 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [bar, points, prev, from]);

  const float = useAppear(gained > 0, 1400, 700);

  function redeem(id: string, cost: number) {
    setPrev(points);
    if (demoStore.redeem(id, cost)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Meine Punkte</Text>
          <DemoBadge />
        </View>

        {/* Punktestand */}
        <LinearGradient colors={['#1E3A1A', '#10200E']} style={styles.balanceCard}>
          <LinearGradient
            colors={['rgba(245,196,81,0.25)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.balanceLabel}>Dein Guthaben</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{value}</Text>
            <Text style={styles.balanceUnit}>Punkte</Text>
            {gained > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.floatPlus,
                  {
                    opacity: float.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [10, -46] }) }],
                  },
                ]}>
                <Text style={styles.floatPlusText}>+{gained}</Text>
              </Animated.View>
            )}
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 40, height: 60 }}>
            <Burst trigger={burst} colors={[C.gold, C.green, '#fff']} distance={150} count={26} />
          </View>

          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}>
              <LinearGradient colors={[C.green, C.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <Text style={styles.goal}>
            {Math.max(0, NEXT_GOAL - points)} Punkte bis zur Freibad-Tageskarte
          </Text>

          <View style={styles.stats}>
            <Stat icon="camera" label="Meldungen" value={points > 340 ? '18' : '17'} />
            <Stat icon="checkmark-done" label="Aufgeräumt" value="9" />
            <Stat icon="people" label="Aktionen" value="3" />
          </View>
        </LinearGradient>

        <Text style={styles.section}>Gutscheine in deiner Nähe</Text>
        {VOUCHERS.map((v, i) => (
          <VoucherCard
            key={v.id}
            v={v}
            index={i}
            redeemed={redeemed.includes(v.id)}
            affordable={points >= v.cost}
            onRedeem={() => redeem(v.id, v.cost)}
          />
        ))}
        <Text style={styles.footnote}>Demo-Ansicht. Partner und Gutscheine sind Beispiele.</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={C.green} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VoucherCard({
  v,
  index,
  redeemed,
  affordable,
  onRedeem,
}: {
  v: (typeof VOUCHERS)[number];
  index: number;
  redeemed: boolean;
  affordable: boolean;
  onRedeem: () => void;
}) {
  const appear = useAppear(true, 500, 300 + index * 110);
  const done = useAppear(redeemed, 450);
  const [code] = useState(() => `DEMO-${Math.floor(1000 + Math.random() * 9000)}`);

  return (
    <Animated.View
      style={[
        styles.voucher,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        },
      ]}>
      <LinearGradient colors={v.tint} style={styles.voucherIcon}>
        <Ionicons name={v.icon} size={26} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.voucherShop}>
          {v.shop} · {v.distance}
        </Text>
        <Text style={styles.voucherTitle}>{v.title}</Text>
        {redeemed ? (
          <Animated.View style={[styles.codeRow, { opacity: done, transform: [{ scale: done.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
            <Ionicons name="checkmark-circle" size={16} color={C.green} />
            <Text style={styles.code}>{code}</Text>
          </Animated.View>
        ) : (
          <Text style={styles.voucherCost}>{v.cost} Punkte</Text>
        )}
      </View>
      {!redeemed && (
        <Pressable
          onPress={onRedeem}
          style={({ pressed }) => [
            styles.redeem,
            !affordable && styles.redeemOff,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}>
          <Text style={[styles.redeemText, !affordable && { color: C.textDim }]}>
            {affordable ? 'Einlösen' : 'Bald'}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: C.text, fontFamily: DisplayFont.bold, fontSize: 24 },

  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 26,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,196,81,0.25)',
  },
  balanceLabel: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  balance: { color: C.gold, fontFamily: DisplayFont.bold, fontSize: 64, lineHeight: 72 },
  balanceUnit: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  floatPlus: {
    position: 'absolute',
    right: 0,
    bottom: 14,
    backgroundColor: C.green,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  floatPlusText: { color: '#06210F', fontWeight: '900', fontSize: 18 },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 14, overflow: 'hidden' },
  trackFill: { height: 10, borderRadius: 5, overflow: 'hidden' },
  goal: { color: C.textDim, fontSize: 13, marginTop: 8 },
  stats: { flexDirection: 'row', marginTop: 20, gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: C.text, fontFamily: DisplayFont.bold, fontSize: 20 },
  statLabel: { color: C.textDim, fontSize: 12 },

  section: { color: C.text, fontFamily: DisplayFont.bold, fontSize: 20, marginTop: 28, marginBottom: 12, marginHorizontal: 20 },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  voucherIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  voucherShop: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  voucherTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  voucherCost: { color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  code: { color: C.green, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  redeem: { backgroundColor: C.gold, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  redeemOff: { backgroundColor: 'rgba(255,255,255,0.08)' },
  redeemText: { color: '#2A1A05', fontWeight: '800', fontSize: 14 },
  footnote: { color: C.textDim, fontSize: 12, textAlign: 'center', marginTop: 10, opacity: 0.7 },
});
