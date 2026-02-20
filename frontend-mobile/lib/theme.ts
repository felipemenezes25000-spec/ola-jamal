/**
 * RenoveJá+ Design System
 * Tema global (light). Telas do médico usam lib/themeDoctor.ts (Stitch Ocean Blue).
 */

export const theme = {
  colors: {
    primary: {
      main: '#2CB1FF',
      light: '#5EC5FF',
      dark: '#1A9DE0',
      lighter: '#7DD3FC',
      darker: '#1595DC',
      soft: '#E3F4FF',
      ghost: 'rgba(44,177,255,0.08)',
      contrast: '#FFFFFF',
    },

    secondary: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      lighter: '#6EE7B7',
      darker: '#047857',
      soft: '#D1FAE5',
      contrast: '#FFFFFF',
    },

    accent: {
      main: '#8B5CF6',
      light: '#A78BFA',
      dark: '#7C3AED',
      soft: '#EDE9FE',
    },

    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
      secondary: '#F1F5F9',
      tertiary: '#EFF6FF',
      modal: 'rgba(0, 0, 0, 0.5)',
    },

    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#94A3B8',
      disabled: '#CBD5E1',
      inverse: '#FFFFFF',
    },

    status: {
      success: '#10B981',
      successLight: '#D1FAE5',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FEF3C7',
      info: '#3B82F6',
      infoLight: '#DBEAFE',
    },

    medical: {
      exam: '#8B5CF6',
      examLight: '#EDE9FE',
      prescription: '#EC4899',
      prescriptionLight: '#FCE7F3',
      consultation: '#0EA5E9',
      consultationLight: '#E0F2FE',
      appointment: '#F59E0B',
      appointmentLight: '#FEF3C7',
    },

    border: {
      main: '#E2E8F0',
      light: '#F1F5F9',
      dark: '#CBD5E1',
      focus: '#2CB1FF',
    },

    divider: '#E2E8F0',

    overlay: {
      light: 'rgba(0, 0, 0, 0.05)',
      medium: 'rgba(0, 0, 0, 0.1)',
      dark: 'rgba(0, 0, 0, 0.2)',
      darker: 'rgba(0, 0, 0, 0.4)',
    },

    gradients: {
      primary: ['#1A9DE0', '#2CB1FF'],
      secondary: ['#10B981', '#059669'],
      accent: ['#8B5CF6', '#7C3AED'],
      warm: ['#F59E0B', '#D97706'],
      authBackground: ['#FFFFFF', '#E8F4FE', '#B8DFFB', '#38BDF8'],
      splash: ['#0284C7', '#0EA5E9', '#38BDF8'],
      doctorHeader: ['#1A9DE0', '#2CB1FF'],
      patientHeader: ['#1A9DE0', '#2CB1FF', '#5EC5FF'],
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  borderRadius: {
    none: 0,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    xxl: 26,
    full: 9999,
    pill: 26,
    pillLg: 30,
    card: 18,
    button: 26,
    modal: 22,
    input: 26,
  },

  shadows: {
    none: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
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
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 8,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
    },
    button: {
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonSuccess: {
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonDanger: {
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
  },

  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },

    fontSize: {
      xs: 11,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 28,
      display: 32,
      hero: 36,
    },

    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },

    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },

    variants: {
      hero: {
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '800',
        letterSpacing: -0.5,
      },
      h1: {
        fontSize: 28,
        lineHeight: 36,
        fontWeight: '700',
        letterSpacing: -0.3,
      },
      h2: {
        fontSize: 22,
        lineHeight: 30,
        fontWeight: '700',
      },
      h3: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '600',
      },
      h4: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
      },
      body1: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
      },
      body2: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
      },
      button: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '700',
      },
      buttonSmall: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
      },
      caption: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
      },
      overline: {
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '700',
        textTransform: 'uppercase' as const,
        letterSpacing: 1.2,
      },
    },
  },

  layout: {
    container: {
      padding: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    screen: {
      padding: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    height: {
      button: 54,
      buttonSmall: 44,
      buttonLarge: 60,
      input: 54,
      inputSmall: 44,
      inputLarge: 60,
      header: 56,
      tabBar: 60,
      card: 'auto',
    },
    icon: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 32,
      xl: 40,
      xxl: 48,
    },
    avatar: {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 56,
      xl: 72,
      xxl: 96,
    },
  },

  animations: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
    },
    easing: {
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },

  opacity: {
    disabled: 0.5,
    hover: 0.8,
    pressed: 0.7,
    overlay: 0.5,
  },

  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
  },
} as const;

// Type exports
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeSpacing = typeof theme.spacing;
export type ThemeTypography = typeof theme.typography;

// Helper functions
export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = theme.colors;
  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      console.warn(`Color path "${path}" not found in theme`);
      return theme.colors.primary.main;
    }
  }
  return value as string;
};

export const getSpacing = (...multipliers: number[]): number | number[] => {
  const baseSpacing = theme.spacing.md;
  if (multipliers.length === 1) return baseSpacing * multipliers[0];
  return multipliers.map(m => baseSpacing * m);
};

export const getShadow = (level: keyof typeof theme.shadows) => theme.shadows[level];

// ============================================
// FLAT EXPORTS for easy component usage
// ============================================
export const colors = {
  primary: theme.colors.primary.main,
  primaryDark: theme.colors.primary.dark,
  primaryLight: theme.colors.primary.soft,
  primaryGhost: theme.colors.primary.ghost,
  secondary: theme.colors.secondary.main,
  secondaryDark: theme.colors.secondary.dark,
  accent: theme.colors.accent.main,
  accentSoft: theme.colors.accent.soft,
  background: theme.colors.background.default,
  surface: theme.colors.background.paper,
  surfaceSecondary: theme.colors.background.secondary,
  text: theme.colors.text.primary,
  textSecondary: theme.colors.text.secondary,
  textMuted: theme.colors.text.tertiary,
  border: theme.colors.border.main,
  borderLight: theme.colors.border.light,
  error: theme.colors.status.error,
  errorLight: theme.colors.status.errorLight,
  warning: theme.colors.status.warning,
  warningLight: theme.colors.status.warningLight,
  success: theme.colors.status.success,
  successLight: theme.colors.status.successLight,
  info: theme.colors.status.info,
  infoLight: theme.colors.status.infoLight,
  white: '#FFFFFF',
  // Status-specific
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

export const spacing = {
  xs: theme.spacing.xs,
  sm: theme.spacing.sm,
  md: theme.spacing.md,
  lg: theme.spacing.lg,
  xl: theme.spacing.xl,
  xxl: theme.spacing.xxl,
};

export const borderRadius = {
  xs: theme.borderRadius.xs,
  sm: theme.borderRadius.sm,
  md: theme.borderRadius.md,
  lg: theme.borderRadius.lg,
  xl: theme.borderRadius.xl,
  pill: theme.borderRadius.pill,
  card: theme.borderRadius.card,
  full: theme.borderRadius.full,
};

export const shadows = {
  card: theme.shadows.card,
  cardLg: theme.shadows.elevated,
  button: theme.shadows.button,
  sm: theme.shadows.sm,
};

export const gradients = {
  auth: theme.colors.gradients.authBackground as unknown as string[],
  splash: theme.colors.gradients.splash as unknown as string[],
  doctorHeader: theme.colors.gradients.doctorHeader as unknown as string[],
  patientHeader: theme.colors.gradients.patientHeader as unknown as string[],
  primary: theme.colors.gradients.primary as unknown as string[],
  secondary: theme.colors.gradients.secondary as unknown as string[],
};

export default theme;
