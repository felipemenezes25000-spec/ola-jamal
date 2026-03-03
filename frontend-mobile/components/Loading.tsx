import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

const colors = theme.colors;
const spacing = theme.spacing;

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export function Loading({ message, size = 'large', color = '#FFFFFF' }: LoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={[styles.message, { color }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center' as const,
  },
});
