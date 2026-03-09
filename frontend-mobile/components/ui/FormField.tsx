import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { AppInput, AppInputProps } from './AppInput';

interface FormFieldProps extends Omit<AppInputProps, 'style'> {
  /** Field label shown above input */
  label: string;
  /** Error message — shown in red below input */
  error?: string;
  /** Helper text — shown below input in muted color */
  helperText?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** Optional children to replace AppInput (e.g. custom picker) */
  children?: React.ReactNode;
}

export function FormField({
  label,
  error,
  helperText,
  required = false,
  children,
  ...inputProps
}: FormFieldProps) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text
        style={[
          styles.label,
          {
            color: error ? colors.error : colors.text,
            fontFamily: typography.fontFamily.semibold,
          },
        ]}
      >
        {label}
        {required && (
          <Text style={{ color: colors.error }}> *</Text>
        )}
      </Text>

      {/* Input or custom children */}
      {children || (
        <AppInput
          {...inputProps}
          style={error ? { borderColor: colors.error, borderWidth: 1.5 } : undefined}
        />
      )}

      {/* Error or Helper text */}
      {error ? (
        <Text
          style={[
            styles.message,
            {
              color: colors.error,
              fontFamily: typography.fontFamily.medium,
            },
          ]}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={[
            styles.message,
            {
              color: colors.textMuted,
              fontFamily: typography.fontFamily.regular,
            },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  message: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
});
