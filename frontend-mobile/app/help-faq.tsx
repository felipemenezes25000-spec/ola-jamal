import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useTriageEval } from '../hooks/useTriageEval';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, AppCard } from '../components/ui';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { COMPANY } from '../lib/company';

const FAQ_ITEMS = [
  {
    question: 'Como renovar uma receita?',
    answer:
      'Escolha o tipo de receita (simples ou controlada), tire uma foto ou envie da galeria, e aguarde a análise. Após aprovação do médico, a receita assinada ficará disponível para download. Em breve: renovação de receitas azuis (notificação B) e amarelas (notificação A) com fluxo específico de segurança.',
  },
  {
    question: 'Como solicitar exames?',
    answer:
      'Selecione o tipo (laboratorial ou imagem), liste os exames desejados (um por linha) e, se tiver, anexe o pedido anterior. O médico analisará e, após aprovação, o pedido assinado estará disponível.',
  },
  {
    question: 'Como funciona a consulta online?',
    answer:
      'Após informar seus sintomas, um médico disponível aceitará a solicitação e a consulta por vídeo será iniciada. A consulta é um plantão tira-dúvidas e não gera receita ou pedido de exame.',
  },
  {
    question: 'Como cancelar uma solicitação?',
    answer:
      'Entre em contato com o suporte antes que o médico inicie a análise. Após o início do atendimento, o cancelamento pode estar sujeito a políticas específicas.',
  },
];

const POLICY_SECTIONS = [
  {
    title: 'Política de cancelamento e reembolso',
    content: [
      'Receita/exame: Antes da aprovação do médico, cancelamento gratuito. Se rejeitada pelo médico, entre em contato. Após aprovação, antes do médico assinar: entre em contato. Após assinatura do documento, não há reembolso.',
      'Consulta: Antes do médico aceitar, cancelamento integral. Após aceite, antes de iniciar: entre em contato.',
    ],
  },
  {
    title: 'Triagem e decisão médica',
    content: [
      'Sua solicitação é analisada por um médico. O sistema usa inteligência artificial para organizar as informações e facilitar a análise — a decisão final (aprovar, rejeitar, solicitar mais dados) é sempre do médico.',
    ],
  },
  {
    title: 'Suporte',
    content: [
      'Horário de atendimento: seg a sex, 9h às 18h (horário de Brasília). Resposta em até 24 horas úteis. Em caso de urgência médica, procure um pronto-socorro ou ligue 192.',
    ],
  },
];

export default function HelpFaqScreen() {
  const { user } = useAuth();
  useTriageEval({ context: 'help', step: 'entry', role: user?.role === 'doctor' ? 'doctor' : 'patient' });
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const openWhatsApp = () => {
    Linking.openURL(COMPANY.whatsapp).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ajuda e FAQ" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Perguntas frequentes</Text>
        <AppCard style={styles.card}>
          {FAQ_ITEMS.map((item, idx) => (
            <View key={idx} style={idx < FAQ_ITEMS.length - 1 ? styles.faqItem : styles.faqItemLast}>
              <Text style={styles.question}>{item.question}</Text>
              <Text style={styles.answer}>{item.answer}</Text>
              {idx < FAQ_ITEMS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </AppCard>

        {POLICY_SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.policySection}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <AppCard style={styles.card}>
              {section.content.map((para, pIdx) => (
                <Text key={pIdx} style={[styles.answer, pIdx > 0 && styles.answerSpaced]}>
                  {para}
                </Text>
              ))}
            </AppCard>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Contato</Text>
        <AppCard style={styles.contactCard} onPress={openWhatsApp}>
          <View style={styles.contactRow}>
            <View style={[styles.contactIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactTitle}>Fale conosco</Text>
              <Text style={styles.contactSubtitle}>
                {COMPANY.phone} · {COMPANY.website}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </AppCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: uiTokens.sectionGap,
      marginBottom: uiTokens.cardGap,
      marginLeft: 4,
    },
    card: {
      marginBottom: 0,
    },
    faqItem: {
      paddingBottom: uiTokens.spacing.lg,
    },
    faqItemLast: {
      paddingBottom: 0,
    },
    question: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    answer: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      lineHeight: 21,
    },
    answerSpaced: {
      marginTop: 12,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginTop: uiTokens.spacing.lg,
      marginBottom: uiTokens.spacing.lg,
    },
    policySection: {
      marginTop: 4,
    },
    contactCard: {
      marginTop: 0,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    contactTextWrap: { flex: 1 },
    contactTitle: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.text,
    },
    contactSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    bottomSpacer: {
      height: uiTokens.sectionGap * 2,
    },
  });
}
