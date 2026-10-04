// Nur fuer das Demo-Video (src/app/demo). Keine Verbindung zum Backend:
// Punkte und Gutscheine leben nur im Speicher und sind nach einem Neustart
// wieder auf dem Startwert.

import { useSyncExternalStore } from 'react';

export const DEMO_START_POINTS = 340;
export const DEMO_REPORT_POINTS = 20;

type DemoState = {
  points: number;
  /** Punktestand, den der Punkte-Screen zuletzt angezeigt hat (fuer das Hochzaehlen). */
  shownPoints: number;
  redeemed: string[];
};

let state: DemoState = {
  points: DEMO_START_POINTS,
  shownPoints: DEMO_START_POINTS,
  redeemed: [],
};
const listeners = new Set<() => void>();

function set(next: Partial<DemoState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const demoStore = {
  get: () => state,
  addPoints: (n: number) => set({ points: state.points + n }),
  markShown: () => set({ shownPoints: state.points }),
  redeem: (id: string, cost: number) => {
    if (state.redeemed.includes(id) || state.points < cost) return false;
    set({ points: state.points - cost, redeemed: [...state.redeemed, id] });
    return true;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useDemoState(): DemoState {
  return useSyncExternalStore(demoStore.subscribe, demoStore.get, demoStore.get);
}
