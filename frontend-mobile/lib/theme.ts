/**
 * RenoveJá+ Theme — Compatibility Layer
 *
 * This file re-exports from designSystem.ts for backward compatibility.
 * New code should import from '../lib/designSystem' or use `useAppTheme()`.
 *
 * DO NOT add new tokens here — add them to designSystem.ts instead.
 */

import {
  spacing as dsSpacing,
  borderRadius as dsBorderRadius,
  shadows as dsShadows,
  typography as dsTypography,
} from './designSystem';

// ─── "theme" object for legacy imports like `import { theme } from './theme'` ──
export const theme = {
  colors: {
    primary: {
      main: '#0284C7',  // palette.primary[600]
      light: '#0EA5E9', // palette.primary[500]
      dark: '#0369A1',  // palette.primary[700]
      soft: '#F0F9FF',  // palette.primary[50]
      contrast: '#FFFFFF',
      ghost: '#F0F9FF',
    },
    secondary: {
      main: '#0D9488',
      light: '#14B8A6',
      dark: '#0F766E',
      soft: '#F0FDFA',
      contrast: '#FFFFFF',
    },
    background: {
      default: '#F8FAFC',
      primary: '#F8FAFC',
      secondary: '#F1F5F9',
      tertiary: '#E2E8F0',
      paper: '#FFFFFF',
      subtle: '#F1F5F9',
      modal: 'rgba(0, 0, 0, 0.5)',
    },
    accent: {
      main: '#0EA5E9',
      dark: '#0369A1',
      soft: '#F0F9FF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#5B6E8A',  // Fixed: matches designSystem textMuted for WCAG AA
      inverse: '#FFFFFF',
      disabled: '#CBD5E1',
      muted: '#5B6E8A',     // Fixed: matches designSystem textMuted
    },
    border: {
      light: '#F1F5F9',
      main: '#E2E8F0',
      dark: '#CBD5E1',
      focus: '#0EA5E9',
    },
    status: {
      success: '#16A34A',
      successBg: '#F0FDF4',
      warning: '#D97706',
      warningBg: '#FFFBEB',
      error: '#DC2626',
      errorBg: '#FEF2F2',
      info: '#2563EB',
      infoBg: '#EFF6FF',
      successLight: '#F0FDF4',
      warningLight: '#FFFBEB',
      errorLight: '#FEF2F2',
      infoLight: '#EFF6FF',
    },
    gradients: {
      primary: ['#0284C7', '#0EA5E9'],
      secondary: ['#0D9488', '#14B8A6'],
      doctorHeader: ['#0369A1', '#0EA5E9'],
      patientHeader: ['#0284C7', '#0EA5E9'],
      splash: ['#0284C7', '#0EA5E9'],
      auth: ['#F8FAFC', '#F1F5F9'],
      authBackground: ['#F8FAFC', '#F1F5F9'],
      subtle: ['#F8FAFC', '#F1F5F9'],
    },
  },
  spacing: dsSpacing,
  borderRadius: dsBorderRadius,
  typography: dsTypography,
  opacity: { disabled: 0.5, overlay: 0.5, pressed: 0.7, hover: 0.8 },
  shadows: dsShadows,
  zIndex: {
    base: 0, dropdown: 1000, sticky: 1100, modal: 1300,
    toast: 1400, float: 1200, fixed: 1100,
  },
} as const;

// ─── Flat color exports for `import { colors } from './theme'` ──
export const colors = {
  ...theme.colors,
  primary: theme.colors.primary.main,
  primaryLight: theme.colors.primary.light,
  primaryDark: theme.colors.primary.dark,
  primarySoft: theme.colors.primary.soft,
  primaryGhost: theme.colors.primary.ghost,
  secondary: theme.colors.secondary.main,
  secondaryLight: theme.colors.secondary.light,
  secondaryDark: theme.colors.secondary.dark,
  secondarySoft: theme.colors.secondary.soft,
  accent: theme.colors.accent.main,
  accentSoft: theme.colors.accent.soft,
  background: theme.colors.background.default,
  surface: theme.colors.background.paper,
  surfaceSecondary: theme.colors.background.subtle,
  text: theme.colors.text.primary,
  textSecondary: theme.colors.text.secondary,
  textMuted: theme.colors.text.tertiary,
  border: theme.colors.border.main,
  borderLight: theme.colors.border.light,
  white: '#FFFFFF',
  black: '#020617',
  success: theme.colors.status.success,
  successLight: theme.colors.status.successLight,
  warning: theme.colors.status.warning,
  warningLight: theme.colors.status.warningLight,
  error: theme.colors.status.error,
  errorLight: theme.colors.status.errorLight,
  info: theme.colors.status.info,
  infoLight: theme.colors.status.infoLight,
  destructive: '#DC2626',
  muted: '#F1F5F9',  // delegated: designSystem.createTokens → surfaceSecondary
  statusSubmitted: theme.colors.status.warning,
  statusInReview: theme.colors.status.info,
  statusApproved: theme.colors.status.success,
  statusPaid: theme.colors.status.success,
  statusSigned: theme.colors.text.secondary,
  statusDelivered: theme.colors.status.success,
  statusRejected: theme.colors.status.error,
  statusCancelled: theme.colors.text.tertiary,
  statusSearching: theme.colors.status.info,
  statusConsultationReady: theme.colors.status.info,
  statusInConsultation: theme.colors.status.warning,
  statusFinished: theme.colors.status.success,
  overlayBackground: 'rgba(0, 0, 0, 0.6)',
  headerOverlayTextMuted: 'rgba(255, 255, 255, 0.8)',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
};

export const spacing     = dsSpacing;
export const borderRadius = dsBorderRadius;
export const typography  = dsTypography;
export const shadows     = dsShadows;
export const gradients   = theme.colors.gradients;

export default theme;
