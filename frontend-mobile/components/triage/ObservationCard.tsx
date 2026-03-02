/**
 * ObservationCard — Card de observação/conduta na tela de detalhe (Camada C)
 *
 * Dois modos visuais:
 *   "auto"    → Fundo azul suave, readonly, badge "Plataforma"
 *   "conduct" → Fundo verde suave, do médico, badge "Dr(a). Nome"
 *
 * Separação visual CLARA entre conteúdo do sistema vs médico.
 * Compatível com o design system (theme.ts + InfoCard patterns).
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

type CardMode = 'auto' | 'conduct';

const CONFIG: Record<CardMode, {
  bg: string; accentColor: string; accentBg: string;
  icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string;
  title: string; titleColor: string;
  badgeText: string; badgeBg: string; badgeColor: string;
}> = {
  auto: {
    bg: theme.colors.background.tertiary,
    accentColor: theme.colors.primary.main,
    accentBg: theme.colors.primary.soft,
    icon: 'information-circle',
    iconBg: theme.colors.primary.soft,
    iconColor: theme.colors.primary.dark,
    title: 'Observação',
    titleColor: theme.colors.primary.dark,
    badgeText: 'Plataforma',
    badgeBg: theme.colors.accent.soft,
    badgeColor: theme.colors.accent.dark,
  },
  conduct: {
    bg: '#F0FDF4', // green-50
    accentColor: theme.colors.secondary.dark,
    accentBg: theme.colors.secondary.soft,
    icon: 'clipboard',
    iconBg: theme.colors.secondary.soft,
    iconColor: theme.colors.secondary.dark,
    title: 'Conduta Médica',
    titleColor: theme.colors.secondary.dark,
    badgeText: 'Médico',
    badgeBg: theme.colors.secondary.soft,
    badgeColor: theme.colors.secondary.dark,
  },
};

interface ObservationCardProps {
  mode: CardMode;
  text: string;
  doctorName?: string | null;
}

export function ObservationCard({ mode, text, doctorName }: ObservationCardProps) {
  if (!text?.trim()) return null;

  const c = CONFIG[mode];
  const badge = mode === 'conduct' && doctorName
    ? `Dr(a). ${doctorName}`
    : c.badgeText;

  return (
    <View
      style={[styles.card, { backgroundColor: c.bg }]}
      accessibilityRole="text"
      accessibilityLabel={`${c.title}: ${text}`}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: c.accentColor }]} />

      <View style={styles.body}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: c.iconBg }]}>
            <Ionicons name={c.icon} size={16} color={c.iconColor} />
          </View>
          <Text style={[styles.title, { color: c.titleColor }]}>{c.title}</Text>
          <View style={[styles.badge, { backgroundColor: c.badgeBg }]}>
            {mode === 'auto' && <Ionicons name="sparkles" size={8} color={c.badgeColor} style={{ marginRight: 3 }} />}
            <Text style={[styles.badgeText, { color: c.badgeColor }]}>{badge}</Text>
          </View>
        </View>

        {/* Body text */}
        <Text style={styles.bodyText}>{text}</Text>

        {/* Disclaimer for auto mode */}
        {mode === 'auto' && (
          <Text style={styles.disclaimer}>
            Orientação auxiliar da plataforma · Não substitui avaliação médica · O médico tem a decisão final
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: theme.shadows.sm,
      android: theme.shadows.sm,
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as object,
    }),
  },
  accentBar: {
    width: 3.5,
    alignSelf: 'stretch',
    borderTopLeftRadius: theme.borderRadius.md,
    borderBottomLeftRadius: theme.borderRadius.md,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.2,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.2,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: theme.colors.text.secondary,
  },
  disclaimer: {
    fontSize: 9,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 12,
  },
});
