// Passwort zuruecksetzen. Zwei Wege fuehren zum neuen Passwort:
//   1. Code aus der E-Mail eintippen (funktioniert auf jedem Geraet, braucht
//      {{ .Token }} in der Supabase-Mailvorlage "Reset Password")
//   2. Link aus der E-Mail oeffnet die App direkt (clarrapp://passwort, muss
//      im Supabase-Dashboard als Redirect-URL erlaubt sein)
// Einrichtung: docs/auth.md.

import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Input } from '@/components';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPassword } from '@/lib/validation';

type Step = 'request' | 'code' | 'password' | 'done';
type Message = { key: TranslationKey; kind: 'error' | 'info' };

// Ein Reset-Link wird pro App-Lauf nur einmal ausgewertet. `useLinkingURL`
// liefert ihn sonst bei jedem spaeteren Besuch dieses Screens erneut.
let handledUrl: string | null = null;

/** Parameter aus Query und Fragment eines Supabase-Links. */
function linkParams(url: string): URLSearchParams {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

async function openRecoveryLink(url: string): Promise<boolean> {
  const params = linkParams(url);
  const tokenHash = params.get('token_hash');
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return !error;
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken && params.get('type') === 'recovery') {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  }
  return false;
}

export default function PasswortScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (!url || url === handledUrl) return;
    handledUrl = url;
    openRecoveryLink(url).then((ok) => {
      if (ok) setStep('password');
    });
  }, [url]);

  async function requestCode() {
    setBusy(true);
    setMessage(null);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/passwort'),
    });
    setBusy(false);
    // Immer dieselbe Antwort, egal ob es das Konto gibt (Anti-Enumeration).
    setMessage({ key: 'password.sent', kind: 'info' });
    setStep('code');
  }

  async function savePassword() {
    setBusy(true);
    setMessage(null);
    if (step === 'code') {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });
      if (error) {
        setBusy(false);
        setMessage({ key: 'password.error_code', kind: 'error' });
        return;
      }
      // Der Code ist verbraucht; scheitert gleich das Speichern, geht es
      // ohne Code weiter.
      setStep('password');
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage({ key: 'password.error_generic', kind: 'error' });
      return;
    }
    setMessage({ key: 'password.done', kind: 'info' });
    setStep('done');
  }

  const intro =
    step === 'request' ? t('password.intro') : step === 'password' ? t('password.link_intro') : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {intro && (
          <Text style={[styles.intro, { color: colors.textSecondary }]} allowFontScaling>
            {intro}
          </Text>
        )}

        {message && (
          <Card
            tone={message.kind === 'info' ? 'soft' : 'plain'}
            style={message.kind === 'error' && { backgroundColor: colors.dangerSoft }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.message,
                { color: message.kind === 'error' ? colors.danger : colors.primaryStrong },
              ]}
              allowFontScaling>
              {t(message.key)}
            </Text>
          </Card>
        )}

        {step === 'request' && (
          <>
            <Input
              accessibilityLabel={t('login.email_a11y')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t('login.email')}
              value={email}
              onChangeText={setEmail}
            />
            <Button
              label={t('password.send')}
              onPress={requestCode}
              loading={busy}
              disabled={!isValidEmail(email)}
            />
          </>
        )}

        {(step === 'code' || step === 'password') && (
          <>
            {step === 'code' && (
              <Input
                accessibilityLabel={t('password.code_a11y')}
                autoCapitalize="none"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                placeholder={t('password.code')}
                value={code}
                onChangeText={setCode}
              />
            )}
            <Input
              accessibilityLabel={t('password.new_a11y')}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder={t('password.new')}
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.actions}>
              <Button
                label={t('password.save')}
                onPress={savePassword}
                loading={busy}
                disabled={!isValidPassword(password) || (step === 'code' && code.trim().length < 6)}
              />
              {step === 'code' && (
                <Button
                  label={t('password.resend')}
                  onPress={() => {
                    setMessage(null);
                    setCode('');
                    setStep('request');
                  }}
                  variant="ghost"
                />
              )}
            </View>
          </>
        )}

        {step === 'done' && (
          <Button label={t('password.continue')} onPress={() => router.replace('/')} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { ...Type.bodyLarge },
  message: { fontSize: 15, lineHeight: 21 },
  actions: { gap: Spacing.two },
});
