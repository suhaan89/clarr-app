// Kleine Animations-Bausteine fuer den Demo-Modus. Bewusst mit dem
// eingebauten Animated-API (keine Worklets), damit sie in Expo Go sicher laufen.

import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** Zaehlt eine Zahl von `from` auf `to` hoch (oder runter). */
export function useCountUp(to: number, from: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(from);
  const anim = useState(() => new Animated.Value(from))[0];

  useEffect(() => {
    anim.setValue(from);
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    const a = Animated.timing(anim, {
      toValue: to,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [anim, from, to, duration, delay]);

  return value;
}

/** Partikel-Explosion aus der Mitte des Elternelements. `trigger` aendern = neu abspielen. */
export function Burst({
  trigger,
  colors,
  count = 22,
  distance = 140,
}: {
  trigger: number;
  colors: string[];
  count?: number;
  distance?: number;
}) {
  const progress = useState(() => new Animated.Value(0))[0];

  const colorKey = colors.join('|');
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + (i % 2 ? 0.2 : -0.1);
        const dist = distance * (0.6 + ((i * 37) % 40) / 100);
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 6 + ((i * 13) % 7),
          color: colorKey.split('|')[i % colors.length],
          round: i % 3 !== 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, distance, colorKey]
  );

  useEffect(() => {
    if (trigger <= 0) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [trigger, progress]);

  if (trigger <= 0) return null;

  return (
    <View pointerEvents="none" style={styles.burstWrap}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.round ? p.size : p.size * 2,
            borderRadius: p.round ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i * 40}deg`] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.2, 1.2, 0.6] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Einmalig: Wert von 0 auf 1 animieren, sobald `active` true wird. */
export function useAppear(active: boolean, duration = 500, delay = 0) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, v, duration, delay]);
  return v;
}

const styles = StyleSheet.create({
  burstWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
