// CLAR — geteilte Accessibility-Hilfen (Runde 6, Paket H.35).

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live-aktualisierte "Bewegung reduzieren"-Einstellung des Betriebssystems.
 * Anders als Reanimateds `useReducedMotion()` (liest den Wert nur EINMAL
 * beim App-Start, siehe react-native-reanimated-Doku) reagiert dieser Hook
 * auch, wenn die Einstellung waehrend einer laufenden Sitzung geaendert
 * wird — ohne App-Neustart. Fuer echte Sicherheit sollten beide Signale
 * kombiniert werden (siehe Confetti.tsx).
 */
export function useSystemReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) =>
      setReduce(!!v)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
