/**
 * Prontuário UI Primitives — Componentes compartilhados do prontuário médico.
 *
 * Elimina duplicação entre ClinicalOverviewTab, ConsultationsTab, DocumentsTab, etc.
 * Todos usam useAppTheme({ role: 'doctor' }) para dark mode automático.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography } from '../../lib/themeDoctor';

// ─── SectionCard — Card padronizado com borda-esquerda colorida ──────

interface SectionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  borderColor: string;
  /** Conteúdo colapsável? (default: false) */
  collapsible?: boolean;
  /** Se collapsible, estado inicial (default: true = aberto) */
  defaultExpanded?: boolean;
  children: React.ReactNode;
  style?: object;
}

export function SectionCard({
  icon, iconBg, iconColor, title, subtitle, borderColor,
  collapsible = false, defaultExpanded = true,
  children, style,
}: SectionCardProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => sectionCardStyles(colors), [colors]);
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const header = (
    <View style={S.header}>
      <View style={[S.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={S.headerText}>
        <Text style={S.title}>{title}</Text>
        {subtitle && <Text style={S.subtitle}>{subtitle}</Text>}
      </View>
      {collapsible && (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      )}
    </View>
  );

  return (
    <View style={[S.card, { borderLeftColor: borderColor }, style]}>
      {collapsible ? (
        <Pressable onPress={() => setExpanded(!expanded)}>
          {header}
        </Pressable>
      ) : header}
      {(!collapsible || expanded) && (
        <View style={S.body}>{children}</View>
      )}
    </View>
  );
}

function sectionCardStyles(colors: DesignColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderLeftWidth: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    title: {
      fontSize: 15,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    body: {
      marginTop: spacing.md,
    },
  });
}

// ─── QuickStat — Métrica compacta com ícone ──────────────────────

interface QuickStatProps {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label: string;
  color: string;
}

export function QuickStat({ icon, count, label, color }: QuickStatProps) {
  const { colors } = useAppTheme({ role: 'doctor' });

  return (
    <View style={sharedStyles.quickStatContainer}>
      <View style={sharedStyles.quickStatRow}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[sharedStyles.quickStatValue, { color: colors.text }]}>
          {count}
        </Text>
      </View>
      <Text style={[sharedStyles.quickStatLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── FieldRow — Linha de detalhe com ícone + label + valor ───────

interface FieldRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function FieldRow({ icon, label, value }: FieldRowProps) {
  const { colors } = useAppTheme({ role: 'doctor' });

  return (
    <View style={sharedStyles.fieldRowContainer}>
      <Ionicons name={icon} size={14} color={colors.textMuted} style={sharedStyles.fieldRowIcon} />
      <View style={sharedStyles.flexOne}>
        <Text style={[sharedStyles.fieldRowLabel, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text style={[sharedStyles.fieldRowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── CompactHeader — Header gradiente do prontuário ──────────────

interface CompactHeaderProps {
  title: string;
  subtitle?: string;
  topInset: number;
  onBack: () => void;
  colors: DesignColors;
  gradientColors: string[];
  hasAlerts?: boolean;
  /** Contadores rápidos no header */
  tabCounts?: { overview: number; consultations: number; documents: number; notes: number };
}

export function CompactHeader({
  title, subtitle, topInset, onBack, colors, gradientColors, hasAlerts,
}: CompactHeaderProps) {
  const S = useMemo(() => compactHeaderStyles(colors), [colors]);

  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[S.container, { paddingTop: topInset + 10 }]}>
        <TouchableOpacity
          onPress={onBack}
          style={S.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.headerOverlayText} />
        </TouchableOpacity>

        <View style={S.textCol}>
          <View style={S.titleRow}>
            <Text style={S.titleText} numberOfLines={1}>{title}</Text>
            {hasAlerts && <View style={S.alertDot} />}
          </View>
          {!!subtitle && (
            <Text style={S.subtitleText} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>

        <View style={sharedStyles.headerSpacer} />
      </View>
    </LinearGradient>
  );
}

function compactHeaderStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: 16,
      gap: 8,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.headerOverlayBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.headerOverlaySurface,
    },
    textCol: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.headerOverlayText,
      letterSpacing: 0.2,
      flexShrink: 1,
    },
    alertDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
      flexShrink: 0,
    },
    subtitleText: {
      fontSize: 12,
      color: colors.headerOverlayTextMuted,
      marginTop: 2,
      fontWeight: '600',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
  });
}

// ─── EmptySection — Estado vazio consistente para seções ─────────

interface EmptySectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}

export function EmptySection({ icon, message }: EmptySectionProps) {
  const { colors } = useAppTheme({ role: 'doctor' });

  return (
    <View style={sharedStyles.emptySectionContainer}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={[sharedStyles.emptySectionText, { color: colors.textMuted }]}>
        {message}
      </Text>
    </View>
  );
}

// ─── Disclaimer — Texto padronizado de disclaimer IA ─────────────

export function Disclaimer({ text }: { text?: string }) {
  const { colors } = useAppTheme({ role: 'doctor' });

  return (
    <Text style={[sharedStyles.disclaimerText, { color: colors.textMuted }]}>
      {text ?? 'Orientação geral · Decisão clínica sempre do médico'}
    </Text>
  );
}

// ─── Estilos estáticos compartilhados (sem cor — cores via inline) ─────
const sharedStyles = StyleSheet.create({
  quickStatContainer: { flex: 1, alignItems: 'center', gap: 2 },
  quickStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickStatValue: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
  },
  quickStatLabel: { fontSize: 11 },
  fieldRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3,
  },
  fieldRowIcon: { marginTop: 2 },
  flexOne: { flex: 1 },
  fieldRowLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldRowValue: { fontSize: 13, lineHeight: 19 },
  headerSpacer: { width: 44 },
  emptySectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptySectionText: { fontSize: 13, fontStyle: 'italic', flex: 1 },
  disclaimerText: { fontSize: 12, fontStyle: 'italic', marginTop: spacing.md },
});
