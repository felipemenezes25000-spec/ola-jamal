import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { haptics } from '../../lib/haptics';
import { TabBarIcon } from '../../components/ui/TabBarIcon';
import { useNotifications } from '../../contexts/NotificationContext';
import { PulsingNotificationIcon } from '../../components/PulsingNotificationIcon';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

const TAB_BAR_BASE_HEIGHT = 56;
const TAB_BAR_PADDING_TOP = 8;

export default function DoctorLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;
  const { colors, scheme } = useAppTheme({ role: 'doctor' });
  const isDark = scheme === 'dark';

  const tabBarHeight = Math.max(72, TAB_BAR_BASE_HEIGHT + TAB_BAR_PADDING_TOP + insets.bottom);
  const tabBarPaddingBottom = Math.max(10, insets.bottom + (Platform.OS === 'ios' ? 4 : 8));

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!loading && user?.role === 'patient') {
      router.replace('/(patient)/home');
    }
  }, [loading, user, router]);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Tabs
        screenListeners={{
          tabPress: () => haptics.selection(),
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primaryLight,
          tabBarInactiveTintColor: isDark ? colors.textSecondary : colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            borderTopWidth: isDark ? 0.5 : 1,
            height: tabBarHeight,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: TAB_BAR_PADDING_TOP,
            ...Platform.select({
              ios: {
                shadowColor: colors.black,
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 16,
              },
              android: { elevation: 10 },
            }),
          },
          tabBarItemStyle: {
            paddingTop: 6,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.3,
            textAlign: 'center',
            marginTop: 2,
          },
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            fontSize: 12,
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
              <TabBarIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} activeColor={colors.primary} />
            ),
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} focused={focused} activeColor={colors.primary} />
            ),
          }}
        />
        <Tabs.Screen
          name="consultations"
          options={{
            title: 'Consultas',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'videocam' : 'videocam-outline'} color={color} focused={focused} activeColor={colors.primary} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alertas',
            tabBarBadge: hasUnread ? unreadCount : undefined,
            tabBarIcon: ({ color, size }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 28, minHeight: 28 }}>
                <PulsingNotificationIcon color={color} size={size ?? 22} hasUnread={hasUnread} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} activeColor={colors.primary} />
            ),
          }}
        />
        <Tabs.Screen
          name="transcription-test"
          options={{
            href: null,
            title: 'Teste Transcrição',
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}

