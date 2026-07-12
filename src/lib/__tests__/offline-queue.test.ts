// Kern-Garantie der Offline-Erfassung: KEIN Doppel-Sync.
// (Die serverseitige Entdopplung per Unique-Index testet
// supabase/tests/ – hier geht es um das Client-Verhalten.)

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PendingReport } from '@/lib/api';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockNetInfoFetch = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  fetch: (...args: unknown[]) => mockNetInfoFetch(...args),
  addEventListener: jest.fn(() => jest.fn()),
}));

const mockSubmitReport = jest.fn();
jest.mock('@/lib/api', () => ({
  submitReport: (...args: unknown[]) => mockSubmitReport(...args),
}));

import { enqueueReport, readQueue, syncQueue } from '@/lib/offline-queue';

function makeReport(clientKey: string): PendingReport {
  return {
    clientKey,
    description: 'Testmüll',
    latitude: 51.0,
    longitude: 10.0,
    mocked: false,
    source: 'camera',
    photoUris: ['file:///tmp/foto.jpg'],
    createdAt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockNetInfoFetch.mockResolvedValue({ isConnected: true });
  mockSubmitReport.mockResolvedValue({ ok: true, report_id: 'r1' });
});

describe('Offline-Queue: kein Doppel-Sync', () => {
  test('derselbe clientKey landet nur EINMAL in der Queue', async () => {
    const item = makeReport('key-1');
    await enqueueReport(item);
    await enqueueReport(item); // Retry/Doppel-Tap
    expect(await readQueue()).toHaveLength(1);
  });

  test('erfolgreicher Sync entfernt den Eintrag – zweiter Sync sendet nichts', async () => {
    await enqueueReport(makeReport('key-1'));

    const first = await syncQueue();
    expect(first).toEqual({ sent: 1, failed: 0, remaining: 0 });
    expect(mockSubmitReport).toHaveBeenCalledTimes(1);

    const second = await syncQueue();
    expect(second.sent).toBe(0);
    expect(mockSubmitReport).toHaveBeenCalledTimes(1); // kein zweiter Aufruf
  });

  test('idempotente Server-Antwort zaehlt als erledigt', async () => {
    mockSubmitReport.mockResolvedValue({ ok: true, report_id: 'r1', idempotent: true });
    await enqueueReport(makeReport('key-1'));
    const result = await syncQueue();
    expect(result).toEqual({ sent: 1, failed: 0, remaining: 0 });
    expect(await readQueue()).toHaveLength(0);
  });

  test('fehlgeschlagene Eintraege bleiben liegen und behalten ihren clientKey', async () => {
    mockSubmitReport
      .mockResolvedValueOnce({ ok: true, report_id: 'r1' })
      .mockRejectedValueOnce(new Error('offline mitten im Upload'));
    await enqueueReport(makeReport('key-ok'));
    await enqueueReport(makeReport('key-fail'));

    const result = await syncQueue();
    expect(result).toEqual({ sent: 1, failed: 1, remaining: 1 });

    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    // Der clientKey bleibt DERSELBE -> der Server entdoppelt den Retry.
    expect(queue[0].clientKey).toBe('key-fail');
  });

  test('ohne Netz wird nichts gesendet und nichts verworfen', async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    await enqueueReport(makeReport('key-1'));
    const result = await syncQueue();
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 1 });
    expect(mockSubmitReport).not.toHaveBeenCalled();
  });
});
