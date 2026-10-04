// DEMO fuer das Pitch-Video: Foto -> simulierter KI-Scan -> Meldung -> Punkte.
// Es laeuft KEINE echte Pruefung und nichts geht an den Server; das Ergebnis
// ist fest vorgegeben. Der Screen ist durchgehend mit "DEMO" gekennzeichnet.

import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DemoBadge, DemoColors as C } from '@/components/demo/DemoBadge';
import { Burst, useAppear, useCountUp } from '@/components/demo/effects';
import { PrimaryButton } from '@/components/demo/PrimaryButton';
import { DisplayFont } from '@/constants/theme';
import { DEMO_REPORT_POINTS, demoStore } from '@/lib/demoStore';

type Phase = 'camera' | 'scan' | 'result' | 'sending' | 'reward';

const { width: W, height: H } = Dimensions.get('window');
const SCAN_MS = 3800;

const SCAN_STEPS = [
  'Bild wird analysiert …',
  'Objekte werden erkannt …',
  'Abfallart wird bestimmt …',
  'Ort wird geprüft …',
];

// Feste "Erkennungen" fuer die Optik (Position in Prozent des Bildes).
const DETECTIONS = [
  { label: 'Plastik', conf: 96, x: 0.1, y: 0.4, w: 0.36, h: 0.2, at: 0.25 },
  { label: 'Sperrmüll', conf: 93, x: 0.5, y: 0.5, w: 0.4, h: 0.24, at: 0.45 },
  { label: 'Karton', conf: 89, x: 0.22, y: 0.64, w: 0.3, h: 0.16, at: 0.65 },
];

const tap = (style = Haptics.ImpactFeedbackStyle.Light) => {
  Haptics.impactAsync(style).catch(() => {});
};

export default function DemoScan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const flash = useState(() => new Animated.Value(0))[0];

  function start(uri: string) {
    setPhoto(uri);
    setPhase('scan');
  }

  async function shoot() {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }).start();
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) start(pic.uri);
    } catch {
      // Kamera nicht bereit: einfach erneut ausloesen lassen.
    }
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) start(res.assets[0].uri);
  }

  function reset() {
    setPhoto(null);
    setPhase('camera');
  }

  return (
    <View style={styles.root}>
      {phase === 'camera' ? (
        permission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center, { padding: 32 }]}>
            <Ionicons name="camera-outline" size={56} color={C.green} />
            <Text style={styles.permTitle}>Kamera freigeben</Text>
            <Text style={styles.permBody}>Für die Demo brauchen wir kurz die Kamera.</Text>
            <PrimaryButton label="Kamera erlauben" icon="camera" onPress={requestPermission} />
            <Pressable onPress={pick} style={{ marginTop: 18 }}>
              <Text style={styles.link}>Oder Foto aus der Galerie wählen</Text>
            </Pressable>
          </View>
        )
      ) : (
        photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      {/* Lesbarkeit oben/unten */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={[styles.topShade, { height: insets.top + 110 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomShade}
      />

      {phase === 'camera' && permission?.granted && <CameraOverlay onShoot={shoot} onPick={pick} />}
      {phase === 'scan' && <ScanOverlay onDone={() => setPhase('result')} />}
      {(phase === 'result' || phase === 'sending') && (
        <ResultSheet
          sending={phase === 'sending'}
          onSend={() => setPhase('sending')}
          onSent={() => {
            demoStore.addPoints(DEMO_REPORT_POINTS);
            setPhase('reward');
          }}
          onRetake={reset}
        />
      )}
      {phase === 'reward' && (
        <Reward onPoints={() => router.push('/demo/punkte')} onNew={reset} />
      )}

      {/* Kopfzeile */}
      <View style={[styles.header, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Text style={styles.wordmark}>CLAR</Text>
        <DemoBadge />
      </View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
    </View>
  );
}

/* ---------------------------------------------------------------- Kamera */

function CameraOverlay({ onShoot, onPick }: { onShoot: () => void; onPick: () => void }) {
  const insets = useSafeAreaInsets();
  const pulse = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.frame,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
        ]}>
        <Corners color="#fff" />
      </Animated.View>
      <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.hint}>Müll ins Bild nehmen und auslösen</Text>
        <View style={styles.shutterRow}>
          <Pressable onPress={onPick} style={styles.sideBtn} hitSlop={10}>
            <Ionicons name="images-outline" size={24} color="#fff" />
          </Pressable>
          <Pressable onPress={onShoot} style={({ pressed }) => [styles.shutterOuter, pressed && { transform: [{ scale: 0.92 }] }]}>
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.sideBtn}>
            <Ionicons name="sparkles" size={22} color={C.green} />
          </View>
        </View>
      </View>
    </>
  );
}

function Corners({ color, size = 34, thickness = 4 }: { color: string; size?: number; thickness?: number }) {
  const base = { position: 'absolute' as const, width: size, height: size, borderColor: color };
  return (
    <>
      <View style={[base, { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness, borderTopLeftRadius: 18 }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness, borderTopRightRadius: 18 }]} />
      <View style={[base, { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness, borderBottomLeftRadius: 18 }]} />
      <View style={[base, { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness, borderBottomRightRadius: 18 }]} />
    </>
  );
}

/* ---------------------------------------------------------------- Scan */

function ScanOverlay({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const line = useState(() => new Animated.Value(0))[0];
  const progress = useState(() => new Animated.Value(0))[0];
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [found, setFound] = useState(0);
  const appear = useAppear(true, 350);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(line, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    sweep.start();

    const id = progress.addListener(({ value }) => {
      setPct(Math.round(value * 100));
      setStep(Math.min(SCAN_STEPS.length - 1, Math.floor(value * SCAN_STEPS.length)));
      setFound(DETECTIONS.filter((d) => value >= d.at).length);
    });
    Animated.timing(progress, {
      toValue: 1,
      duration: SCAN_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDoneRef.current();
    });

    return () => {
      sweep.stop();
      progress.stopAnimation();
      progress.removeListener(id);
    };
  }, [line, progress]);

  useEffect(() => {
    if (found > 0) tap();
  }, [found]);

  const scanTop = H * 0.16;
  const scanHeight = H * 0.58;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,30,15,0.25)' }]} />

      {/* Raster */}
      <View style={[styles.grid, { top: scanTop, height: scanHeight }]}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 12.5}%` }]} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * (100 / 6)}%` }]} />
        ))}
        <Corners color={C.green} size={40} />
      </View>

      {/* Erkannte Objekte */}
      {DETECTIONS.slice(0, found).map((d) => (
        <DetectionBox key={d.label} d={d} top={scanTop} height={scanHeight} />
      ))}

      {/* Scan-Linie */}
      <Animated.View
        style={[
          styles.scanLineWrap,
          {
            top: scanTop,
            transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [0, scanHeight - 60] }) }],
          },
        ]}>
        <LinearGradient
          colors={['transparent', 'rgba(61,220,132,0.35)']}
          style={{ height: 52, width: '100%' }}
        />
        <View style={styles.scanLine} />
      </Animated.View>

      {/* Status */}
      <View style={[styles.scanPanel, { bottom: insets.bottom + 34 }]}>
        <View style={styles.scanPanelRow}>
          <View style={styles.aiChip}>
            <Ionicons name="sparkles" size={14} color={C.bg} />
            <Text style={styles.aiChipText}>KI-SCAN</Text>
          </View>
          <Text style={styles.pct}>{pct} %</Text>
        </View>
        <Text style={styles.scanStep}>{SCAN_STEPS[step]}</Text>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.trackFill,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <Text style={styles.scanMeta}>
          {found} {found === 1 ? 'Objekt' : 'Objekte'} erkannt
        </Text>
      </View>
    </Animated.View>
  );
}

function DetectionBox({ d, top, height }: { d: (typeof DETECTIONS)[number]; top: number; height: number }) {
  const v = useAppear(true, 380);
  return (
    <Animated.View
      style={[
        styles.detBox,
        {
          left: d.x * W,
          top: top + d.y * height - height * 0.3,
          width: d.w * W,
          height: d.h * height,
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }) }],
        },
      ]}>
      <View style={styles.detLabel}>
        <Text style={styles.detLabelText}>
          {d.label} {d.conf} %
        </Text>
      </View>
    </Animated.View>
  );
}

/* ---------------------------------------------------------------- Ergebnis */

function ResultSheet({
  sending,
  onSend,
  onSent,
  onRetake,
}: {
  sending: boolean;
  onSend: () => void;
  onSent: () => void;
  onRetake: () => void;
}) {
  const insets = useSafeAreaInsets();
  const sheet = useState(() => new Animated.Value(0))[0];
  const check = useState(() => new Animated.Value(0))[0];
  const ring = useState(() => new Animated.Value(0))[0];
  const send = useState(() => new Animated.Value(0))[0];
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(sheet, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 140 }).start();
    Animated.sequence([
      Animated.delay(220),
      Animated.parallel([
        Animated.spring(check, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 180 }),
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(() => setBurst(1), 260);
    return () => clearTimeout(t);
  }, [sheet, check, ring]);

  const onSentRef = useRef(onSent);
  useEffect(() => {
    onSentRef.current = onSent;
  }, [onSent]);

  useEffect(() => {
    if (!sending) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(send, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(
      ({ finished }) => finished && onSentRef.current()
    );
  }, [sending, send]);

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          paddingBottom: insets.bottom + 22,
          transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
        },
      ]}>
      <View style={styles.checkWrap}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
            },
          ]}
        />
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: check }] }]}>
          <Ionicons name="checkmark" size={52} color="#fff" />
        </Animated.View>
        <Burst trigger={burst} colors={[C.green, '#fff', C.gold]} distance={110} />
      </View>

      <Text style={styles.resultTitle}>Müll erkannt</Text>
      <Text style={styles.resultSub}>Illegale Ablagerung bestätigt</Text>

      <View style={styles.chips}>
        <Chip icon="trash-outline" text="Sperrmüll & Plastik" />
        <Chip icon="analytics-outline" text="94 % sicher" />
        <Chip icon="location-outline" text="Standort erfasst" />
      </View>

      {sending ? (
        <View style={styles.sendBtn}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.sendFill,
              { width: send.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
          <Animated.View
            style={{
              transform: [
                { translateX: send.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 30, 160] }) },
                { translateY: send.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, -4, -40] }) },
              ],
            }}>
            <Ionicons name="paper-plane" size={20} color="#fff" />
          </Animated.View>
          <Text style={styles.sendText}>Wird an die Stadt gesendet …</Text>
        </View>
      ) : (
        <>
          <PrimaryButton label="Meldung senden" icon="paper-plane" onPress={onSend} />
          <Pressable onPress={onRetake} style={{ alignSelf: 'center', marginTop: 14 }}>
            <Text style={styles.link}>Neues Foto</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );
}

function Chip({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={C.green} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- Punkte */

function Reward({ onPoints, onNew }: { onPoints: () => void; onNew: () => void }) {
  const insets = useSafeAreaInsets();
  const bg = useAppear(true, 350);
  const pop = useState(() => new Animated.Value(0))[0];
  const [burst, setBurst] = useState(0);
  const n = useCountUp(DEMO_REPORT_POINTS, 0, 1100, 350);
  const rest = useAppear(true, 500, 1300);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 160 }).start();
    const t1 = setTimeout(() => setBurst(1), 300);
    const t2 = setTimeout(() => {
      setBurst(2);
      tap(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pop]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.rewardRoot, { opacity: bg }]}>
      <LinearGradient colors={['#0B0D0A', '#13230F', '#0B0D0A']} style={StyleSheet.absoluteFill} />

      <View style={[styles.center, { flex: 1 }]}>
        <View style={styles.sentRow}>
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <Text style={styles.sentText}>Meldung übermittelt</Text>
        </View>

        <Animated.View style={[styles.coin, { transform: [{ scale: pop }] }]}>
          <LinearGradient colors={[C.gold, C.goldDeep]} style={styles.coinInner}>
            <Ionicons name="leaf" size={44} color="#fff" />
          </LinearGradient>
          <Burst trigger={burst} colors={[C.gold, C.green, '#fff']} distance={170} count={28} />
        </Animated.View>

        <Text style={styles.plus}>+{n}</Text>
        <Text style={styles.plusLabel}>Punkte gutgeschrieben</Text>
      </View>

      <Animated.View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 26,
          opacity: rest,
          transform: [{ translateY: rest.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        }}>
        <PrimaryButton label="Zu meinen Punkten" icon="gift" onPress={onPoints} gold />
        <Pressable onPress={onNew} style={{ alignSelf: 'center', marginTop: 16 }}>
          <Text style={styles.link}>Neue Meldung</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.4 },
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: { color: '#fff', fontFamily: DisplayFont.bold, fontWeight: '800', fontSize: 26, letterSpacing: 1 },
  flash: { backgroundColor: '#fff' },

  permTitle: { color: C.text, fontFamily: DisplayFont.bold, fontSize: 26, marginTop: 18 },
  permBody: { color: C.textDim, fontSize: 16, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  link: { color: C.textDim, fontSize: 15, fontWeight: '600' },

  frame: { position: 'absolute', top: H * 0.2, left: W * 0.1, width: W * 0.8, height: H * 0.42 },
  cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  hint: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 22, opacity: 0.9 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: W * 0.72 },
  sideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },

  grid: { position: 'absolute', left: W * 0.06, right: W * 0.06 },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,220,132,0.25)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,220,132,0.25)' },
  scanLineWrap: { position: 'absolute', left: W * 0.06, right: W * 0.06 },
  scanLine: {
    height: 3,
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  detBox: { position: 'absolute', borderWidth: 2, borderColor: C.green, borderRadius: 10, backgroundColor: 'rgba(61,220,132,0.12)' },
  detLabel: {
    position: 'absolute',
    top: -26,
    left: -2,
    backgroundColor: C.green,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detLabelText: { color: '#06210F', fontWeight: '800', fontSize: 12 },
  scanPanel: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(11,13,10,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(61,220,132,0.35)',
  },
  scanPanelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.green,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiChipText: { color: C.bg, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  pct: { color: C.green, fontFamily: DisplayFont.bold, fontSize: 22 },
  scanStep: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 12, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: C.green },
  scanMeta: { color: C.textDim, fontSize: 13, marginTop: 10 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 30,
    paddingHorizontal: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  checkWrap: { alignSelf: 'center', width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: C.green },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.green,
  },
  resultTitle: { color: C.text, fontFamily: DisplayFont.bold, fontSize: 32, textAlign: 'center' },
  resultSub: { color: C.textDim, fontSize: 16, textAlign: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18, marginBottom: 24 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(61,220,132,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(61,220,132,0.3)',
  },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  sendBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(61,220,132,0.15)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 30,
  },
  sendFill: { backgroundColor: C.greenDeep },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  rewardRoot: { backgroundColor: C.bg },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(61,220,132,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 40,
  },
  sentText: { color: C.text, fontWeight: '700', fontSize: 14 },
  coin: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  coinInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  plus: { color: C.gold, fontFamily: DisplayFont.bold, fontSize: 88, marginTop: 22, lineHeight: 100 },
  plusLabel: { color: C.text, fontSize: 20, fontWeight: '700' },

});
