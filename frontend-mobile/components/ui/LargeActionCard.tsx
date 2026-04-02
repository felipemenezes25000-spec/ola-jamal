import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type AppThemeRole } from '../../lib/ui/useAppTheme';

export type LargeActionCardVariant = 'primary' | 'exam' | 'consultation';

export interface ChipConfig {
  label: string;
  bg: string;
  color: string;
  showDot?: boolean;
}

const VARIANT_CONFIG = {
  primary: {
    accent: '#0284C7',
    decorBg: '#E0F2FE',
    chevronBg: '#F0F9FF',
  },
  exam: {
    accent: '#2563EB',
    decorBg: '#DBEAFE',
    chevronBg: '#EFF6FF',
  },
  consultation: {
    accent: '#059669',
    decorBg: '#D1FAE5',
    chevronBg: '#ECFDF5',
  },
} as const;

interface LargeActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  variant?: LargeActionCardVariant;
  chips?: ChipConfig[];
  accessibilityLabel?: string;
  role?: AppThemeRole;
}

export function LargeActionCard({
  icon,
  title,
  description,
  onPress,
  variant = 'primary',
  chips,
  accessibilityLabel,
  role,
}: LargeActionCardProps) {
  const { colors } = useAppTheme({ role });
  const vc = VARIANT_CONFIG[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {/* Detalhe decorativo no canto */}
      <View style={[styles.decorShape, { backgroundColor: vc.decorBg }]} />

      {/* Row principal */}
      <View style={styles.mainRow}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={[styles.chevronWrap, { backgroundColor: vc.chevronBg }]}>
          <Ionicons name="chevron-forward" size={16} color={vc.accent} />
        </View>
      </View>

      {/* Chips informativos */}
      {chips && chips.length > 0 && (
        <View style={styles.chipsRow}>
          {chips.map((chip, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: chip.bg }]}>
              {chip.showDot && (
                <View style={[styles.chipDot, { backgroundColor: vc.accent }]} />
              )}
              <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.04)' } as any,
    }),
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  decorShape: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    borderBottomLeftRadius: 80,
    opacity: 0.35,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
    zIndex: 1,
  },
  iconWrap: {
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.1,
  },
  description: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 18,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
