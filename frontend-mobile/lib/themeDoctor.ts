/**
 * RenoveJá+ Doctor Theme – Design system oficial
 * Primary (botões): #2CB1FF, Header gradient: #1A9DE0 → #2CB1FF, Background: #F4F6F9
 * Status: azul ação, verde sucesso, amarelo aguardando, cinza histórico (sem roxo)
 * Plus Jakarta Sans
 *
 * Tokens compartilhados são importados de lib/theme.ts para evitar duplicação.
 */

import { theme } from './theme';

export const colors = {
  // Primary – Azul principal (botões, CTAs)
  primary: '#2CB1FF',
  primaryDark: '#1A9DE0',
  primaryLight: '#5EC5FF',
  primaryGhost: 'rgba(44, 177, 255, 0.10)',
  primarySoft: '#E3F4FF',

  // Secondary CTA (uso restrito)
  secondary: '#F4A261',
  secondaryDark: '#E76F51',
  secondarySoft: '#FFF3E6',

  // Accent – light blue
  accent: '#B8DFFB',
  accentSoft: '#E3F4FF',

  // Backgrounds – médico usa fundo levemente diferente (#F4F6F9 vs #F8FAFC)
  background: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  muted: '#E2EDF6',

  // Text – tom mais escuro para contraste no painel médico
  text: '#121A3E',
  textSecondary: theme.colors.text.secondary,
  textMuted: '#64748B',

  // Borders – reutilizados do tema base
  border: theme.colors.border.main,
  borderLight: theme.colors.border.light,
  ring: '#2CB1FF',

  // Status – reutilizados do tema base para consistência
  error: theme.colors.status.error,
  errorLight: theme.colors.status.errorLight,
  warning: theme.colors.status.warning,
  warningLight: theme.colors.status.warningLight,
  success: theme.colors.secondary.dark,
  successLight: theme.colors.secondary.soft,
  info: theme.colors.status.info,
  infoLight: theme.colors.status.infoLight,
  destructive: '#DC2626',

  // Neutral
  white: '#FFFFFF',
  black: theme.colors.text.primary,

  // Request statuses – reutilizados do tema base
  statusSubmitted: theme.colors.status.warning,
  statusInReview: theme.colors.status.info,
  statusApproved: theme.colors.secondary.dark,
  statusPaid: theme.colors.secondary.dark,
  statusSigned: '#6B7280',
  statusDelivered: theme.colors.secondary.dark,
  statusRejected: '#6B7280',
  statusCancelled: '#6B7280',
  statusSearching: theme.colors.status.warning,
  statusConsultationReady: theme.colors.status.info,
  statusInConsultation: theme.colors.status.info,
  statusFinished: theme.colors.secondary.dark,
} as const;

/** Espaçamento compartilhado com o tema do paciente. */
export const spacing = theme.spacing;

export const borderRadius = {
  xs: theme.borderRadius.xs,
  sm: theme.borderRadius.sm,
  md: theme.borderRadius.md,
  lg: theme.borderRadius.lg,
  xl: theme.borderRadius.xl,
  pill: theme.borderRadius.pill,
  card: 14,
  cardLg: 20,
  full: theme.borderRadius.full,
} as const;

/** Design system: card radius 20, padding 16–20, section gap 24, button 52/16 */
export const doctorDS = {
  cardRadius: 16,
  cardPadding: 18,
  sectionGap: 24,
  buttonHeight: 52,
  buttonRadius: 16,
  /** Padding horizontal das telas do painel médico (alinhamento consistente) */
  screenPaddingHorizontal: 20,
} as const;

export const shadows = {
  card: {
    shadowColor: '#2CB1FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLg: {
    shadowColor: '#2CB1FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  button: {
    shadowColor: '#2CB1FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;

export const gradients = {
  /** Header padrão: #1A9DE0 → #2CB1FF */
  doctorHeader: ['#1A9DE0', '#2CB1FF'] as const,
  primary: ['#1A9DE0', '#2CB1FF'] as unknown as string[],
  secondary: ['#F4A261', '#E76F51'] as unknown as string[],
  subtle: ['#E3F2FC', '#F4F6F9'] as unknown as string[],
} as const;

export const typography = {
  fontFamily: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
} as const;
