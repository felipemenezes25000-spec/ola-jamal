import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { Screen } from '../../components/ui/Screen';
import { AppCard } from '../../components/ui';
import { haptics } from '../../lib/haptics';

const s = theme.spacing;
const _r = theme.borderRadius;
const ty = theme.typography;

const ACCENT_COLORS = {
  prescription: '#0EA5E9',
  exam: '#22C55E',
  consultation: '#8B5CF6',
} as const;

export default function NewRequestIndex() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 400;
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, narrow), [colors, narrow]);

  const OPTIONS = [
    {
      key: 'prescription' as const,
      label: 'Receita',
      desc: 'Solicitar renovação ou nova receita médica',
      icon: 'clipboard-outline' as const,
      accent: ACCENT_COLORS.prescription,
      accentBg: ACCENT_COLORS.prescription + '14',
    },
    {
      key: 'exam' as const,
      label: 'Exame',
      desc: 'Solicitar pedido de exames laboratoriais',
      icon: 'flask-outline' as const,
      accent: ACCENT_COLORS.exam,
      accentBg: ACCENT_COLORS.exam + '14',
    },
    {
      key: 'consultation' as const,
      label: 'Consulta',
      desc: 'Agendar uma teleconsulta com médico',
      icon: 'videocam-outline' as const,
      accent: ACCENT_COLORS.consultation,
      accentBg: ACCENT_COLORS.consultation + '14',
    },
  ];

  const handleSelect = (key: 'prescription' | 'exam' | 'consultation') => {
    haptics.selection();
    router.push(`/new-request/${key}`);
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Text style={styles.title}>Novo Pedido</Text>
      <Text style={styles.subtitle}>
        Escolha o tipo de atendimento que você precisa
      </Text>

      <View style={styles.optionsColumn}>
        {OPTIONS.map((opt) => (
          <AppCard
            key={opt.key}
            style={styles.optionCard}
            onPress={() => handleSelect(opt.key)}
            accessibilityLabel={`${opt.label}: ${opt.desc}`}
          >
            <View style={[styles.leftBorder, { backgroundColor: opt.accent }]} />
            <View style={[styles.optionIconBox, { backgroundColor: opt.accentBg }]}>
              <Ionicons name={opt.icon} size={26} color={opt.accent} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>{opt.label}</Text>
              <Text style={styles.optionDesc} numberOfLines={2}>{opt.desc}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
              importantForAccessibility="no"
            />
          </AppCard>
        ))}
      </View>
    </Screen>
  );
}

function makeStyles(colors: DesignColors, narrow: boolean) {
  return StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.lg,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: s.lg,
      lineHeight: 20,
    },
    optionsColumn: {
      gap: narrow ? s.sm : s.md,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 0,
      paddingRight: s.md,
      minHeight: narrow ? 80 : 88,
      borderRadius: 16,
      overflow: 'hidden',
    },
    leftBorder: {
      width: 4,
      alignSelf: 'stretch',
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    optionIconBox: {
      width: narrow ? 44 : 48,
      height: narrow ? 44 : 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: s.md,
      marginRight: s.md,
    },
    optionTextWrap: {
      flex: 1,
      paddingVertical: s.md,
    },
    optionTitle: {
      fontSize: ty.fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    optionDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
  });
}
