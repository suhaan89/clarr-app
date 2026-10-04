// Freischaltung des Kontos: ohne den Aufruf von activate_account nimmt
// submit-report keine Meldung an (403 not_active).

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '@/lib/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  Redirect: () => null,
}));

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { signOut: jest.fn() },
  },
}));

const mockRefresh = jest.fn();
jest.mock('@/lib/session', () => ({
  useSession: () => ({
    session: { user: { id: 'u1' } },
    loading: false,
    verificationLevel: 'mail_verifiziert',
    refreshVerificationLevel: mockRefresh,
  }),
}));

const mockSyncQueue = jest.fn();
jest.mock('@/lib/offline-queue', () => ({
  syncQueue: (...args: unknown[]) => mockSyncQueue(...args),
}));

import RegelnScreen from '@/app/regeln';

const ACCEPT_A11Y = 'Community-Regeln bestätigen und weiter zur App';

async function renderScreen() {
  return render(
    <I18nProvider>
      <RegelnScreen />
    </I18nProvider>
  );
}

beforeEach(() => {
  mockRefresh.mockResolvedValue('aktiv');
  mockSyncQueue.mockResolvedValue({});
});

describe('regeln.tsx: Konto freischalten', () => {
  it('bestaetigt die Regeln, sendet wartende Meldungen nach und geht zur App', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(ACCEPT_A11Y));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockRpc).toHaveBeenCalledWith('activate_account', { p_rules_accepted: true });
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockSyncQueue).toHaveBeenCalled();
  });

  it('unbestaetigte E-Mail: klarer Hinweis, keine Weiterleitung', async () => {
    mockRpc.mockResolvedValue({ data: { ok: false, error: 'email_not_verified' }, error: null });
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(ACCEPT_A11Y));

    expect(await screen.findByText(/bestätige zuerst deine E-Mail-Adresse/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Netzfehler: allgemeiner Hinweis, keine Weiterleitung', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(ACCEPT_A11Y));

    expect(await screen.findByText(/prüfe deine Verbindung/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
