/**
 * Botão primário padrão do fluxo médico/paciente.
 * Altura 52, borderRadius 16.
 * Variantes: primary (azul sólido), outline (azul outline), danger (vermelho sólido), outline-danger (vermelho outline).
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, doctorDS } from '../../lib/themeDoctor';

export type PrimaryButtonVariant = 'primary' | 'outline' | 'danger' | 'outline-danger';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  showArrow?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: PrimaryButtonVariant;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  showArrow = false,
  icon,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyle = {
    primary: styles.variantPrimary,
    outline: styles.variantOutline,
    danger: styles.variantDanger,
    'outline-danger': styles.variantOutlineDanger,
  }[variant];

  const labelStyle = {
    primary: styles.labelPrimary,
    outline: styles.labelOutline,
    danger: styles.labelPrimary,
    'outline-danger': styles.labelOutlineDanger,
  }[variant];

  const isOutline = variant === 'outline' || variant === 'outline-danger';
  const iconColor = isOutline
    ? (variant === 'outline-danger' ? colors.error : colors.primary)
    : '#fff';

  const shadowStyle = {
    primary: styles.enabledPrimary,
    outline: undefined,
    danger: styles.enabledDanger,
    'outline-danger': undefined,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        !isDisabled && shadowStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.content}>
        {icon && <Ionicons name={icon} size={20} color={iconColor} />}
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        {showArrow && (
          <Ionicons name="chevron-forward" size={20} color={iconColor} style={styles.arrow} />
        )}
      </View>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={iconColor} size="small" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderWidth: 1.5,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  variantPrimary: {
    backgroundColor: '#1B4965',
    borderColor: '#0F2D44',
  },
  variantDanger: {
    backgroundColor: colors.error,
    borderColor: colors.destructive,
  },
  variantOutline: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  variantOutlineDanger: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  enabledPrimary: {
    shadowColor: '#1B4965',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  enabledDanger: {
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  labelOutline: {
    color: colors.primary,
  },
  labelOutlineDanger: {
    color: colors.error,
  },
  arrow: {
    marginLeft: 2,
  },
});
