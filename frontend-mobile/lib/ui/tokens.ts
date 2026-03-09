/**
 * UI Tokens — Compatibility Layer
 *
 * Re-exports layout tokens from designSystem.ts.
 * New code should use `useAppTheme().layout` or import from designSystem directly.
 */

import { layout, spacing, borderRadius } from '../designSystem';

export const uiTokens = {
  spacing: {
    xs: spacing.xs,     // 4
    sm: spacing.sm,     // 8
    md: 12,             // kept for backward compat — components rely on 12
    lg: spacing.md,     // 16
    xl: layout.screenPaddingHorizontal, // 20
    xxl: spacing.lg,    // 24
    xxxl: spacing.xl,   // 32
  },
  borderRadius: {
    sm: borderRadius.sm,      // 10 → was 12
    md: borderRadius.card,    // 16
    lg: borderRadius.xl,      // 24
    pill: borderRadius.pill,  // 9999
    card: borderRadius.card,  // 16
  },
  iconSizes: layout.iconSizes,
  avatarSizes: layout.avatarSizes,
  sectionGap: layout.sectionGap,
  cardGap: layout.cardGap,
  inlineGap: layout.inlineGap,
  screenPaddingHorizontal: layout.screenPaddingHorizontal,
  maxContentWidth: layout.maxContentWidth,
} as const;

export type UiTokens = typeof uiTokens;
