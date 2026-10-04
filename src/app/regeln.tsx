// Community-Regeln bestaetigen: schaltet das Konto frei (RPC activate_account,
// Migration 003). Erst danach nimmt submit-report Meldungen an. Der Server
// speichert nur den Zeitpunkt der Bestaetigung (rules_accepted_at).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { Spacing, Type, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { syncQueue } from '@/lib/offline-queue';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const RULES: { icon: IoniconName; title: TranslationKey; body: TranslationKey }[] = [
  { icon: 'trash-outline', title: 'rules.r1_title', body: 'rules.r1_body' },
  { icon: 'camera-outline', title: 'rules.r2_title', body: 'rules.r2_body' },
  { icon: 'heart-outline', title: 'rules.r3_title', body: 'rules.r3_body' },
  { icon: 'shield-checkmark-outline', title: 'rules.r4_title', body: 'rules.r4_body' },
];

export default function RegelnScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const { session, loading, verificationLevel, refreshVerificationLevel } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;
  if (verificationLevel === 'aktiv') return <Redirect href="/" />;

  async function accept() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('activate_account', {
      p_rules_accepted: true,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    if (rpcError || !result?.ok) {
      setBusy(false);
      setError(result?.error === 'email_not_verified' ? 'rules.error_email' : 'rules.error_generic');
      return;
    }
    await refreshVerificationLevel();
    // Meldungen, die vor der Freischaltung in der Queue gelandet sind, jetzt
    // nachsenden. Das Ergebnis muss hier niemand abwarten.
    syncQueue().catch(() => {});
    router.replace('/');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
          {t('rules.title')}
        </Text>
        <Text style={[styles.intro, { color: colors.textSecondary }]} allowFontScaling>
          {t('rules.intro')}
        </Text>

        {RULES.map((rule) => (
          <Card key={rule.title}>
            <View style={styles.rule}>
              <Ionicons name={rule.icon} size={24} color={colors.primaryStrong} />
              <View style={styles.ruleText}>
                <Text style={[styles.ruleTitle, { color: colors.text }]} allowFontScaling>
                  {t(rule.title)}
                </Text>
                <Text style={[styles.ruleBody, { color: colors.textSecondary }]} allowFontScaling>
                  {t(rule.body)}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        <Text style={[styles.ruleBody, { color: colors.textSecondary }]} allowFontScaling>
          {t('rules.full')}
        </Text>

        {error && (
          <Card style={{ backgroundColor: colors.dangerSoft }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.ruleBody, { color: colors.danger }]}
              allowFontScaling>
              {t(error)}
            </Text>
          </Card>
        )}

        <View style={styles.actions}>
          <Button
            label={t('rules.accept')}
            accessibilityLabel={t('rules.accept_a11y')}
            onPress={accept}
            loading={busy}
            disabled={busy}
            icon="checkmark"
          />
          <Button
            label={t('rules.open_terms')}
            onPress={() => router.push('/legal/agb')}
            variant="secondary"
          />
          <Button label={t('rules.signout')} onPress={() => supabase.auth.signOut()} variant="ghost" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { ...Type.title },
  intro: { ...Type.bodyLarge },
  rule: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  ruleText: { flex: 1, gap: Spacing.one },
  ruleTitle: { ...Type.heading },
  ruleBody: { ...Type.body },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
