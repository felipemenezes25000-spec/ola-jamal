/**
 * Header padrão do fluxo médico com gradiente institucional e contraste alto.
 * Suporta dark mode via useAppTheme.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';

export interface DoctorHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function DoctorHeader({ title, subtitle, onBack, right }: DoctorHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gradients, colors } = useAppTheme({ role: 'doctor' });
  const handleBack = onBack ?? (() => router.back());

  return (
    <LinearGradient
      colors={gradients.doctorHeader as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.headerOverlaySurface, borderColor: colors.headerOverlayBorder }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.headerOverlayText} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.headerOverlayText }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: colors.headerOverlayTextMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSlot}>{right ?? <View style={styles.placeholder} />}</View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  placeholder: {
    width: 44,
  },
});
