import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

interface GradientHeaderProps {
  userName: string;
  userRole: 'patient' | 'doctor';
  subtitle?: string;
  avatarUrl?: string | null;
  onSettingsPress?: () => void;
}

export function GradientHeader({
  userName,
  userRole,
  subtitle,
  avatarUrl,
  onSettingsPress,
}: GradientHeaderProps) {
  const isDoctor = userRole === 'doctor';
  const gradientColors = isDoctor
    ? theme.colors.gradients.secondary
    : theme.colors.gradients.primary;

  const firstName = userName.split(' ')[0];
  const greeting = isDoctor ? `Dr. ${firstName} 👋` : `Olá, ${firstName}! 👋`;
  const defaultSubtitle = isDoctor ? 'Painel do médico' : 'Como podemos ajudar você hoje?';

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>{greeting}</Text>
          {(subtitle || defaultSubtitle) && (
            <Text style={styles.subtitle}>{subtitle || defaultSubtitle}</Text>
          )}
        </View>

        <View style={styles.rightSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name={isDoctor ? 'medical' : 'person'}
                size={24}
                color={theme.colors.text.inverse}
              />
            </View>
          )}

          {onSettingsPress && (
            <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress}>
              <Ionicons name="settings-outline" size={22} color={theme.colors.text.inverse} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.inverse,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.inverse,
    opacity: 0.9,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.text.inverse,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.text.inverse,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
