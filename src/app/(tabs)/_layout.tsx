import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B7A43',
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        // Touch-Ziele der Tabbar sind systemseitig >= 48dp; Labels bleiben
        // sichtbar (nicht nur Icons) — Screenreader & Verstaendlichkeit.
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Karte',
          tabBarAccessibilityLabel: 'Karte mit gemeldeten Müllfunden',
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="melden"
        options={{
          title: 'Melden',
          tabBarAccessibilityLabel: 'Müll melden',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Aktionen',
          tabBarAccessibilityLabel: 'Cleanup-Aktionen',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Impact',
          tabBarAccessibilityLabel: 'Dein Impact-Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
