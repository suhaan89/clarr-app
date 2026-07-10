import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword = password.length >= 8;

  async function signIn() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      // Neutral — kein Unterschied "Konto existiert nicht" vs. "Passwort
      // falsch" (Anti-Enumeration).
      setMessage('Anmeldung nicht möglich. Bitte prüfe E-Mail und Passwort.');
    }
  }

  async function signUp() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error && error.status !== 422) {
      setMessage('Registrierung derzeit nicht möglich. Bitte versuche es später erneut.');
      return;
    }
    // Immer dieselbe Meldung — auch wenn die Adresse schon registriert ist
    // (Anti-Enumeration). Supabase sendet dann keine zweite Mail.
    setMessage(
      'Falls die Adresse neu ist, haben wir dir eine Bestätigungs-Mail geschickt. ' +
        'Bitte bestätige sie und melde dich dann an.'
    );
    // TODO (JURISTISCH PRUEFEN): Alters-/Einwilligungsabfrage vor der
    // Registrierung — Zielgruppe teils minderjaehrig. Bis zur Klaerung
    // keine Geburtsdatum-Abfrage (Datenminimierung).
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.text }]}
          allowFontScaling>
          CLAR
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling>
          Müll melden. Stadt sauber machen.
        </Text>

        <TextInput
          accessibilityLabel="E-Mail-Adresse"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="E-Mail"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />
        <TextInput
          accessibilityLabel="Passwort, mindestens 8 Zeichen"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          placeholder="Passwort (min. 8 Zeichen)"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />

        {message && (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.message, { color: colors.text }]}
            allowFontScaling>
            {message}
          </Text>
        )}

        {busy ? (
          <ActivityIndicator accessibilityLabel="Bitte warten" />
        ) : (
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anmelden"
              disabled={!validEmail || !validPassword}
              onPress={signIn}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                (!validEmail || !validPassword) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryLabel} allowFontScaling>
                Anmelden
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Neues Konto erstellen"
              disabled={!validEmail || !validPassword}
              onPress={signUp}
              style={({ pressed }) => [
                styles.button,
                (!validEmail || !validPassword) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.secondaryLabel, { color: colors.text }]} allowFontScaling>
                Konto erstellen
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.hint, { color: colors.textSecondary }]} allowFontScaling>
          Kein Klarname nötig — du meldest Müll, keine Menschen.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 40, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: Spacing.three },
  input: {
    minHeight: 48, // Touch-Ziel >= 44/48dp
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  message: { fontSize: 15, lineHeight: 21 },
  buttons: { gap: Spacing.two },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#1B7A43' },
  primaryLabel: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  secondaryLabel: { fontSize: 17 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: Spacing.three },
});
