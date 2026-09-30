// Einwilligungs-Schalter im Profil: die Anzeige darf nie vom gespeicherten
// Stand abweichen. Scheitert record_consent, springt der Schalter zurueck.

import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { I18nProvider } from '@/lib/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Laden ist hier nicht Gegenstand des Tests.
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: null, loading: false }) }));

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { useProfilData } from '@/lib/useProfilData';

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

beforeEach(() => {
  mockRpc.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('erfolgreiche Aenderung bleibt stehen und wird im Journal gespeichert', async () => {
  mockRpc.mockResolvedValue({ error: null });
  const { result } = await renderHook(() => useProfilData(), { wrapper });

  await act(() => result.current.setConsent('ki_training', true));

  expect(result.current.consents.ki_training).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('record_consent', {
    p_consent_key: 'ki_training',
    p_granted: true,
  });
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('fehlgeschlagener Widerruf springt zurueck und meldet den Fehler', async () => {
  const { result } = await renderHook(() => useProfilData(), { wrapper });
  mockRpc.mockResolvedValueOnce({ error: null });
  await act(() => result.current.setConsent('ki_training', true));

  mockRpc.mockResolvedValueOnce({ error: { message: 'offline' } });
  await act(() => result.current.setConsent('ki_training', false));

  expect(result.current.consents.ki_training).toBe(true);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});
