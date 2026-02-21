/**
 * InfoCard — substitui o banner roxo de IA.
 * Card branco com acento azul à esquerda, ícone em chip primarySoft e badge opcional.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, borderRadius, spacing } from '../../lib/themeDoctor';

interface InfoCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function InfoCard({ icon, title, description, badge, onPress, style }: InfoCardProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        onPress && pressed && styles.pressed,
        style,
      ]}
      {...(onPress ? { onPress } : {})}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.accent} />
      <View style={styles.iconChip}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.cardLg,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingRight: 18,
    ...Platform.select({
      ios: shadows.card,
      android: shadows.card,
      web: { boxShadow: '0 2px 12px rgba(44,177,255,0.10)' } as object,
    }),
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 4,
    marginRight: 14,
    marginLeft: 0,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
