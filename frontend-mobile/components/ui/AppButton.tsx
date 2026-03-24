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

import { useAppTheme } from '../../lib/ui/useAppTheme';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'doctorPrimary'
  | 'doctorSecondary'
  | 'doctorOutline'
  | 'doctorDanger';

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
  pulse?: boolean;
  testID?: string;
}

const SIZE_CONFIG = {
  sm: { height: 40, fontSize: 13, iconSize: 16, padding: 18, radius: 12 },
  md: { height: 50, fontSize: 15, iconSize: 20, padding: 24, radius: 14 },
  lg: { height: 56, fontSize: 17, iconSize: 24, padding: 32, radius: 16 },
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
  testID,
}: AppButtonProps) {
  const { colors, shadows: themeShadows } = useAppTheme();
  const isDisabled = disabled || loading;
  const sizeConf = SIZE_CONFIG[size];

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
      case 'doctorSecondary':
        return { bg: colors.secondary, text: colors.white, border: 'transparent', shadow: themeShadows.button };
      case 'outline':
      case 'doctorOutline':
        return { bg: 'transparent', text: colors.primary, border: colors.border, shadow: themeShadows.none };
      case 'ghost':
        return { bg: 'transparent', text: colors.primary, border: 'transparent', shadow: themeShadows.none };
      case 'danger':
      case 'doctorDanger':
        return { bg: colors.error, text: colors.white, border: 'transparent', shadow: themeShadows.button };
      case 'primary':
      case 'doctorPrimary':
      default:
        return { bg: colors.primary, text: colors.white, border: 'transparent', shadow: themeShadows.button };
    }
  };

  const stylesConf = getVariantStyles();

  // Animation Refs
  const pressScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Pulse Animation
  useEffect(() => {
    if (!pulse || isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isDisabled, pulseScale]);

  const handlePressIn = () => {
    onPressIn?.();
    Animated.spring(pressScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  const combinedScale = pulse && !isDisabled
    ? Animated.multiply(pressScale, pulseScale)
    : pressScale;

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale: combinedScale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          {
            height: sizeConf.height,
            borderRadius: sizeConf.radius,
            backgroundColor: isDisabled ? colors.surfaceSecondary : stylesConf.bg,
            borderColor: isDisabled ? colors.border : stylesConf.border,
            borderWidth: stylesConf.border !== 'transparent' ? 1.5 : 0,
            paddingHorizontal: sizeConf.padding,
          },
          !isDisabled && variant !== 'ghost' && variant !== 'outline' && stylesConf.shadow,
          pressed && !isDisabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator
            color={variant.includes('outline') || variant === 'ghost' ? stylesConf.text : colors.white}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {leading}
            {icon && (
              <Ionicons
                name={icon}
                size={sizeConf.iconSize}
                color={isDisabled ? colors.textSecondary : stylesConf.text}
                style={[styles.icon, { marginRight: title ? 8 : 0 }]}
              />
            )}
            {title ? (
              <Text
                style={[
                  styles.text,
                  {
                    color: isDisabled ? colors.textSecondary : stylesConf.text,
                    fontSize: sizeConf.fontSize,
                  },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {title}
              </Text>
            ) : null}
            {trailing}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: {},
  text: {
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  pressed: { opacity: 0.92 },
});
