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
import { theme } from '../../lib/theme';
import { colors as doctorColors } from '../../lib/themeDoctor';

const c = theme.colors;
const r = theme.borderRadius;
// Usar tom mais escuro para melhor contraste e visibilidade
const PRIMARY_MAIN = c.primary?.dark ?? '#1A9DE0';
const PRIMARY_BORDER = '#1583C7';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'doctorPrimary' | 'doctorSecondary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

const SIZE_CONFIG: Record<ButtonSize, { height: number; fontSize: number; fontWeight: '600' | '700'; iconSize: number }> = {
  sm: { height: 44, fontSize: 14, fontWeight: '600', iconSize: 18 },
  md: { height: 54, fontSize: 16, fontWeight: '700', iconSize: 20 },
  lg: { height: 60, fontSize: 17, fontWeight: '700', iconSize: 22 },
};

const VARIANT_CONFIG: Record<ButtonVariant, {
  bg: string; text: string; border?: string;
  shadow: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
}> = {
  primary: {
    bg: PRIMARY_MAIN,
    text: '#FFFFFF',
    border: PRIMARY_BORDER,
    shadow: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
  },
  secondary: { bg: c.secondary?.main ?? '#10B981', text: '#FFFFFF', shadow: theme.shadows.buttonSuccess },
  outline: { bg: 'transparent', text: PRIMARY_MAIN, border: PRIMARY_MAIN, shadow: theme.shadows.none },
  ghost: { bg: 'transparent', text: c.primary?.main ?? '#2CB1FF', shadow: theme.shadows.none },
  danger: { bg: c.status?.error ?? '#EF4444', text: '#FFFFFF', shadow: theme.shadows.buttonDanger },
  doctorPrimary: {
    bg: doctorColors.primaryDark,
    text: '#FFFFFF',
    border: '#1583C7',
    shadow: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  },
  doctorSecondary: {
    bg: doctorColors.secondary,
    text: '#FFFFFF',
    shadow: { shadowColor: doctorColors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  },
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const sizeConf = SIZE_CONFIG[size];
  const varConf = VARIANT_CONFIG[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizeConf.height,
          backgroundColor: varConf.bg,
          ...(varConf.border ? { borderWidth: 2, borderColor: varConf.border } : {}),
        },
        !isDisabled && varConf.shadow,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? PRIMARY_MAIN : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon}
              size={sizeConf.iconSize}
              color={varConf.text}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: varConf.text,
                fontSize: sizeConf.fontSize,
                fontWeight: sizeConf.fontWeight,
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: r.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    textAlign: 'center',
  },
});
