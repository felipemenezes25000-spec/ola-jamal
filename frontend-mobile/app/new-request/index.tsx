import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard } from '../../components/ui';
import { haptics } from '../../lib/haptics';

const c = theme.colors;
const s = theme.spacing;
const r = theme.borderRadius;
const ty = theme.typography;

const OPTIONS = [
  {
    key: 'prescription' as const,
    label: 'Renovar Receita',
    desc: 'Solicitar renovação de receita médica',
    icon: 'document-text' as const,
    color: c.primary.main,
    bgColor: c.primary.soft + 'CC',
  },
  {
    key: 'exam' as const,
    label: 'Pedir Exame',
    desc: 'Solicitar exames e laudos',
    icon: 'flask' as const,
    color: c.status.info,
    bgColor: '#E0F2FE' + 'CC',
  },
  {
    key: 'consultation' as const,
    label: 'Consulta Breve +',
    desc: 'Atendimento por vídeo com o médico',
    icon: 'videocam' as const,
    color: c.accent.main,
    bgColor: c.accent.soft + 'CC',
  },
];

export default function NewRequestIndex() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 400;

  const handleSelect = (key: 'prescription' | 'exam' | 'consultation') => {
    haptics.selection();
    router.push(`/new-request/${key}`);
  };

  return (
    <Screen scroll edges={['bottom']}>
      <AppHeader title="Novo pedido" />
      <View style={styles.assistantCard}>
        <View style={styles.assistantHeader}>
          <Ionicons name="sparkles" size={22} color={c.primary.main} />
          <View style={styles.assistantTextWrap}>
            <Text style={styles.assistantTitle}>Dra. Renoveja: o que você precisa?</Text>
            <Text style={styles.assistantSubtitle}>
              Escolha o tipo de atendimento. Eu te guio em cada etapa ate o pedido ser enviado.
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ESCOLHA O TIPO DE PEDIDO</Text>
      <View style={[styles.optionsColumn, narrow && styles.optionsColumnNarrow]}>
        {OPTIONS.map((opt) => (
          <AppCard
            key={opt.key}
            style={styles.optionCard}
            onPress={() => handleSelect(opt.key)}
          >
            <View style={[styles.optionIconBox, { backgroundColor: opt.bgColor }]}>
              <Ionicons name={opt.icon} size={28} color={opt.color} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>{opt.label}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.text.tertiary} />
          </AppCard>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assistantCard: {
    marginTop: s.md,
    marginBottom: s.lg,
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.primary.soft,
    backgroundColor: c.primary.soft + '66',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
  },
  assistantTextWrap: { flex: 1 },
  assistantTitle: {
    fontSize: 15,
    fontWeight: ty.fontWeight.bold,
    color: c.primary.main,
    marginBottom: 4,
  },
  assistantSubtitle: {
    fontSize: 13,
    color: c.text.secondary,
    lineHeight: 20,
  },
  sectionLabel: {
    ...ty.variants.overline,
    color: c.text.secondary,
    marginBottom: s.sm,
  } as any,
  optionsColumn: {
    gap: s.sm,
  },
  optionsColumnNarrow: {
    gap: s.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s.md,
  },
  optionTextWrap: { flex: 1 },
  optionTitle: {
    fontSize: ty.fontSize.md,
    fontWeight: ty.fontWeight.semibold,
    color: c.text.primary,
  },
  optionDesc: {
    fontSize: 12,
    color: c.text.secondary,
    marginTop: 2,
  },
});
