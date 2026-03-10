import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type AppThemeRole } from '../../lib/ui/useAppTheme';

export type LargeActionCardVariant = 'primary' | 'exam' | 'consultation';

function getVariantColors(c: { primary: string; primarySoft: string; info: string; infoLight: string; success: string; successLight: string }) {
  return {
    primary: { accent: c.primary, bg: c.primarySoft, border: c.primary + '26', chevronBg: c.primarySoft },
    exam: { accent: c.info, bg: c.infoLight, border: c.info + '26', chevronBg: c.infoLight },
    consultation: { accent: c.success, bg: c.successLight, border: c.success + '26', chevronBg: c.successLight },
  } as const;
}

interface LargeActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  variant?: LargeActionCardVariant;
  accessibilityLabel?: string;
  role?: AppThemeRole;
}

export function LargeActionCard({
  icon,
  title,
  description,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  role,
}: LargeActionCardProps) {
  const { colors, radius, shadows } = useAppTheme({ role });
  const cardShadow =
    Platform.OS === 'web'
      ? { boxShadow: '0px 2px 12px rgba(0,0,0,0.05)' }
      : shadows.card;
  const vc = getVariantColors(colors)[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: vc.bg, borderColor: vc.border, borderLeftColor: vc.accent, borderRadius: radius.card },
        cardShadow,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <View style={[styles.chevronCircle, { backgroundColor: vc.chevronBg }]}>
        <Ionicons name="chevron-forward" size={18} color={vc.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 80,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  description: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 18,
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
