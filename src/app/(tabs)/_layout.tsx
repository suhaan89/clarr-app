import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';

import { useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export default function TabLayout() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        // Touch-Ziele der Tabbar sind systemseitig >= 48dp; Labels bleiben
        // sichtbar (nicht nur Icons) – Screenreader & Verstaendlichkeit.
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarAccessibilityLabel: t('tabs.home_a11y'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="karte"
        options={{
          title: t('tabs.map'),
          tabBarAccessibilityLabel: t('tabs.map_a11y'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="melden"
        options={{
          title: t('tabs.report'),
          tabBarAccessibilityLabel: t('tabs.report_a11y'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('tabs.events'),
          tabBarAccessibilityLabel: t('tabs.events_a11y'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('tabs.impact'),
          tabBarAccessibilityLabel: t('tabs.impact_a11y'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
