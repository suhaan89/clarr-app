// CLAR — Fallback-Route fuer ungueltige Deep-Links (Runde 6, Paket G.30).

import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components';
import { Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

export default function NotFoundScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t('notfound.title') }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="compass-outline" title={t('notfound.title')} body={t('notfound.body')}>
          <Link href="/" accessibilityLabel={t('notfound.link')} style={styles.link}>
            <Text style={{ color: colors.primaryStrong, fontWeight: '600' }} allowFontScaling>
              {t('notfound.link')}
            </Text>
          </Link>
        </EmptyState>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 44, justifyContent: 'center', marginTop: Spacing.one },
});
