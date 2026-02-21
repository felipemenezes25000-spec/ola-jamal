/**
 * UI tokens para layout consistente do fluxo Paciente.
 * Uso: spacing, borderRadius, iconSizes, avatarSizes, screenPaddingHorizontal.
 */

export const uiTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    sm: 12,
    md: 16,
    lg: 24,
  },
  iconSizes: {
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
  },
  avatarSizes: {
    sm: 40,
    md: 48,
  },
  screenPaddingHorizontal: 20,
  maxContentWidth: 400,
} as const;

export type UiTokens = typeof uiTokens;
