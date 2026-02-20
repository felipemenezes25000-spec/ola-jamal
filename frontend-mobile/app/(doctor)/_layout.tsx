import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/themeDoctor';
import { useNotifications } from '../../contexts/NotificationContext';
import { PulsingNotificationIcon } from '../../components/PulsingNotificationIcon';
import { useAuth } from '../../contexts/AuthContext';

export default function DoctorLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;

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
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
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
            fontWeight: '600',
            letterSpacing: 0.1,
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
              <DoctorTabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'Fila',
            tabBarIcon: ({ color, focused }) => (
              <DoctorTabIcon name={focused ? 'layers' : 'layers-outline'} color={color} focused={focused} />
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
              <DoctorTabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

function DoctorTabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {focused && (
        <View style={{
          position: 'absolute',
          top: -8,
          width: 24,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.primary,
        }} />
      )}
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}
