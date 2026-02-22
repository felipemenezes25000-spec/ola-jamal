/**
 * Badge de status usando o design system central (getRequestUiState).
 * Cores: Azul = ação, Verde = sucesso, Amarelo = aguardando, Cinza = histórico.
 * Variações: success, warning, action, neutral (sem múltiplos estilos espalhados).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getRequestUiState, UI_STATUS_COLORS, type RequestUiColorKey } from '../lib/domain/getRequestUiState';
import type { RequestResponseDto } from '../types/database';

export type StatusBadgeVariantType = 'success' | 'warning' | 'action' | 'neutral';

const VARIANT_TO_COLOR_KEY: Record<StatusBadgeVariantType, RequestUiColorKey> = {
  success: 'success',
  warning: 'waiting',
  action: 'action',
  neutral: 'historical',
};

interface StatusBadgeProps {
  /** Backend status ou request (usa getRequestUiState) */
  status: string;
  size?: 'sm' | 'md';
}

interface StatusBadgeVariantProps {
  variant: StatusBadgeVariantType;
  label: string;
  size?: 'sm' | 'md';
}

/** Recebe request e exibe status com design system central */
export function StatusBadgeByRequest({
  request,
  size = 'md',
}: {
  request: RequestResponseDto;
  size?: 'sm' | 'md';
}) {
  const { label, colorKey } = getRequestUiState(request);
  const { color, bg } = UI_STATUS_COLORS[colorKey];
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: bg, maxWidth: 120 }, isSm && styles.badgeSm]}>
      <Text style={[styles.text, { color }, isSm && styles.textSm]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

/** Compatibilidade: recebe status string e usa mesmo design system */
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { label, colorKey } = getRequestUiState({ status });
  const { color, bg } = UI_STATUS_COLORS[colorKey];
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: bg, maxWidth: 120 }, isSm && styles.badgeSm]}>
      <Text style={[styles.text, { color }, isSm && styles.textSm]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

/** Badge por variante (success, warning, action, neutral) – design system único */
export function StatusBadgeVariant({ variant, label, size = 'md' }: StatusBadgeVariantProps) {
  const colorKey = VARIANT_TO_COLOR_KEY[variant];
  const { color, bg } = UI_STATUS_COLORS[colorKey];
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: bg, maxWidth: 120 }, isSm && styles.badgeSm]}>
      <Text style={[styles.text, { color }, isSm && styles.textSm]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export function getStatusLabel(status: string): string {
  return getRequestUiState({ status }).label;
}

export function getStatusColor(status: string): string {
  return UI_STATUS_COLORS[getRequestUiState({ status }).colorKey].color;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    flexShrink: 1,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
});
