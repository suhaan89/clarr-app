// Schrittzustand des Melde-Flows (foto -> details -> fertig), Paket I.37.
// Kamera/Standort/Vision/Offline-Queue sind native bzw. modell-abhaengig —
// hier vollstaendig gemockt, getestet wird nur die Screen-Logik/-Navigation.

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '@/lib/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// Reanimated 4 laedt beim Import das native Worklets-Modul; in Jest gibt es
// das nicht, deshalb der mitgelieferte Mock.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

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

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

const mockVisionAnalyze = jest.fn();
const mockVisionReset = jest.fn();
let mockVisionState: { status: string; result: unknown } = { status: 'idle', result: null };
jest.mock('@/lib/vision', () => ({
  useVision: () => ({ ...mockVisionState, analyze: mockVisionAnalyze, reset: mockVisionReset }),
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

import MeldenScreen from '@/app/(tabs)/melden';

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
  mockVisionState = { status: 'idle', result: null };
  mockReadQueue.mockResolvedValue([]);
  mockTakePictureAsync.mockResolvedValue({ uri: 'file://mock-photo.jpg' });
  mockGetCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 47.6, longitude: 9.5 },
    mocked: false,
  });
  mockSyncQueue.mockResolvedValue({ sent: 1, failed: 0, lost: 0, rejected: 0, remaining: 0, blocked: null });
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
    mockSyncQueue.mockResolvedValue({ sent: 0, failed: 1, lost: 0, rejected: 0, remaining: 1, blocked: null });
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    // "Gespeichert!" steht sowohl im Titel als auch (als Praefix) im
    // Fliesstext -- exact:true trifft nur den eigenstaendigen Titel-Text.
    expect(await screen.findByText('Gespeichert!', { exact: true })).toBeTruthy();
  });

  it('ohne Modell (skipped) erscheint kein Hinweis, Meldung geht ohne Score raus', async () => {
    mockVisionState = { status: 'skipped', result: null };
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    await screen.findByLabelText(DESC_A11Y);
    expect(screen.queryByText('Wir erkennen hier keinen Müll')).toBeNull();
    expect(screen.queryByText(/nicht verfügbar/)).toBeNull();

    fireEvent.press(await screen.findByText('Meldung absenden'));
    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    expect(mockEnqueueReport.mock.calls[0][0].ondevice).toBeNull();
  });

  it('niedriger Score: freundlicher Hinweis, Melden bleibt moeglich und Score geht mit', async () => {
    mockVisionState = {
      status: 'done',
      result: { verdict: 'no-trash', score: 0.12, threshold: 0.5, modelVersion: 'v1' },
    };
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));

    expect(await screen.findByText('Wir erkennen hier keinen Müll')).toBeTruthy();
    fireEvent.press(screen.getByText('Trotzdem melden'));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    expect(mockEnqueueReport.mock.calls[0][0].ondevice).toEqual({ score: 0.12, modelVersion: 'v1' });
  });

  it('niedriger Score: "Neues Foto" fuehrt zurueck zur Kamera', async () => {
    mockVisionState = {
      status: 'done',
      result: { verdict: 'no-trash', score: 0.12, threshold: 0.5, modelVersion: 'v1' },
    };
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Neues Foto'));

    expect(mockVisionReset).toHaveBeenCalled();
    expect(await screen.findByLabelText(SHUTTER_A11Y)).toBeTruthy();
  });

  it('"Abbrechen" im Details-Schritt fuehrt zurueck zum Kamera-Schritt', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    await screen.findByLabelText(DESC_A11Y);

    fireEvent.press(await screen.findByLabelText(CANCEL_A11Y));

    expect(mockVisionReset).toHaveBeenCalled();
    expect(await screen.findByLabelText(SHUTTER_A11Y)).toBeTruthy();
  });

  it('ein Doppel-Tipp auf den Ausloeser nimmt nur ein Foto auf', async () => {
    // Die erste Aufnahme laeuft noch, waehrend der zweite Tipp kommt.
    let finishCapture: (photo: { uri: string }) => void = () => {};
    mockTakePictureAsync.mockReturnValue(
      new Promise((resolve) => {
        finishCapture = resolve;
      })
    );
    await renderScreen();
    const shutter = await screen.findByLabelText(SHUTTER_A11Y);
    await fireEvent.press(shutter);
    await fireEvent.press(shutter);
    finishCapture({ uri: 'file://mock-photo.jpg' });

    await screen.findByLabelText(DESC_A11Y);
    expect(mockTakePictureAsync).toHaveBeenCalledTimes(1);
  });

  it('nimmt den Standort schon bei der Aufnahme, nicht erst beim Absenden', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    await screen.findByLabelText(DESC_A11Y);
    expect(mockGetCurrentPositionAsync).toHaveBeenCalledTimes(1);

    fireEvent.press(await screen.findByText('Meldung absenden'));
    await waitFor(() => expect(mockEnqueueReport).toHaveBeenCalledTimes(1));
    expect(mockGetCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(mockEnqueueReport.mock.calls[0][0]).toMatchObject({ latitude: 47.6, longitude: 9.5 });
  });

  it('ohne Standort: nichts wird gequeued, das Foto bleibt fuer einen neuen Versuch', async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('denied'));
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    expect(await screen.findByText('Standort fehlt')).toBeTruthy();
    expect(mockEnqueueReport).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Erneut versuchen'));
    expect(await screen.findByLabelText(DESC_A11Y)).toBeTruthy();
  });

  it('nicht freigeschaltetes Konto: Hinweis mit Weg zu den Community-Regeln', async () => {
    mockSyncQueue.mockResolvedValue({
      sent: 0,
      failed: 0,
      lost: 0,
      rejected: 0,
      remaining: 1,
      blocked: 'not_active',
    });
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    fireEvent.press(await screen.findByText('Zu den Regeln'));
    expect(mockRouterPush).toHaveBeenCalledWith('/regeln');
  });

  it('vom Server abgelehnte Meldung wird nicht als "offline" ausgegeben', async () => {
    mockSyncQueue.mockResolvedValue({
      sent: 0,
      failed: 0,
      lost: 0,
      rejected: 1,
      remaining: 0,
      blocked: null,
    });
    await renderScreen();
    fireEvent.press(await screen.findByLabelText(SHUTTER_A11Y));
    fireEvent.press(await screen.findByText('Meldung absenden'));

    expect(await screen.findByText('Meldung abgelehnt')).toBeTruthy();
  });
});
