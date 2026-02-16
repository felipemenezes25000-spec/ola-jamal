/**
 * RenoveJá+ Design System
 * Complete theme configuration for the telemedicine mobile app
 */

export const theme = {
  colors: {
    // Primary colors
    primary: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
      lighter: '#7DD3FC',
      darker: '#075985',
      contrast: '#FFFFFF',
    },

    // Secondary colors
    secondary: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      lighter: '#6EE7B7',
      darker: '#047857',
      contrast: '#FFFFFF',
    },

    // Background colors
    background: {
      default: '#F0F8FF',
      paper: '#FFFFFF',
      secondary: '#F8FAFC',
      tertiary: '#EFF6FF',
      modal: 'rgba(0, 0, 0, 0.5)',
    },

    // Text colors
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
      tertiary: '#94A3B8',
      disabled: '#CBD5E1',
      inverse: '#FFFFFF',
    },

    // Status colors
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

    // Medical-specific colors
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

    // Border colors
    border: {
      main: '#E2E8F0',
      light: '#F1F5F9',
      dark: '#CBD5E1',
      focus: '#0EA5E9',
    },

    // Divider
    divider: '#E2E8F0',

    // Overlay
    overlay: {
      light: 'rgba(0, 0, 0, 0.05)',
      medium: 'rgba(0, 0, 0, 0.1)',
      dark: 'rgba(0, 0, 0, 0.2)',
      darker: 'rgba(0, 0, 0, 0.4)',
    },

    // Gradients
    gradients: {
      primary: ['#0EA5E9', '#0284C7'],
      secondary: ['#10B981', '#059669'],
      accent: ['#8B5CF6', '#7C3AED'],
      warm: ['#F59E0B', '#D97706'],
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
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
    button: 12,
    card: 16,
    modal: 20,
    input: 8,
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
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    card: {
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    button: {
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },

  typography: {
    // Font families
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },

    // Font sizes
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 28,
      display: 32,
      hero: 36,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },

    // Font weights
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },

    // Text variants
    variants: {
      h1: {
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '700',
      },
      h2: {
        fontSize: 28,
        lineHeight: 36,
        fontWeight: '700',
      },
      h3: {
        fontSize: 24,
        lineHeight: 32,
        fontWeight: '600',
      },
      h4: {
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '600',
      },
      h5: {
        fontSize: 18,
        lineHeight: 24,
        fontWeight: '600',
      },
      h6: {
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
        fontWeight: '600',
      },
      caption: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400',
      },
      overline: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        textTransform: 'uppercase' as const,
        letterSpacing: 1.2,
      },
    },
  },

  layout: {
    // Container padding
    container: {
      padding: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },

    // Screen padding
    screen: {
      padding: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },

    // Component heights
    height: {
      button: 48,
      buttonSmall: 36,
      buttonLarge: 56,
      input: 48,
      inputSmall: 40,
      inputLarge: 56,
      header: 56,
      tabBar: 60,
      card: 'auto',
    },

    // Icon sizes
    icon: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 32,
      xl: 40,
      xxl: 48,
    },

    // Avatar sizes
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
    // Duration
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
    },

    // Easing
    easing: {
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },

  opacity: {
    disabled: 0.4,
    hover: 0.8,
    pressed: 0.6,
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

// Type exports for TypeScript
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

  if (multipliers.length === 1) {
    return baseSpacing * multipliers[0];
  }

  return multipliers.map(m => baseSpacing * m);
};

export const getShadow = (level: keyof typeof theme.shadows) => {
  return theme.shadows[level];
};

// ============================================
// FLAT EXPORTS for easy component usage
// ============================================
export const colors = {
  primary: theme.colors.primary.main,
  primaryDark: theme.colors.primary.dark,
  primaryLight: '#E0F2FE',
  secondary: theme.colors.secondary.main,
  secondaryDark: theme.colors.secondary.dark,
  background: theme.colors.background.default,
  surface: theme.colors.background.paper,
  text: theme.colors.text.primary,
  textSecondary: theme.colors.text.secondary,
  textMuted: theme.colors.text.tertiary,
  border: '#E2E8F0',
  error: theme.colors.status.error,
  warning: theme.colors.status.warning,
  success: theme.colors.status.success,
  info: theme.colors.status.info,
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
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
};

export default theme;
