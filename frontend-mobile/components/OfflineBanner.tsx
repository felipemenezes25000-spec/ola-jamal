import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppTheme } from '../lib/ui/useAppTheme';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (isConnected !== false) return null;

  return (
    <View
      style={[styles.container, { top: insets.top, backgroundColor: colors.error }]}
      accessibilityRole="alert"
      accessibilityLabel="Sem conexão com a internet"
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={[styles.text, { color: colors.white }]}>Sem conexão com a internet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
