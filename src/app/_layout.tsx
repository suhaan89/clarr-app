import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SessionProvider } from '@/lib/session';
import { startAutoSync } from '@/lib/offline-queue';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
    // Offline-Queue automatisch syncen, sobald Netz da ist.
    return startAutoSync();
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Anmelden', headerShown: false }} />
          <Stack.Screen name="case/[id]" options={{ title: 'Fall' }} />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}
