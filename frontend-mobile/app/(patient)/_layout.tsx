import React, { useEffect } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { haptics } from '../../lib/haptics';
import { TabBarIcon } from '../../components/ui/TabBarIcon';
import { useNotifications } from '../../contexts/NotificationContext';
import { PulsingNotificationIcon } from '../../components/PulsingNotificationIcon';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAppPermissions } from '../../hooks/useAppPermissions';

/** Design spec constants */
const ACTIVE_COLOR = '#0EA5E9';
const ICON_SIZE_ACTIVE = 24;
const ICON_SIZE_INACTIVE = 22;
const LABEL_FONT_SIZE = 11;

/** Responsive: detect tablets for slightly larger tab bar */
function isTablet(): boolean {
  const { width, height } = Dimensions.get('window');
  const minDim = Math.min(width, height);
  return minDim >= 600;
}

const TAB_BAR_BASE_HEIGHT = 56;
const TAB_BAR_TABLET_EXTRA = 8;
const TAB_BAR_PADDING_TOP = 8;

export default function PatientLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  useAppPermissions();

  const tablet = isTablet();
  const baseHeight = TAB_BAR_BASE_HEIGHT + (tablet ? TAB_BAR_TABLET_EXTRA : 0);
  const tabBarPaddingBottom = Math.max(10, insets.bottom + (Platform.OS === 'ios' ? 4 : 8));
  const tabBarHeight = Math.max(72, baseHeight + TAB_BAR_PADDING_TOP + insets.bottom);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!loading && user?.role === 'doctor') {
      router.replace('/(doctor)/dashboard');
    }
  }, [loading, user, router]);

  return (
    <ErrorBoundary>
      <Tabs
        screenListeners={{
          tabPress: () => haptics.selection(),
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: isDark ? colors.textSecondary : colors.textMuted,
          tabBarStyle: {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderTopColor: isDark ? colors.borderLight : '#F1F5F9',
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabBarHeight,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: TAB_BAR_PADDING_TOP,
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: isDark ? 0.2 : 0.06,
                shadowRadius: 12,
              },
              android: { elevation: 8 },
            }),
          },
          tabBarItemStyle: {
            paddingTop: 4,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
          tabBarAllowFontScaling: false,
          tabBarLabelStyle: {
            fontSize: tablet ? LABEL_FONT_SIZE + 1 : LABEL_FONT_SIZE,
            fontWeight: '700',
            letterSpacing: 0.2,
            textAlign: 'center',
            marginTop: 2,
          },
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
            top: -2,
            right: -4,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'home' : 'home-outline'}
                color={color}
                focused={focused}
                activeColor={ACTIVE_COLOR}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'document-text' : 'document-text-outline'}
                color={color}
                focused={focused}
                activeColor={ACTIVE_COLOR}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            title: 'Prontuário',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'folder-open' : 'folder-open-outline'}
                color={color}
                focused={focused}
                activeColor={ACTIVE_COLOR}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alertas',
            tabBarBadge: hasUnread ? unreadCount : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.alertasIconContainer}>
                <PulsingNotificationIcon
                  color={focused ? ACTIVE_COLOR : color}
                  size={focused ? ICON_SIZE_ACTIVE : ICON_SIZE_INACTIVE}
                  hasUnread={hasUnread}
                  focused={focused}
                />
                {hasUnread && (
                  <View style={styles.notificationDot} />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? 'person' : 'person-outline'}
                color={color}
                focused={focused}
                activeColor={ACTIVE_COLOR}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="dados"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  alertasIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
