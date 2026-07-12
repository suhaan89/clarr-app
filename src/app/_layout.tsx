import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { BrandSplash } from '@/components';
import { Colors } from '@/constants/theme';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { startAutoSync } from '@/lib/offline-queue';
import { SessionProvider } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();
  // Marken-Splash nur beim Kaltstart; blendet sich selbst aus.
  const [showSplash, setShowSplash] = useState(true);

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
      {showSplash && <BrandSplash onFinish={() => setShowSplash(false)} />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Marken-Display-Schrift (Bricolage Grotesque). Body bleibt System.
  const [fontsLoaded, fontError] = useFonts({
    'Bricolage-SemiBold': require('../../assets/fonts/BricolageGrotesque-SemiBold.ttf'),
    'Bricolage-ExtraBold': require('../../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
  });

  useEffect(() => {
    // Offline-Queue automatisch syncen, sobald Netz da ist.
    return startAutoSync();
  }, []);

  useEffect(() => {
    // Nativen Splash erst schließen, wenn die Schrift steht (oder scheitert) –
    // vermeidet ein kurzes Umspringen der Überschriften vom System-Fallback.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SessionProvider>
      <I18nProvider>
        <AppStack />
      </I18nProvider>
    </SessionProvider>
  );
}
