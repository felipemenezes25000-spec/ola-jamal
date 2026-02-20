import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../lib/theme';

const MIN_TOUCH = 44;

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  iconColor?: string;
  iconBgColor?: string;
  onPress: () => void;
  compact?: boolean;
}

export function ActionCard({
  icon,
  label,
  description,
  iconColor = theme.colors.primary.main,
  iconBgColor,
  onPress,
  compact = false,
}: ActionCardProps) {
  const softBg = iconBgColor || (iconColor + '18');

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.compactCard, pressed && styles.compactPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[styles.compactIconWrap, { backgroundColor: softBg }]}>
          <Ionicons name={icon} size={26} color={iconColor} />
        </View>
        <Text style={styles.compactLabel} numberOfLines={2}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.fullCard, pressed && styles.fullPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.fullIconWrap, { backgroundColor: softBg }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.fullTextContainer}>
        <Text style={styles.fullLabel}>{label}</Text>
        {description && <Text style={styles.fullDescription}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ---- Compact (grid) ----
  compactCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.background.paper,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  compactPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  compactIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  compactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 17,
  },

  // ---- Full (list) ----
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  fullPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.88,
  },
  fullIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  fullTextContainer: {
    flex: 1,
  },
  fullLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  fullDescription: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});
