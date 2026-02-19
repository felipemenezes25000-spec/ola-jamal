/**
 * Legacy theme - re-exports from lib/theme.ts
 * New code should import from '../lib/theme' directly
 */
import { theme, colors as themeColors, spacing as themeSpacing, borderRadius as themeBorderRadius, shadows as themeShadows, gradients as themeGradients } from '../lib/theme';

export const colors = {
  ...themeColors,
  primaryLighter: '#7DD3FC',
  primaryPale: '#BAE6FD',
  primaryPaler: '#E0F2FE',
  primaryDarker: '#075985',
  secondaryLight: '#34D399',

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

  transparent: 'transparent',
};

export const spacing = themeSpacing;

export const borderRadius = {
  ...themeBorderRadius,
  xxl: 28,
};

export const shadows = {
  ...themeShadows,
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
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
  ...themeGradients,
  primary: ['#0EA5E9', '#0284C7'] as const,
  primaryLight: ['#38BDF8', '#0EA5E9'] as const,
  light: ['#E0F2FE', '#BAE6FD'] as const,
  pale: ['#E0F2FE', '#F0F8FF'] as const,
  warm: ['#10B981', '#059669'] as const,
  dark: ['#0284C7', '#075985'] as const,
  success: ['#10B981', '#059669'] as const,
};

export { theme };
