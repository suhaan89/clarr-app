// Schrittzustand des Melde-Flows (foto -> details -> fertig), Paket I.37.
// Kamera/Standort/Vision/Offline-Queue sind native bzw. modell-abhaengig —
// hier vollstaendig gemockt, getestet wird nur die Screen-Logik/-Navigation.

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '@/lib/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockTakePictureAsync = jest.fn();
jest.mock('expo-camera', () => {
  const React = require('react');
  function MockCameraView(_props: unknown, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
    return null;
  }
  MockCameraView.displayName = 'MockCameraView';
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: React.forwardRef(MockCameraView),
  };
});

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

const mockGetCurrentPositionAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  Accuracy: { Balanced: 3 },
}));

const mockVisionAnalyze = jest.fn();
const mockVisionReset = jest.fn();
jest.mock('@/lib/vision', () => ({
  useVision: () => ({ status: 'idle', result: null, analyze: mockVisionAnalyze, reset: mockVisionReset }),
}));

const mockEnqueueReport = jest.fn();
const mockReadQueue = jest.fn();
const mockSyncQueue = jest.fn();
jest.mock('@/lib/offline-queue', () => ({
  enqueueReport: (...args: unknown[]) => mockEnqueueReport(...args),
  readQueue: (...args: unknown[]) => mockReadQueue(...args),
  syncQueue: (...args: unknown[]) => mockSyncQueue(...args),
}));

// `@/lib/api` importiert `@/lib/supabase`, das ohne echte .env-Werte beim
// Modul-Laden wirft — hier reicht die reine, ungefaehrliche Funktion.
jest.mock('@/lib/api', () => ({
  newClientKey: () => 'test-client-key',
}));

import MeldenScreen from '../melden';

const SHUTTER_A11Y = 'Foto aufnehmen – Meldungen mit der Kamera zählen für Punkte';
const GALLERY_A11Y = 'Foto aus der Galerie wählen, ohne Punkte';
const DESC_A11Y = 'Beschreibung des Müllfunds, optional';
const CANCEL_A11Y = 'Abbrechen und neues Foto machen';
const NEW_A11Y = 'Weitere Meldung erfassen';

// `render` ist async (Test-Renderer + `act`) — MUSS awaited werden, sonst
// ist `screen` beim ersten Query noch nicht befuellt.
async function renderScreen() {
  return render(
    <I18nProvider>
      <MeldenScreen />
    </I18nProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReadQueue.mockResolvedValue([]);
  mockTakePictureAsync.mockResolvedValue({ uri: 'file://mock-photo.jpg' });
  mockGetCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 47.6, longitude: 9.5 },
    mocked: false,
  });
  mockSyncQueue.mockResolvedValue({ sent: 1, failed: 0, lost: 0, remaining: 0 });
});

describe('melden.tsx: Schrittzustand foto -> details -> fertig', () => {
  it('startet im Kamera-Schritt (Ausloeser sichtbar)', async () => {
    await renderScreen();
    expect(await screen.findByLabelText(SHUTTER_A11Y)).toBeTruthy();
  });

  it('wechselt nach einem Kamera-Foto in den Details-Schritt', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));

    await waitFor(() => expect(mockTakePictureAsync).toHaveBeenCalled());
    expect(mockVisionAnalyze).toHaveBeenCalledWith('file://mock-photo.jpg');
    expect(await screen.findByLabelText(DESC_A11Y)).toBeTruthy();
  });

  it('wechselt nach einem Galerie-Foto ebenfalls in den Details-Schritt, mit Galerie-Hinweis', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://mock-gallery.jpg' }],
    });
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(GALLERY_A11Y));

    await waitFor(() => expect(mockLaunchImageLibraryAsync).toHaveBeenCalled());
    expect(await screen.findByLabelText(DESC_A11Y)).toBeTruthy();
    // Galerie-Fotos zaehlen nicht fuer Punkte -- der Hinweistext muss da sein.
    expect(screen.getByText(/Punkte gibt es nur für Fotos/)).toBeTruthy();
  });

  it('sendet die Meldung ab und zeigt den Erfolgs-Schritt (fertig)', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    expect(mockSyncQueue).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText(NEW_A11Y)).toBeTruthy();
  });

  it('zeigt den Offline-Hinweis, wenn die Meldung nur gequeued werden konnte', async () => {
    mockSyncQueue.mockResolvedValue({ sent: 0, failed: 1, lost: 0, remaining: 1 });
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    // "Gespeichert!" steht sowohl im Titel als auch (als Praefix) im
    // Fliesstext -- exact:true trifft nur den eigenstaendigen Titel-Text.
    expect(await screen.findByText('Gespeichert!', { exact: true })).toBeTruthy();
  });

  it('"Abbrechen" im Details-Schritt fuehrt zurueck zum Kamera-Schritt', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    await screen.findByLabelText(DESC_A11Y);

    fireEvent.press(await screen.findByLabelText(CANCEL_A11Y));

    expect(mockVisionReset).toHaveBeenCalled();
    expect(await screen.findByLabelText(SHUTTER_A11Y)).toBeTruthy();
  });
});
