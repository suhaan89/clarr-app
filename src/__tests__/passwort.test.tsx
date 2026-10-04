// Passwort zuruecksetzen per Code aus der E-Mail.

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '@/lib/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('expo-linking', () => ({
  useLinkingURL: () => null,
  createURL: (path: string) => `clarrapp://${path.replace(/^\//, '')}`,
}));

const mockReset = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockReset(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      setSession: jest.fn(),
    },
  },
}));

import PasswortScreen from '@/app/passwort';

async function renderScreen() {
  return render(
    <I18nProvider>
      <PasswortScreen />
    </I18nProvider>
  );
}

async function requestCode() {
  await fireEvent.changeText(await screen.findByLabelText('E-Mail-Adresse'), 'a@example.com');
  await fireEvent.press(screen.getByText('Code senden'));
  return screen.findByLabelText('Code aus der E-Mail eingeben');
}

beforeEach(() => {
  mockReset.mockResolvedValue({ error: null });
  mockVerifyOtp.mockResolvedValue({ error: null });
  mockUpdateUser.mockResolvedValue({ error: null });
});

describe('passwort.tsx', () => {
  it('zeigt dieselbe Antwort, auch wenn der Server einen Fehler meldet (Anti-Enumeration)', async () => {
    mockReset.mockResolvedValue({ error: { message: 'user not found' } });
    await renderScreen();
    await requestCode();

    expect(screen.getByText(/Falls es zu dieser Adresse ein Konto gibt/)).toBeTruthy();
    expect(mockReset).toHaveBeenCalledWith('a@example.com', { redirectTo: 'clarrapp://passwort' });
  });

  it('prueft den Code und speichert das neue Passwort', async () => {
    await renderScreen();
    await fireEvent.changeText(await requestCode(), '123456');
    await fireEvent.changeText(screen.getByLabelText('Neues Passwort, mindestens 8 Zeichen'), 'neuesPasswort');
    await fireEvent.press(screen.getByText('Passwort speichern'));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'neuesPasswort' }));
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'a@example.com',
      token: '123456',
      type: 'recovery',
    });
    expect(await screen.findByText('Dein Passwort ist geändert.')).toBeTruthy();
  });

  it('falscher Code: Passwort wird nicht geaendert', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'invalid' } });
    await renderScreen();
    await fireEvent.changeText(await requestCode(), '000000');
    await fireEvent.changeText(screen.getByLabelText('Neues Passwort, mindestens 8 Zeichen'), 'neuesPasswort');
    await fireEvent.press(screen.getByText('Passwort speichern'));

    expect(await screen.findByText(/Der Code ist falsch oder abgelaufen/)).toBeTruthy();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
