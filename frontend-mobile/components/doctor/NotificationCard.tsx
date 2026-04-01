import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../lib/designSystem';
import { shadows } from '../../lib/designSystem';
import { NotificationResponseDto } from '../../types/database';

export interface NotificationVisual {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}

interface NotificationCardProps {
  item: NotificationResponseDto;
  visual: NotificationVisual;
  colors: DesignColors;
  isDark: boolean;
  onPress: () => void;
  timeAgo: string;
}

export function NotificationCard({ item, visual, colors, isDark, onPress, timeAgo }: NotificationCardProps) {
  const isUnread = !item.read;
  const readOpacity = isUnread ? 1.0 : 0.65;

  return (
    <View style={[
      styles.cardOuter,
      { opacity: readOpacity },
      Platform.OS === 'android' && (isUnread ? styles.cardOuterElevatedAndroid : styles.cardOuterAndroid),
      Platform.OS === 'ios' && (isUnread ? styles.cardOuterElevatedIos : styles.cardOuterIos),
    ]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderColor: isDark ? colors.border : colors.borderLight,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Notificação: ${item.title}`}
      >
        {/* Left colored border strip — always visible with category color */}
        <View style={[styles.colorStrip, { backgroundColor: visual.color }]} />

        {/* Icon in colored container (36x36) */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: visual.color + (isDark ? '22' : '14') },
          ]}
        >
          <Ionicons name={visual.icon} size={18} color={visual.color} />
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Category label */}
          <Text style={[styles.categoryLabel, { color: visual.color }]}>
            {visual.label}
          </Text>

          {/* Title row */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.text },
                isUnread && styles.titleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && (
              <View style={[styles.unreadDot, { backgroundColor: visual.color }]} />
            )}
          </View>

          {/* Description */}
          <Text
            style={[styles.message, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.message}
          </Text>

          {/* Timestamp */}
          <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo}</Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.textMuted}
          style={styles.chevron}
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 16,
  },
  cardOuterAndroid: {
    elevation: 1,
  },
  cardOuterElevatedAndroid: {
    elevation: 2,
  },
  cardOuterIos: {
    shadowColor: shadows.sm.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardOuterElevatedIos: {
    shadowColor: shadows.sm.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    // No overflow:'hidden' — prevents Android gray artifact with elevation + borderRadius
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  colorStrip: {
    width: 3,
    alignSelf: 'stretch',
    flexShrink: 0,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 10,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    minWidth: 0,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    letterSpacing: 0.1,
  },
  titleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  },
  chevron: {
    marginRight: 12,
    marginLeft: 4,
    flexShrink: 0,
  },
});
