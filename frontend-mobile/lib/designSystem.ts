/**
 * RenoveJá+ Unified Design System v3 — SINGLE SOURCE OF TRUTH
 *
 * Factory `createTokens(role, scheme)` gera todos os tokens necessários.
 * Nenhum outro arquivo deve definir cores, spacing ou radius.
 *
 * MUDANÇAS v3:
 * - Cor primária unificada (palette-based, sem divergência BRAND vs palette)
 * - uiTokens incorporados (eliminado lib/ui/tokens.ts como fonte separada)
 * - themeDoctor/doctorDS incorporados (eliminado lib/themeDoctor.ts como fonte)
 * - Contraste de textMuted corrigido para WCAG AA
 * - Border radius unificado (card: 16, consistente doctor + patient)
 * - constants/theme.ts tornado 100% proxy
 *
 * PERF v3.1:
 * - createTokens agora retorna singletons por combinação (role × scheme).
 *   Só existem 4 combinações possíveis — o cache garante referência estável,
 *   evitando que useMemo([colors]) dispare sem necessidade em todo render.
 */

// ─── Paleta Primitiva (Tailwind Slate / Sky) ────────────────────
const palette = {
  primary: {
    50: '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 300: '#7DD3FC',
    400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1',
    800: '#075985', 900: '#0C4A6E', 950: '#082F49',
  },
  secondary: {
    50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
    400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
    800: '#115E59', 900: '#134E4A', 950: '#042F2E',
  },
  neutral: {
    0: '#FFFFFF', 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0',
    300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569',
    700: '#334155', 800: '#1E293B', 900: '#0F172A', 950: '#020617',
  },
  error:   { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
  warning: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
  success: { 50: '#F0FDF4', 100: '#DCFCE7', 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
  info:    { 50: '#EFF6FF', 100: '#DBEAFE', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
} as const;

export type ColorScheme = 'light' | 'dark';
export type AppRole = 'patient' | 'doctor';

// ─── Brand (derivado da palette — SEM divergência) ──────────────
const BRAND = {
  primary:      palette.primary[500],     // #0EA5E9 — cor principal unificada
  primaryLight: palette.primary[400],     // #38BDF8
  primaryDark:  palette.primary[700],     // #0369A1
  secondary:    palette.secondary[500],   // #14B8A6
  secondaryDark:palette.secondary[700],   // #0F766E
  accent:       '#8B5CF6',               // Violet 500
  white:        palette.neutral[0],
  black:        palette.neutral[900],
} as const;

// ─── Semantic Colors: Light ─────────────────────────────────────
const LIGHT_BASE = {
  overlayBackground: 'rgba(0,0,0,0.45)',
  modalOverlay: 'rgba(0,0,0,0.7)',
  background:       palette.neutral[50],
  surface:          palette.neutral[0],
  surfaceSecondary: palette.neutral[100],
  surfaceTertiary:  palette.neutral[200],
  text:             palette.neutral[900],
  textSecondary:    palette.neutral[600],   // #475569 — 7:1 ratio on white
  textMuted:        '#5B6E8A',              // WCAG AA fix: ~4.7:1 on surfaceSecondary (#F1F5F9), ~4.9:1 on white
  border:           palette.neutral[100],   // #F1F5F9 — spec: slate 100
  borderLight:      palette.neutral[100],
  primarySoft:      palette.primary[50],
  primaryGhost:     `${palette.primary[500]}14`, // 8% opacity

  successLight: palette.success[50],
  warningLight: palette.warning[50],
  errorLight:   palette.error[50],
  infoLight:    palette.info[50],

  success: palette.success[500],    // #22C55E — spec
  warning: palette.warning[500],    // #F59E0B — spec
  error:   palette.error[500],      // #EF4444 — spec
  info:    palette.info[500],
} as const;

// ─── Semantic Colors: Dark ──────────────────────────────────────
const DARK_BASE = {
  overlayBackground: 'rgba(0,0,0,0.7)',
  modalOverlay: 'rgba(0,0,0,0.85)',
  background:       palette.neutral[900],
  surface:          palette.neutral[800],
  surfaceSecondary: palette.neutral[700],
  surfaceTertiary:  palette.neutral[600],
  text:             palette.neutral[50],
  textSecondary:    palette.neutral[300],
  textMuted:        palette.neutral[400],   // Fine on dark backgrounds
  border:           palette.neutral[700],
  borderLight:      palette.neutral[800],
  primarySoft:      '#1e3a8a',              // Blue 900
  primaryGhost:     `${palette.primary[500]}26`, // 15% opacity

  successLight: '#064E3B',
  warningLight: '#451A03',
  errorLight:   '#450A0A',
  infoLight:    '#172554',

  success: '#34D399',
  warning: '#FBBF24',
  error:   '#F87171',
  info:    '#60A5FA',
} as const;

// ─── Doctor Dark (professional variant) ─────────────────────────
const DOCTOR_DARK = {
  ...DARK_BASE,
  background: '#0B1120',
  surface:    '#15202E',
  surfaceSecondary: '#1E293B',
  primarySoft: '#172554',
  ring: '#3B82F6',
} as const;

// ─── Header Overlay (text on gradient — always white) ───────────
const HEADER_OVERLAY = {
  headerOverlayText:          '#FFFFFF',
  headerOverlayTextMuted:     'rgba(255,255,255,0.75)',
  headerOverlayTextSubtle:    'rgba(255,255,255,0.55)',
  headerOverlayBorder:        'rgba(255,255,255,0.25)',
  headerOverlaySurface:       'rgba(255,255,255,0.18)',
  headerOverlaySurfaceActive: 'rgba(255,255,255,0.28)',
  headerOverlayDivider:       'rgba(255,255,255,0.12)',
} as const;

// ─── Gradients ──────────────────────────────────────────────────
function getGradients(scheme: ColorScheme) {
  const isDark = scheme === 'dark';
  return {
    auth:           isDark ? ['#0F172A', '#1E293B'] : [palette.neutral[50], palette.neutral[100]],
    authBackground: isDark ? ['#0F172A', '#1E293B'] : [palette.neutral[50], palette.neutral[100]],
    splash:         isDark ? ['#0F172A', palette.primary[700]] : [palette.primary[600], palette.primary[500], palette.primary[400]],
    doctorHeader:   isDark ? ['#0F172A', '#1E293B'] : [palette.primary[700], palette.primary[500]],
    patientHeader:  isDark ? ['#0F172A', '#1E293B'] : [palette.primary[600], palette.primary[500], palette.primary[400]],
    primary:        [palette.primary[600], palette.primary[500]] as const,
    secondary:      [palette.secondary[600], palette.secondary[500]] as const,
    subtle:         isDark ? ['#0F172A', '#1E293B'] : [palette.neutral[50], palette.neutral[100]],
  };
}

// ─── Typography ─────────────────────────────────────────────────
const TYPOGRAPHY = {
  fontFamily: {
    regular:  'PlusJakartaSans_400Regular',
    medium:   'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold:     'PlusJakartaSans_700Bold',
  },
  sizes:      { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 32 },
  fontSize:   { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 },
  fontWeight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const },
  lineHeights: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
  variants: {
    display:  { fontSize: 32, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.1,  fontWeight: '700' as const },
    h1:       { fontSize: 28, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.15, fontWeight: '700' as const },
    h2:       { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.2,  fontWeight: '700' as const },
    h3:       { fontSize: 18, fontFamily: 'PlusJakartaSans_600SemiBold',lineHeight: 1.25, fontWeight: '600' as const },
    title:    { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.2,  fontWeight: '700' as const },
    titleLg:  { fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.2,  fontWeight: '700' as const },
    label:    { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold',lineHeight: 1.25, fontWeight: '600' as const },
    overline: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold',    lineHeight: 1.25, letterSpacing: 1.0, fontWeight: '700' as const },
    body:     { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 1.5,  fontWeight: '400' as const },
    body2:    { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 1.5,  fontWeight: '400' as const },
    bodySm:   { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 1.5,  fontWeight: '400' as const },
    bodyLg:   { fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 1.5,  fontWeight: '400' as const },
    caption:  { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 1.25, fontWeight: '400' as const },
  },
} as const;

// ─── Spacing (unified — replaces uiTokens.spacing + theme.spacing) ──
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Border Radius (unified — single set for all) ──────────────
const BORDER_RADIUS = {
  xs:     6,
  sm:     10,
  md:     14,
  lg:     18,
  xl:     24,
  full:   9999,
  pill:   9999,
  card:   16,    // unified: was 20 in theme.ts, 16 in themeDoctor — using 16 for cleaner look
  button: 14,
  input:  12,
  modal:  20,
} as const;

// ─── Shadows ────────────────────────────────────────────────────
const SHADOWS = {
  none:     { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0,    shadowRadius: 0,  elevation: 0 },
  sm:       { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,  elevation: 1 },
  md:       { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
  lg:       { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  button:   { shadowColor: palette.primary[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  card:     { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardLg:   { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  elevated: { shadowColor: palette.neutral[900], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1,  shadowRadius: 20, elevation: 6 },
} as const;

// ─── Z-Index ────────────────────────────────────────────────────
const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  float: 1200,
  modal: 1300,
  toast: 1400,
  fixed: 1100,
} as const;

// ─── Opacity ────────────────────────────────────────────────────
const OPACITY = {
  disabled: 0.5,
  overlay: 0.5,
  pressed: 0.7,
  hover: 0.8,
} as const;

// ─── Layout Tokens (replaces uiTokens + doctorDS) ──────────────
const LAYOUT = {
  screenPaddingHorizontal: 20,
  maxContentWidth: 400,
  sectionGap: 24,
  cardGap: 12,
  inlineGap: 8,
  cardPadding: 16,
  buttonHeight: 48,
  buttonHeightLg: 52,
  iconSizes: { sm: 18, md: 20, lg: 22, xl: 32 },
  iconContainerSizes: { sm: 36, md: 38, lg: 40 },
  iconContainerRadius: { sm: 10, md: 11, lg: 12 },
  avatarSizes: { sm: 40, md: 48 },
} as const;

// ═════════════════════════════════════════════════════════════════
// FACTORY — Single entry point for all tokens
// ═════════════════════════════════════════════════════════════════

// Cache singleton: só existem 4 combinações (patient|doctor × light|dark).
// Garante referência estável — useMemo([colors]) não dispara sem necessidade.
type TokenResult = {
  role: AppRole;
  scheme: ColorScheme;
  colors: ReturnType<typeof _buildColors>;
  gradients: ReturnType<typeof getGradients>;
  spacing: typeof SPACING;
  borderRadius: typeof BORDER_RADIUS;
  radius: typeof BORDER_RADIUS;
  shadows: typeof SHADOWS;
  typography: typeof TYPOGRAPHY;
  layout: typeof LAYOUT;
  opacity: typeof OPACITY;
  zIndex: typeof Z_INDEX;
  palette: typeof palette;
};

const _tokenCache = new Map<string, TokenResult>();

function _buildColors(role: AppRole, scheme: ColorScheme) {
  const isDoctor = role === 'doctor';
  const isDark = scheme === 'dark';
  const base = isDoctor
    ? (isDark ? DOCTOR_DARK : LIGHT_BASE)
    : (isDark ? DARK_BASE : LIGHT_BASE);

  return {
    ...BRAND,
    ...base,
    ...HEADER_OVERLAY,
    white: BRAND.white,
    black: BRAND.black,
    destructive: isDark ? '#F87171' : '#DC2626',

    // Status aliases (flat)
    statusSubmitted:        base.warning,
    statusInReview:         base.info,
    statusApproved:         base.success,
    statusPaid:             base.success,
    statusSigned:           base.textSecondary,
    statusDelivered:        base.success,
    statusRejected:         base.error,
    statusCancelled:        base.textMuted,
    statusSearching:        base.warning,
    statusConsultationReady:base.info,
    statusInConsultation:   base.warning,
    statusFinished:         base.success,

    // Extended semantic
    muted:          'muted' in base ? (base as any).muted : base.surfaceSecondary,
    secondarySoft:  isDoctor && isDark ? '#3A2010' : '#FFF3E6',
    accentSoft:     isDark ? '#2E1065' : '#EDE9FE',
    warningYellow:  isDark ? '#FACC15' : '#EAB308',

    // Legacy compat
    ring: (base as any).ring || palette.primary[500],
  };
}

/** Retorna tokens estáveis por referência — mesma combinação role+scheme
 *  sempre devolve o MESMO objeto, evitando re-renders em cascata nos
 *  componentes que fazem useMemo(() => makeStyles(colors), [colors]). */
export function createTokens(role: AppRole, scheme: ColorScheme): TokenResult {
  const key = `${role}-${scheme}`;
  let cached = _tokenCache.get(key);
  if (!cached) {
    cached = {
      role,
      scheme,
      colors: _buildColors(role, scheme),
      gradients:    getGradients(scheme),
      spacing:      SPACING,
      borderRadius: BORDER_RADIUS,
      radius:       BORDER_RADIUS,
      shadows:      SHADOWS,
      typography:   TYPOGRAPHY,
      layout:       LAYOUT,
      opacity:      OPACITY,
      zIndex:       Z_INDEX,
      palette,
    };
    _tokenCache.set(key, cached);
  }
  return cached;
}

// ─── Static Exports (compatibility) ─────────────────────────────
export const patientTokens = createTokens('patient', 'light');
export const doctorTokens  = createTokens('doctor', 'light');

export type DesignTokens = TokenResult;
export type DesignColors  = DesignTokens['colors'];

// ─── Legacy re-exports for files that import from './theme' ─────
export const spacing      = SPACING;
export const borderRadius = BORDER_RADIUS;
export const shadows      = SHADOWS;
export const typography   = TYPOGRAPHY;
export const layout       = LAYOUT;
