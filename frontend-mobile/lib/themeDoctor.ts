/**
 * RenoveJá+ Doctor Theme — Compatibility Layer
 *
 * Re-exports from designSystem.ts. New code should use `useAppTheme({ role: 'doctor' })`.
 * DO NOT add new tokens here.
 */

import {
  doctorTokens,
  spacing as dsSpacing,
  borderRadius as dsBorderRadius,
  shadows as dsShadows,
  typography as dsTypography,
  layout as dsLayout,
} from './designSystem';

export const colors = doctorTokens.colors;
export const spacing = dsSpacing;
export const borderRadius = dsBorderRadius;
export const shadows = dsShadows;
export const typography = dsTypography;

export const gradients = {
  doctorHeader: doctorTokens.gradients.doctorHeader,
  primary: doctorTokens.gradients.primary,
  subtle: doctorTokens.gradients.subtle,
};

/** Layout constants for doctor screens */
export const doctorDS = {
  cardRadius: dsBorderRadius.card,
  cardPadding: dsLayout.cardPadding,
  sectionGap: dsLayout.sectionGap,
  buttonHeight: dsLayout.buttonHeight,
  buttonRadius: dsBorderRadius.button,
  screenPaddingHorizontal: dsLayout.screenPaddingHorizontal,
} as const;
