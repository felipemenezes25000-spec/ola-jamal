import React, { useState, forwardRef, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type AppThemeRole } from '../../lib/ui/useAppTheme';

const LOGIN_FOCUS_DEBUG = __DEV__ && false;

interface AppInputProps extends Omit<TextInputProps, 'role'> {
  label?: string;
  /** Exibe asterisco vermelho ao lado do label (campo obrigatório). */
  required?: boolean;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  _logLabel?: string;
  role?: AppThemeRole;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput({
  label,
  required,
  error,
  hint,
  leftIcon,
  disabled,
  secureTextEntry,
  containerStyle,
  style,
  _logLabel,
  role,
  onFocus,
  onBlur,
  onChangeText,
  ...rest
}, ref) {
  const { colors, spacing, radius } = useAppTheme({ role });
  const styles = useMemo(() => createStyles(spacing, radius, colors), [spacing, radius, colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const focusUpdateScheduled = useRef(false);

  // Defer focus state update to avoid re-layout during TextInput focus acquisition.
  // On Android/iOS, updating parent View styles (shadow/elevation) immediately on focus
  // can trigger a layout pass that steals focus from the TextInput.
  const handleFocus = useCallback((e: any) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.warn('[LOGIN_FOCUS] onFocus', _logLabel);
    onFocus?.(e);
    if (focusUpdateScheduled.current) return;
    focusUpdateScheduled.current = true;
    requestAnimationFrame(() => {
      setFocused(true);
      focusUpdateScheduled.current = false;
    });
  }, [onFocus, _logLabel]);

  const handleBlur = useCallback((e: any) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.warn('[LOGIN_FOCUS] onBlur', _logLabel);
    onBlur?.(e);
    setFocused(false);
  }, [onBlur, _logLabel]);

  const handleChangeText = useCallback((text: string) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.warn('[LOGIN_FOCUS] onChangeText', _logLabel, 'len=', text.length);
    onChangeText?.(text);
  }, [onChangeText, _logLabel]);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : colors.border;

  const bgColor = error
    ? colors.errorLight
    : focused
    ? colors.surface
    : colors.surfaceSecondary;

  const iconColor = focused ? colors.primary : colors.textMuted;

  // Avoid shadow/elevation on focus: they trigger layout on Android and can cause focus flicker.
  const showFocusShadow = false;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          { borderColor, backgroundColor: bgColor },
          showFocusShadow && focused && styles.focusShadow,
          disabled && styles.disabled,
        ]}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={iconColor} style={styles.leftIcon} />
        )}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={onChangeText ? handleChangeText : undefined}
          secureTextEntry={hidden}
          editable={!disabled}
          {...rest}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setHidden(!hidden)}
            style={styles.eyeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.errorContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
      </View>
    </View>
  );
});

const createStyles = (
  spacing: {
    sm: number;
    md: number;
  },
  radius: {
    md: number;
  },
  colors: {
    primary: string;
    text: string;
    textMuted: string;
    error: string;
  }
) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: colors.error,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  focusShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  eyeButton: {
    marginLeft: 4,
    padding: 4,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text,
    paddingVertical: 12,
  },
  errorContainer: {
    minHeight: 20,
    justifyContent: 'flex-end',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
});
