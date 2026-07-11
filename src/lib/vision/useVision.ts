/**
 * React-Hook für die On-Device-Analyse im Melde-Flow.
 *
 * Kapselt die Zustandsmaschine (idle → analyzing → done | unavailable) und
 * verwirft veraltete Ergebnisse, wenn der Nutzer schnell ein neues Foto wählt.
 * Das Ergebnis ist ausschließlich ein HINWEIS und beeinflusst das Absenden nie.
 */

import { useCallback, useRef, useState } from 'react';

import { analyzePhoto } from './index';
import type { VisionResult } from './types';

export type VisionStatus = 'idle' | 'analyzing' | 'done' | 'unavailable';

export type UseVision = {
  status: VisionStatus;
  result: VisionResult | null;
  analyze: (photoUri: string) => void;
  reset: () => void;
};

export function useVision(): UseVision {
  const [status, setStatus] = useState<VisionStatus>('idle');
  const [result, setResult] = useState<VisionResult | null>(null);
  // Monoton steigende ID: nur das jeweils jüngste Foto darf das Ergebnis setzen.
  const requestId = useRef(0);

  const analyze = useCallback((photoUri: string) => {
    const id = ++requestId.current;
    setStatus('analyzing');
    setResult(null);
    analyzePhoto(photoUri)
      .then((r) => {
        if (id !== requestId.current) return; // überholt → verwerfen
        setResult(r);
        setStatus('done');
      })
      .catch(() => {
        if (id !== requestId.current) return;
        // Jeder Fehler (kein Modell, Dekodierfehler …) → neutraler Aus-Zustand.
        setResult(null);
        setStatus('unavailable');
      });
  }, []);

  const reset = useCallback(() => {
    requestId.current++;
    setStatus('idle');
    setResult(null);
  }, []);

  return { status, result, analyze, reset };
}
