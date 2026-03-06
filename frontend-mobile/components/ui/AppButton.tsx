import React, { useRef, useEffect } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  View,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { colors as doctorColors } from '../../lib/themeDoctor';

const c = theme.colors;
// Usar tom mais escuro para melhor contraste e visibilidade
const PRIMARY_MAIN = c.primary.dark;
const PRIMARY_BORDER = c.primary.darker;

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'doctorPrimary'
  | 'doctorSecondary'
  | 'doctorOutline'
  | 'doctorDanger'
  | 'doctorOutlineDanger';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPressIn?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Anima suavemente o botão para atrair atenção (use em CTAs de conversão). */
  pulse?: boolean;
}

const SIZE_CONFIG: Record<AppButtonSize, { height: number; fontSize: number; fontWeight: '600' | '700'; iconSize: number }> = {
  sm: { height: 44, fontSize: 14, fontWeight: '600', iconSize: 18 },
  md: { height: 52, fontSize: 16, fontWeight: '700', iconSize: 20 },
  lg: { height: 60, fontSize: 17, fontWeight: '700', iconSize: 22 },
};

const VARIANT_CONFIG: Record<AppButtonVariant, {
  bg: string; text: string; border?: string;
  shadow: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
}> = {
  primary: {
    bg: PRIMARY_MAIN,
    text: c.text.inverse,
    border: PRIMARY_BORDER,
    shadow: {
      shadowColor: c.text.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
  },
  secondary: { bg: c.secondary.main, text: c.text.inverse, shadow: theme.shadows.buttonSuccess },
  outline: { bg: 'transparent', text: PRIMARY_MAIN, border: PRIMARY_MAIN, shadow: theme.shadows.none },
  ghost: { bg: 'transparent', text: c.primary.main, shadow: theme.shadows.none },
  danger: { bg: c.status.error, text: c.text.inverse, shadow: theme.shadows.buttonDanger },
  doctorPrimary: {
    bg: doctorColors.primary,
    text: doctorColors.white,
    border: doctorColors.primaryDark,
    shadow: { shadowColor: doctorColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  },
  doctorSecondary: {
    bg: doctorColors.primaryLight,
    text: doctorColors.white,
    shadow: { shadowColor: doctorColors.primaryLight, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  },
  doctorOutline: {
    bg: doctorColors.surface,
    text: doctorColors.primary,
    border: doctorColors.primary,
    shadow: theme.shadows.none,
  },
  doctorDanger: {
    bg: doctorColors.error,
    text: doctorColors.white,
    border: doctorColors.destructive,
    shadow: {
      shadowColor: doctorColors.error,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
  },
  doctorOutlineDanger: {
    bg: doctorColors.errorLight,
    text: doctorColors.error,
    border: doctorColors.error,
    shadow: theme.shadows.none,
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
  leading,
  trailing,
  onPressIn,
  style,
  pulse = false,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const sizeConf = SIZE_CONFIG[size];
  const varConf = VARIANT_CONFIG[variant];

  // Spring scale no press
  const pressScale = useRef(new Animated.Value(1)).current;
  // Pulse suave para CTAs primárias
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse || isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isDisabled, pulseScale]);

  const handlePressIn = () => {
    onPressIn?.();
    Animated.spring(pressScale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  };

  const combinedScale = pulse && !isDisabled
    ? Animated.multiply(pressScale, pulseScale)
    : pressScale;

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        { transform: [{ scale: combinedScale }] },
        style,
      ]}
    >
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' || variant === 'doctorOutline' || variant === 'doctorOutlineDanger' ? varConf.text : c.text.inverse}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {leading}
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
          {trailing}
        </View>
      )}
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.button,
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
    opacity: 0.88,
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
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.1,
  },
});
