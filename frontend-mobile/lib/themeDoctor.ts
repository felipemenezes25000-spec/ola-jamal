/**
 * RenoveJá+ Doctor Theme – Design system oficial
 * Primary (botões): #2CB1FF, Header gradient: #1A9DE0 → #2CB1FF, Background: #F4F6F9
 * Status: azul ação, verde sucesso, amarelo aguardando, cinza histórico (sem roxo)
 * Plus Jakarta Sans
 */

export const colors = {
  // Primary – Azul principal (botões, CTAs) – tom #2CB1FF
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

  // Backgrounds
  background: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  muted: '#E2EDF6',

  // Text
  text: '#121A3E',
  textSecondary: '#475569',
  textMuted: '#64748B',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  ring: '#2CB1FF',

  // Status
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  success: '#059669',
  successLight: '#D1FAE5',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  destructive: '#DC2626',

  // Neutral
  white: '#FFFFFF',
  black: '#0F172A',

  // Request statuses – design system: action/success/waiting/historical only
  statusSubmitted: '#F59E0B',
  statusInReview: '#3B82F6',
  statusApproved: '#059669',
  statusPaid: '#059669',
  statusSigned: '#6B7280',
  statusDelivered: '#059669',
  statusRejected: '#6B7280',
  statusCancelled: '#6B7280',
  statusSearching: '#F59E0B',
  statusConsultationReady: '#3B82F6',
  statusInConsultation: '#3B82F6',
  statusFinished: '#059669',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 26,
  card: 14,
  cardLg: 20,
  full: 9999,
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
