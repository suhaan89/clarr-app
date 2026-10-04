// Demo-Modus fuer das Pitch-Video: eigener Stack ohne Login, ohne Backend.
// In Release-Builds nur mit EXPO_PUBLIC_DEMO=1 erreichbar: sonst kaeme jeder
// per Deep-Link (clarrapp://demo) am Login vorbei auf erfundene Punkte und
// Gutscheine.
import { Redirect, Stack } from 'expo-router';

const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DEMO === '1';

export default function DemoLayout() {
  if (!DEMO_ENABLED) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#0B0D0A' },
      }}
    />
  );
}
