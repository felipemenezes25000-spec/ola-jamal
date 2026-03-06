/**
 * RenoveJá+ Unified Design System
 *
 * Factory `createTokens(role, scheme)` — única fonte de verdade de tokens.
 * lib/theme.ts e lib/themeDoctor.ts exportam versões pré-criadas para
 * compatibilidade com imports estáticos existentes.
 *
 * Para dark mode, use `useAppTheme()` que chama `createTokens` com o scheme atual.
 */

import { theme } from './theme';

export type ColorScheme = 'light' | 'dark';
export type AppRole = 'patient' | 'doctor';

// ─── Paletas estáticas (não mudam com o scheme) ──────────────
const BRAND = {
  primary: '#2CB1FF',
  primaryDark: '#1A9DE0',
  primaryLight: '#5EC5FF',
  primaryLighter: '#7DD3FC',
  primaryDarker: '#1595DC',
  secondary: '#10B981',
  secondaryDark: '#059669',
  accent: '#8B5CF6',

  // Status — mesmo em dark (contraste suficiente)
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  destructive: '#DC2626',

  white: '#FFFFFF',
  black: '#0F172A',
};

// ─── Semantic light ───────────────────────────────────────────
const PATIENT_LIGHT = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primarySoft: '#E3F4FF',
  primaryGhost: 'rgba(44,177,255,0.08)',
};

const DOCTOR_LIGHT = {
  background: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  muted: '#E2EDF6',
  text: '#121A3E',
  textSecondary: '#475569',
  textMuted: '#64748B',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primarySoft: '#E3F4FF',
  primaryGhost: 'rgba(44,177,255,0.10)',
  ring: '#2CB1FF',
};

// ─── Semantic dark ────────────────────────────────────────────
const PATIENT_DARK = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#162032',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  borderLight: '#1E293B',
  primarySoft: '#1A3A5C',
  primaryGhost: 'rgba(44,177,255,0.12)',
};

const DOCTOR_DARK = {
  background: '#0D1B2A',
  surface: '#1A2B3C',
  surfaceSecondary: '#152235',
  muted: '#1A2E42',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#2D4560',
  borderLight: '#1A2B3C',
  primarySoft: '#1A3A5C',
  primaryGhost: 'rgba(44,177,255,0.12)',
  ring: '#2CB1FF',
};

// ─── Status tokens (mesmo em ambos os modes) ──────────────────
const STATUS_COLORS = {
  statusSubmitted: '#F59E0B',
  statusInReview: '#3B82F6',
  statusApproved: '#10B981',
  statusPaid: '#10B981',
  statusSigned: '#8B5CF6',
  statusDelivered: '#10B981',
  statusRejected: '#EF4444',
  statusCancelled: '#6B7280',
  statusSearching: '#F59E0B',
  statusConsultationReady: '#3B82F6',
  statusInConsultation: '#3B82F6',
  statusFinished: '#10B981',
};

// ─── Gradients (ajustados para dark) ─────────────────────────
function getGradients(scheme: ColorScheme) {
  const doctorGrad = scheme === 'dark'
    ? ['#0F3050', '#1A9DE0'] as const
    : ['#1A9DE0', '#2CB1FF'] as const;
  const patientGrad = scheme === 'dark'
    ? ['#0A2540', '#1A9DE0', '#2CB1FF'] as const
    : ['#1A9DE0', '#2CB1FF', '#5EC5FF'] as const;
  return {
    auth: theme.colors.gradients.authBackground as unknown as string[],
    splash: theme.colors.gradients.splash as unknown as string[],
    doctorHeader: doctorGrad as unknown as string[],
    patientHeader: patientGrad as unknown as string[],
    primary: theme.colors.gradients.primary as unknown as string[],
    secondary: theme.colors.gradients.secondary as unknown as string[],
  };
}

// ─── Factory ─────────────────────────────────────────────────
export function createTokens(role: AppRole, scheme: ColorScheme) {
  const semantic = role === 'doctor'
    ? (scheme === 'dark' ? DOCTOR_DARK : DOCTOR_LIGHT)
    : (scheme === 'dark' ? PATIENT_DARK : PATIENT_LIGHT);

  const colors = {
    ...BRAND,
    ...semantic,
    ...STATUS_COLORS,
    // Doctor-specific aliases
    ...(role === 'doctor' ? {
      secondary: '#F4A261',
      secondaryDark: '#E76F51',
      secondarySoft: scheme === 'dark' ? '#3A2010' : '#FFF3E6',
      accentSoft: semantic.primarySoft,
      // Backward compat with themeDoctor
      success: BRAND.secondaryDark,
      successLight: scheme === 'dark' ? '#0D2A1E' : BRAND.successLight,
    } : {
      accentSoft: scheme === 'dark' ? '#2D1B5E' : '#EDE9FE',
    }),
  };

  const borderRadius = {
    xs: theme.borderRadius.xs,
    sm: theme.borderRadius.sm,
    md: theme.borderRadius.md,
    lg: theme.borderRadius.lg,
    xl: theme.borderRadius.xl,
    pill: theme.borderRadius.pill,
    card: theme.borderRadius.card,
    full: theme.borderRadius.full,
    button: theme.borderRadius.button,
    input: theme.borderRadius.input,
    modal: theme.borderRadius.modal,
  };

  return {
    role,
    scheme,
    colors,
    gradients: getGradients(scheme),
    spacing: theme.spacing,
    borderRadius,
    /** @alias borderRadius — backward-compat com componentes antigos. */
    radius: borderRadius,
    shadows: {
      card: theme.shadows.card,
      cardLg: theme.shadows.elevated,
      button: theme.shadows.button,
      sm: theme.shadows.sm,
    },
    typography: theme.typography,
  };
}

/** Tokens estáticos light — compatibilidade com imports diretos de lib/theme e lib/themeDoctor */
export const patientTokens = createTokens('patient', 'light');
export const doctorTokens = createTokens('doctor', 'light');

export type DesignTokens = ReturnType<typeof createTokens>;
export type DesignColors = DesignTokens['colors'];
