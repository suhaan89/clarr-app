import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { startAutoSync } from '@/lib/offline-queue';
import { SessionProvider } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();

  // Navigation-Theme an die CLAR-Palette angleichen (Header, Hintergründe).
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t('stack.login'), headerShown: false }} />
        <Stack.Screen name="case/[id]" options={{ title: t('stack.case') }} />
        <Stack.Screen name="legal/datenschutz" options={{ title: t('stack.datenschutz') }} />
        <Stack.Screen name="legal/impressum" options={{ title: t('stack.impressum') }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    // Offline-Queue automatisch syncen, sobald Netz da ist.
    return startAutoSync();
  }, []);

  return (
    <SessionProvider>
      <I18nProvider>
        <AppStack />
      </I18nProvider>
    </SessionProvider>
  );
}
