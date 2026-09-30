// CLAR – gemeinsame Konfiguration für die Onboarding-Coachmarks
// (@wrack/react-native-tour-guide). Farben/Radien/Texte kommen aus dem
// bestehenden Design-System (theme.ts/i18n), damit die Tooltips wie der Rest
// der App aussehen – keine eigene Styling-Bibliothek dafür.
//
// Jeder Screen hat eine eigene kurze "nur einmal"-Tour (siehe useFocusTour).
// `useTourPersistence` merkt sich pro `tourId` in AsyncStorage, ob sie schon
// gezeigt wurde; wiederholte Aufrufe (z. B. bei jedem Fokus) sind dadurch
// gefahrlos und starten nichts doppelt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useTourPersistence, type TourGuideConfig, type TourStep } from '@wrack/react-native-tour-guide';
import { useEffect, useRef } from 'react';

import { BottomTabInset, Radius, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';

/** Eine ID pro Screen-Tour – auch für den manuellen Neustart (Profil) gebraucht. */
export const TOUR_IDS = {
  home: 'tour_home',
  karte: 'tour_karte',
  profil: 'tour_profil',
} as const;

function useTourConfig(): TourGuideConfig {
  const colors = useThemeColors();
  const { t } = useI18n();

  return {
    tooltipStyles: {
      backgroundColor: colors.backgroundElement,
      titleColor: colors.text,
      descriptionColor: colors.textSecondary,
      buttonTextColor: colors.onPrimary,
      primaryButtonColor: colors.primary,
      secondaryButtonColor: colors.textSecondary,
      skipButtonColor: colors.textSecondary,
      borderRadius: Radius.lg,
    },
    spotlightStyles: {
      overlayColor: '#000000',
      overlayOpacity: 0.55,
      enablePulse: true,
      pulseColor: colors.primary,
    },
    nextButtonText: t('tour.button_next'),
    prevButtonText: t('tour.button_back'),
    skipButtonText: t('tour.button_skip'),
    doneButtonText: t('tour.button_done'),
    autoPositionTooltip: true,
    // Haelt Tooltips/Ziele von der schwebenden Glas-Tabbar frei.
    extraInsets: { bottom: BottomTabInset },
  };
}

type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

/** Liefert eine `start(steps)`-Funktion für die "nur einmal"-Tour `tourId`. */
function useTour(tourId: TourId) {
  const config = useTourConfig();
  const { startTour, markCompleted } = useTourPersistence(AsyncStorage);
  return (steps: TourStep[]) =>
    startTour(steps, {
      ...config,
      tourId,
      // Auch das Ueberspringen als "gesehen" merken. Sonst wuerde die Tour bei
      // fokus-basiertem Start beim naechsten Tabwechsel sofort wieder aufpoppen
      // (die Bibliothek markiert von sich aus nur ein *vollstaendiges* Ende).
      onTourEnd: () => markCompleted(tourId),
    });
}

/**
 * Startet die "nur einmal"-Tour `tourId`, sobald der Screen fokussiert ist und
 * `ready` gilt (die Ziel-Views also gemountet sind).
 *
 * Bewusst bei JEDEM Fokus: Tab-Screens bleiben gemountet, ein reiner
 * `useEffect(..., [])` liefe nach dem "erneut anzeigen"-Reset nie wieder an.
 * Ist die Tour schon abgeschlossen, passiert nichts (Persistenz-Check in
 * AsyncStorage). `buildSteps` und `t` werden über Refs gelesen, damit der
 * Effekt pro Fokus genau einmal läuft und nicht bei jedem Render.
 */
export function useFocusTour(
  tourId: TourId,
  ready: boolean,
  buildSteps: (t: (key: TranslationKey) => string) => TourStep[]
) {
  const start = useTour(tourId);
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const latest = useRef({ start, t, buildSteps });
  latest.current = { start, t, buildSteps };

  useEffect(() => {
    if (!isFocused || !ready) return;
    const { start: run, t: tr, buildSteps: build } = latest.current;
    run(build(tr));
  }, [isFocused, ready]);
}

/** Setzt alle Onboarding-Touren zurück – für den manuellen "?"-Neustart in Profil. */
export function useResetAllTours() {
  const { resetTour } = useTourPersistence(AsyncStorage);
  return async () => {
    await Promise.all(Object.values(TOUR_IDS).map((id) => resetTour(id)));
  };
}
