import React, { useState, forwardRef, useCallback, useMemo } from 'react';
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

export interface AppInputProps extends Omit<TextInputProps, 'role'> {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  _logLabel?: string;
  role?: AppThemeRole;
  // Explicitly surfacing common accessibility/autofill props so callers
  // are reminded to provide them. They fall through via ...rest, but
  // listing them here makes IDEs autocomplete them.
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
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
  const handleFocus = useCallback((e: any) => {
    onFocus?.(e);
    setFocused(true);
  }, [onFocus]);

  const handleBlur = useCallback((e: any) => {
    onBlur?.(e);
    setFocused(false);
  }, [onBlur]);

  const handleChangeText = useCallback((text: string) => {
    onChangeText?.(text);
  }, [onChangeText]);

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
          focused && styles.focusRing,
          disabled && styles.disabled,
        ]}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={iconColor} style={styles.leftIcon} />
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
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {(error || hint) && (
        <View style={styles.errorContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
        </View>
      )}
    </View>
  );
});

const createStyles = (
  spacing: { sm: number; md: number },
  radius: { md: number },
  colors: { primary: string; text: string; textMuted: string; error: string; border: string }
) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
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
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  focusRing: {
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
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
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.text,
    paddingVertical: 12,
  },
  errorContainer: {
    minHeight: 22,
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
    lineHeight: 16,
  },
});
