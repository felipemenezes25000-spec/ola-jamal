export const colors = {
  primary: '#0077B6',
  primaryLight: '#00A8E8',
  primaryLighter: '#90E0EF',
  primaryDark: '#005F8A',
  primaryDarker: '#023E58',
  primaryPale: '#CAF0F8',
  primaryPaler: '#E8F8FF',

  secondary: '#F4A261',
  secondaryLight: '#F4C089',
  secondaryDark: '#E07B3C',

  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#0077B6',
  infoLight: '#E8F8FF',

  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, lineHeight: 38, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.3 },
  h3: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySemiBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmallMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  captionSmall: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.5 },
  button: { fontSize: 16, fontWeight: '700' as const, lineHeight: 24 },
};

export const gradients = {
  primary: [colors.primary, colors.primaryDark] as const,
  primaryLight: [colors.primaryLight, colors.primary] as const,
  light: [colors.primaryPaler, colors.primaryPale] as const,
  pale: [colors.primaryPaler, '#F0F9FF'] as const,
  warm: [colors.secondary, colors.secondaryDark] as const,
  dark: [colors.primaryDark, colors.primaryDarker] as const,
  success: ['#10B981', '#059669'] as const,
};
