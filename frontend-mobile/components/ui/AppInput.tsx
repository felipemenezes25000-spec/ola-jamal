import React, { useState, forwardRef, useCallback, useRef } from 'react';
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
import { theme } from '../../lib/theme';

const c = theme.colors;
const s = theme.spacing;
const r = theme.borderRadius;

const LOGIN_FOCUS_DEBUG = __DEV__ && false;

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  _logLabel?: string;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput({
  label,
  error,
  hint,
  leftIcon,
  disabled,
  secureTextEntry,
  containerStyle,
  style,
  _logLabel,
  onFocus,
  onBlur,
  onChangeText,
  ...rest
}, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const focusUpdateScheduled = useRef(false);

  // Defer focus state update to avoid re-layout during TextInput focus acquisition.
  // On Android/iOS, updating parent View styles (shadow/elevation) immediately on focus
  // can trigger a layout pass that steals focus from the TextInput.
  const handleFocus = useCallback((e: any) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.log('[LOGIN_FOCUS] onFocus', _logLabel);
    onFocus?.(e);
    if (focusUpdateScheduled.current) return;
    focusUpdateScheduled.current = true;
    requestAnimationFrame(() => {
      setFocused(true);
      focusUpdateScheduled.current = false;
    });
  }, [onFocus, _logLabel]);

  const handleBlur = useCallback((e: any) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.log('[LOGIN_FOCUS] onBlur', _logLabel);
    onBlur?.(e);
    setFocused(false);
  }, [onBlur, _logLabel]);

  const handleChangeText = useCallback((text: string) => {
    if (LOGIN_FOCUS_DEBUG && _logLabel) console.log('[LOGIN_FOCUS] onChangeText', _logLabel, 'len=', text.length);
    onChangeText?.(text);
  }, [onChangeText, _logLabel]);

  const borderColor = error
    ? c.status.error
    : focused
    ? c.primary.main
    : c.border.main;

  const bgColor = error
    ? '#FEF2F2'
    : focused
    ? c.background.paper
    : c.background.secondary;

  const iconColor = focused ? c.primary.main : c.text.tertiary;

  // Avoid shadow/elevation on focus: they trigger layout on Android and can cause focus flicker.
  const showFocusShadow = false;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
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
          placeholderTextColor={c.text.tertiary}
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
              color={c.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: s.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text.primary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: r.pill,
    borderWidth: 1.5,
    minHeight: 54,
    paddingHorizontal: 20,
  },
  focusShadow: {
    shadowColor: c.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: s.sm,
  },
  eyeButton: {
    marginLeft: s.sm,
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: c.text.primary,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.status.error,
    marginTop: 4,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.text.tertiary,
    marginTop: 4,
    marginLeft: 4,
  },
});
