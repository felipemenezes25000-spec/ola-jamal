/**
 * RenoveJá+ Doctor Theme – Ocean Blue Medical
 * Primary: #0077B6, Secondary CTA: #F4A261, Background: #F0F9FF
 * Plus Jakarta Sans
 */

export const colors = {
  // Primary – Ocean Blue
  primary: '#0077B6',
  primaryDark: '#005F8A',
  primaryLight: '#0096D6',
  primaryGhost: 'rgba(0, 119, 182, 0.10)',
  primarySoft: '#E0F2FE',

  // Secondary CTA – warm amber
  secondary: '#F4A261',
  secondaryDark: '#E76F51',
  secondarySoft: '#FFF3E6',

  // Accent – light blue
  accent: '#B8DFFB',
  accentSoft: '#E0F2FE',

  // Backgrounds
  background: '#F0F9FF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  muted: '#E2EDF6',

  // Text (foreground = HSL 234 50% 14%)
  text: '#121A3E',
  textSecondary: '#475569',
  textMuted: '#64748B',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  ring: '#0077B6',

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

  // Request statuses (keep compat)
  statusSubmitted: '#F59E0B',
  statusInReview: '#3B82F6',
  statusApproved: '#059669',
  statusPaid: '#059669',
  statusSigned: '#0077B6',
  statusDelivered: '#059669',
  statusRejected: '#EF4444',
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
  full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLg: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 5,
  },
  button: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
  doctorHeader: ['#005F8A', '#0077B6', '#0096D6'] as const,
  primary: ['#0077B6', '#005F8A'] as unknown as string[],
  secondary: ['#F4A261', '#E76F51'] as unknown as string[],
  subtle: ['#E0F2FE', '#F0F9FF'] as unknown as string[],
} as const;

export const typography = {
  fontFamily: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
} as const;
