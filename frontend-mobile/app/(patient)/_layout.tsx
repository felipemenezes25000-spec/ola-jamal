import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../lib/theme';
import { TabBarIcon } from '../../components/ui/TabBarIcon';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

const TAB_BAR_BASE_HEIGHT = 56;
const TAB_BAR_PADDING_TOP = 8;

export default function PatientLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();

  const tabBarHeight = Math.max(72, TAB_BAR_BASE_HEIGHT + TAB_BAR_PADDING_TOP + insets.bottom);
  const tabBarPaddingBottom = Math.max(10, insets.bottom + (Platform.OS === 'ios' ? 4 : 8));

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2CB1FF',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPressColor: 'rgba(44, 177, 255, 0.12)',
        tabBarPressOpacity: 0.8,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: TAB_BAR_PADDING_TOP,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.error,
          fontSize: 10,
          fontWeight: '700',
          minWidth: 18,
          height: 18,
          lineHeight: 18,
          borderRadius: 9,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} variant="patient" />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'document-text' : 'document-text-outline'} color={color} focused={focused} variant="patient" />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertas',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} focused={focused} variant="patient" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} variant="patient" />
          ),
        }}
      />
    </Tabs>
  );
}

