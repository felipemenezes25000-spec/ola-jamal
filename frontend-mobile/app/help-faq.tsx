import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTriageEval } from '../hooks/useTriageEval';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../lib/theme';
import { COMPANY } from '../lib/company';

export default function HelpFaqScreen() {
  const router = useRouter();
  const { user } = useAuth();
  useTriageEval({ context: 'help', step: 'entry', role: user?.role === 'doctor' ? 'doctor' : 'patient' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda e FAQ</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Perguntas Frequentes</Text>

        <Text style={styles.question}>Como renovar uma receita?</Text>
        <Text style={styles.answer}>
          Escolha o tipo de receita (simples, controlada ou azul), tire uma foto ou envie da galeria, e aguarde a análise. Após aprovação do médico, realize o pagamento e a receita assinada ficará disponível para download.
        </Text>

        <Text style={styles.question}>Como solicitar exames?</Text>
        <Text style={styles.answer}>
          Selecione o tipo (laboratorial ou imagem), liste os exames desejados (um por linha) e, se tiver, anexe o pedido anterior. O médico analisará e, após aprovação e pagamento, o pedido assinado estará disponível.
        </Text>

        <Text style={styles.question}>Como funciona a consulta online?</Text>
        <Text style={styles.answer}>
          Após informar seus sintomas e realizar o pagamento, um médico disponível aceitará a solicitação e a consulta por vídeo será iniciada. A consulta é um plantão tira-dúvidas e não gera receita ou pedido de exame.
        </Text>

        <Text style={styles.question}>Formas de pagamento?</Text>
        <Text style={styles.answer}>
          Aceitamos PIX e cartão de crédito através do Mercado Pago. O pagamento via PIX é processado de forma instantânea.
        </Text>

        <Text style={styles.question}>Como cancelar uma solicitação?</Text>
        <Text style={styles.answer}>
          Entre em contato com o suporte antes que o médico inicie a análise. Após o início do atendimento, o cancelamento pode estar sujeito a políticas específicas.
        </Text>

        <Text style={styles.sectionTitle}>Política de cancelamento e reembolso</Text>
        <Text style={styles.answer}>
          Receita/exame: Antes da aprovação do médico, cancelamento gratuito. Se rejeitada pelo médico, estorno integral. Após aprovação e pagamento, antes do médico assinar: entre em contato para avaliar estorno. Após assinatura do documento, não há reembolso.
        </Text>
        <Text style={styles.answer}>
          Consulta: Antes do médico aceitar, cancelamento e estorno integral. Após aceite, antes de iniciar: entre em contato. Banco de minutos não utilizados: crédito pode ser utilizado em nova consulta ou estorno proporcional mediante solicitação.
        </Text>
        <Text style={styles.answer}>
          Prazo de processamento do estorno: até 7 dias úteis (conforme operadora PIX/cartão).
        </Text>

        <Text style={styles.sectionTitle}>Triagem e decisão médica</Text>
        <Text style={styles.answer}>
          Sua solicitação é analisada por um médico. O sistema usa inteligência artificial para organizar as informações e facilitar a análise — a decisão final (aprovar, rejeitar, solicitar mais dados) é sempre do médico.
        </Text>

        <Text style={styles.sectionTitle}>Suporte</Text>
        <Text style={styles.answer}>
          Horário de atendimento: seg a sex, 9h às 18h (horário de Brasília). Resposta em até 24 horas úteis. Em caso de urgência médica, procure um pronto-socorro ou ligue 192.
        </Text>

        <Text style={styles.sectionTitle}>Contato</Text>
        <Text style={styles.paragraph}>
          Para dúvidas ou problemas: {COMPANY.phone} ou {COMPANY.website}. O canal de suporte também está disponível na área de Configurações do app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  question: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: spacing.md },
  answer: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md, lineHeight: 20 },
  paragraph: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 22 },
});
