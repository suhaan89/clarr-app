import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { TourGuideOverlay, TourGuideProvider } from '@wrack/react-native-tour-guide';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';

import { BrandSplash, ErrorBoundary, HelpChat } from '@/components';
import { Colors } from '@/constants/theme';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { startAutoSync } from '@/lib/offline-queue';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();
  const { session } = useSession();
  // Marken-Splash nur beim Kaltstart; blendet sich selbst aus.
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Offline-Queue automatisch syncen, sobald Netz da ist. Ein Eintrag,
    // dessen Foto trotz dauerhafter Kopie (Migration/Paket G.31) verloren
    // ging (z. B. App-Daten manuell geleert), wird klar kommuniziert statt
    // still fuer immer zu haengen.
    return startAutoSync((r) => {
      if (r.lost > 0) {
        Alert.alert(t('queue.lost_title'), t('queue.lost_body', { count: r.lost }));
      }
    });
  }, [t]);

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
      {/* Status-Bar-Icons an Hell/Dunkel koppeln (Edge-to-Edge: ohne dies
          koennen die System-Icons unlesbar auf gleichfarbigem Grund liegen).
          "auto" waehlt hell/dunkel gegenteilig zum aktuellen Schema. */}
      <StatusBar style="auto" />
      <TourGuideProvider>
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
        <Stack.Screen name="legal/agb" options={{ title: t('stack.agb') }} />
        <Stack.Screen name="legal/kontakt" options={{ title: t('stack.kontakt') }} />
        <Stack.Screen name="legal/lizenzen" options={{ title: t('stack.lizenzen') }} />
          <Stack.Screen name="moderation" options={{ title: t('moderation.title') }} />
        </Stack>
        {session && !showSplash && <HelpChat />}
        {showSplash && <BrandSplash onFinish={() => setShowSplash(false)} />}
        {/* Ueberlagert immer alles Weitere -> muss als letztes Kind stehen. */}
        {session && !showSplash && <TourGuideOverlay />}
      </TourGuideProvider>
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
    // Nativen Splash erst schließen, wenn die Schrift steht (oder scheitert) –
    // vermeidet ein kurzes Umspringen der Überschriften vom System-Fallback.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <SessionProvider>
        <I18nProvider>
          <AppStack />
        </I18nProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
