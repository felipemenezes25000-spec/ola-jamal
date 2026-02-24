import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../lib/themeDoctor';
import { TabBarIcon } from '../../components/ui/TabBarIcon';
import { useNotifications } from '../../contexts/NotificationContext';
import { PulsingNotificationIcon } from '../../components/PulsingNotificationIcon';
import { useAuth } from '../../contexts/AuthContext';

const TAB_BAR_BASE_HEIGHT = Platform.OS === 'ios' ? 56 : 56;
const TAB_BAR_PADDING_TOP = 8;

export default function DoctorLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;

  const tabBarHeight = Math.max(72, TAB_BAR_BASE_HEIGHT + TAB_BAR_PADDING_TOP + insets.bottom);
  const tabBarPaddingBottom = Math.max(10, insets.bottom + (Platform.OS === 'ios' ? 4 : 8));

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2EC4B6',
          tabBarInactiveTintColor: colors.textMuted,
          tabBarPressColor: 'rgba(46, 196, 182, 0.12)',
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
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.6,
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
          name="dashboard"
          options={{
            title: 'Painel',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} variant="doctor" />
            ),
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} focused={focused} variant="doctor" />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alertas',
            tabBarBadge: hasUnread ? unreadCount : undefined,
            tabBarIcon: ({ color, size }) => (
              <PulsingNotificationIcon color={color} size={size ?? 22} hasUnread={hasUnread} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} variant="doctor" />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

