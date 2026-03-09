/**
 * HeaderInfo — bloco de título + subtítulo para hierarquia informacional.
 * Usado na Home acima dos cards de ação.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';

interface HeaderInfoProps {
  title: string;
  subtitle: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function HeaderInfo({ title, subtitle, style, accessibilityLabel }: HeaderInfoProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 20,
  },
});
