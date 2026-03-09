import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/ui/useAppTheme';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export function Loading({ message, size = 'large', color }: LoadingProps) {
  const { colors, spacing } = useAppTheme();
  const resolvedColor = color ?? colors.primary;

  return (
    <View style={[styles.container, { padding: spacing.lg }]}>
      <ActivityIndicator size={size} color={resolvedColor} />
      {message && (
        <Text style={[styles.message, { color: resolvedColor, marginTop: spacing.sm }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
});
