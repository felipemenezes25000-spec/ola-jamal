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

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';

type CardMode = 'auto' | 'conduct';

interface ObservationCardProps {
  mode: CardMode;
  text: string;
  doctorName?: string | null;
  /** Última edição da conduta (audit) */
  conductUpdatedAt?: string | null;
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ObservationCard({ mode, text, doctorName, conductUpdatedAt }: ObservationCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!text?.trim()) return null;

  const CONFIG: Record<CardMode, {
    bg: string; accentColor: string; accentBg: string;
    icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string;
    title: string; titleColor: string;
    badgeText: string; badgeBg: string; badgeColor: string;
  }> = {
    auto: {
      bg: colors.surfaceTertiary,
      accentColor: colors.primary,
      accentBg: colors.primarySoft,
      icon: 'information-circle',
      iconBg: colors.primarySoft,
      iconColor: colors.primaryDark,
      title: 'Observação',
      titleColor: colors.primaryDark,
      badgeText: 'Plataforma',
      badgeBg: colors.accentSoft,
      badgeColor: colors.accent,
    },
    conduct: {
      bg: colors.successLight,
      accentColor: colors.success,
      accentBg: colors.successLight,
      icon: 'clipboard',
      iconBg: colors.successLight,
      iconColor: colors.success,
      title: 'Conduta Médica',
      titleColor: colors.success,
      badgeText: 'Médico',
      badgeBg: colors.successLight,
      badgeColor: colors.success,
    },
  };
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

        {/* Audit: última edição da conduta */}
        {mode === 'conduct' && conductUpdatedAt && (
          <Text style={styles.auditMeta}>Editado em {fmtDateTime(conductUpdatedAt)}</Text>
        )}

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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as object,
    }),
  },
  accentBar: {
    width: 3.5,
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
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
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.2,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  auditMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 14,
  },
  });
}
