import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
  // Art. 8 DSGVO: Selbstauskunft statt Geburtsdatum (Datenminimierung) —
  // konkrete Altersgrenze/Text bleiben JURISTISCH PRUEFEN (docs/auth.md).
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  if (session) return <Redirect href="/" />;

  const validEmail = isValidEmail(email);
  const validPassword = isValidPassword(password);
  const canSubmit = validEmail && validPassword;
  const canSignUp = canSubmit && ageConfirmed;

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
    if (!ageConfirmed) return;
    setBusy(true);
    setMessage(null);
    const { error, data } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error && error.status !== 422) {
      setMessage({ text: t('login.error_signup'), kind: 'error' });
      return;
    }
    // Immer dieselbe Meldung – auch wenn die Adresse schon registriert ist
    // (Anti-Enumeration). Supabase sendet dann keine zweite Mail.
    setMessage({ text: t('login.signup_sent'), kind: 'info' });

    // Altersbestaetigung nachweisbar speichern (Migration 021). Best effort:
    // signUp() liefert bei neuer Adresse sofort eine Session (auth.uid()
    // ist dann gesetzt); bei bereits registrierter Adresse (Anti-Enumeration-
    // Zweig) gibt es keine neue Session – dann gibt es nichts zu speichern.
    if (data?.session) {
      await supabase.rpc('record_consent', {
        p_consent_key: 'altersbestaetigung',
        p_granted: true,
      });
    }
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

            <View style={styles.ageRow}>
              <Switch
                accessibilityLabel={t('login.age_confirm_a11y')}
                value={ageConfirmed}
                onValueChange={setAgeConfirmed}
                trackColor={{ true: colors.primary }}
              />
              <Text style={[styles.ageLabel, { color: colors.text }]} allowFontScaling>
                {t('login.age_confirm')}
              </Text>
            </View>
            <Text style={[styles.ageHint, { color: colors.textSecondary }]} allowFontScaling>
              {t('login.age_confirm_hint')}
            </Text>

            {busy ? (
              <ActivityIndicator color={colors.primary} accessibilityLabel={t('login.wait')} />
            ) : (
              <View style={styles.buttons}>
                <Button label={t('login.signin')} onPress={signIn} disabled={!canSubmit} />
                <Button
                  label={t('login.signup')}
                  onPress={signUp}
                  variant="ghost"
                  disabled={!canSignUp}
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
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  ageLabel: { fontSize: 14, flexShrink: 1 },
  ageHint: { fontSize: 12, lineHeight: 16, marginTop: -Spacing.two },
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
