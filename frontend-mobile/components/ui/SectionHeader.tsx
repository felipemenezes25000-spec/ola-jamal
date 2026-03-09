import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';

interface SectionHeaderProps {
  title: string;
  /** Optional right-side action text like "Ver todos" */
  actionText?: string;
  onAction?: () => void;
  /** Optional icon next to action text */
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Render count badge next to title */
  count?: number;
  /** Extra bottom margin (default: 14) */
  marginBottom?: number;
}

export function SectionHeader({
  title,
  actionText,
  onAction,
  actionIcon = 'chevron-forward',
  count,
  marginBottom = 14,
}: SectionHeaderProps) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={[styles.container, { marginBottom }]}>
      <View style={styles.titleRow}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
            },
          ]}
        >
          {title}
        </Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{count}</Text>
          </View>
        )}
      </View>

      {actionText && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={actionText}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[
              styles.actionText,
              {
                color: colors.primary,
                fontFamily: typography.fontFamily.semibold,
              },
            ]}
          >
            {actionText}
          </Text>
          <Ionicons name={actionIcon} size={14} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
