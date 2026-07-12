import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Input, LanguagePicker } from '@/components';
import { DisplayFont, Radius, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPassword } from '@/lib/validation';

export default function LoginScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);

  if (session) return <Redirect href="/" />;

  const validEmail = isValidEmail(email);
  const validPassword = isValidPassword(password);
  const canSubmit = validEmail && validPassword;

  async function signIn() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      // Neutral – kein Unterschied "Konto existiert nicht" vs. "Passwort
      // falsch" (Anti-Enumeration).
      setMessage({ text: t('login.error_signin'), kind: 'error' });
    }
  }

  async function signUp() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error && error.status !== 422) {
      setMessage({ text: t('login.error_signup'), kind: 'error' });
      return;
    }
    // Immer dieselbe Meldung – auch wenn die Adresse schon registriert ist
    // (Anti-Enumeration). Supabase sendet dann keine zweite Mail.
    setMessage({ text: t('login.signup_sent'), kind: 'info' });
    // TODO (JURISTISCH PRUEFEN): Alters-/Einwilligungsabfrage vor der
    // Registrierung – Zielgruppe teils minderjaehrig. Bis zur Klaerung
    // keine Geburtsdatum-Abfrage (Datenminimierung).
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.languageCorner}>
        <LanguagePicker variant="icon" />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={[styles.logoTile, { backgroundColor: colors.primary }]}>
              <Ionicons name="leaf" size={36} color={colors.onPrimary} />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.text }]}
              allowFontScaling>
              CLAR
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling>
              {t('login.tagline')}
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              accessibilityLabel={t('login.email_a11y')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t('login.email')}
              value={email}
              onChangeText={setEmail}
            />
            <Input
              accessibilityLabel={t('login.password_a11y')}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              placeholder={t('login.password')}
              value={password}
              onChangeText={setPassword}
            />

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
                  {message.text}
                </Text>
              </Card>
            )}

            {busy ? (
              <ActivityIndicator color={colors.primary} accessibilityLabel={t('login.wait')} />
            ) : (
              <View style={styles.buttons}>
                <Button label={t('login.signin')} onPress={signIn} disabled={!canSubmit} />
                <Button
                  label={t('login.signup')}
                  onPress={signUp}
                  variant="ghost"
                  disabled={!canSubmit}
                />
              </View>
            )}
          </View>

          <View style={styles.hintRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
              {t('login.hint')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  languageCorner: {
    position: 'absolute',
    top: Spacing.six,
    right: Spacing.three,
    zIndex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.five,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: Spacing.two },
  logoTile: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: { fontFamily: DisplayFont.bold, fontSize: 40, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center' },
  form: { gap: Spacing.three },
  message: { fontSize: 15, lineHeight: 21 },
  buttons: { gap: Spacing.two },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
  },
  hint: { fontSize: 13, textAlign: 'center', flexShrink: 1 },
});
