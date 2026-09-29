import { act, renderHook, waitFor } from '@testing-library/react-native';

import { VisionDisabledError, VisionUnavailableError } from '../types';

const mockAnalyzePhoto = jest.fn();
// index.ts zieht modelStore/Supabase nach sich – hier nur die eine Funktion.
jest.mock('../index', () => ({
  analyzePhoto: (...args: unknown[]) => mockAnalyzePhoto(...args),
}));

import { useVision } from '../useVision';

describe('useVision', () => {
  it('ohne Modell: Status „skipped" (Check wird still übersprungen)', async () => {
    mockAnalyzePhoto.mockRejectedValue(new VisionDisabledError());
    const { result } = await renderHook(() => useVision());
    await act(async () => result.current.analyze('file://a.jpg'));
    await waitFor(() => expect(result.current.status).toBe('skipped'));
    expect(result.current.result).toBeNull();
  });

  it('technischer Fehler: Status „unavailable"', async () => {
    mockAnalyzePhoto.mockRejectedValue(new VisionUnavailableError('native_module_missing'));
    const { result } = await renderHook(() => useVision());
    await act(async () => result.current.analyze('file://a.jpg'));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });

  it('liefert das Ergebnis und verwirft überholte Analysen', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    mockAnalyzePhoto
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ verdict: 'trash', score: 0.9, threshold: 0.5, modelVersion: 'v2' });
    const { result } = await renderHook(() => useVision());

    await act(async () => result.current.analyze('file://alt.jpg'));
    await act(async () => result.current.analyze('file://neu.jpg'));
    await waitFor(() => expect(result.current.status).toBe('done'));
    await act(async () =>
      resolveFirst({ verdict: 'no-trash', score: 0.1, threshold: 0.5, modelVersion: 'v1' })
    );

    expect(result.current.result?.modelVersion).toBe('v2');
  });
});
