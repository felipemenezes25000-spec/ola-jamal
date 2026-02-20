import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';
import { COMPANY } from '../lib/company';

export default function HelpFaqScreen() {
  const router = useRouter();

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

        <Text style={styles.sectionTitle}>Contato</Text>
        <Text style={styles.paragraph}>
          Para dúvidas ou problemas: {COMPANY.phone} ou {COMPANY.website}. O canal de suporte também está disponível na área de Configurações do app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    ...typography.bodySemiBold,
    color: colors.gray800,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  question: { ...typography.bodySmallMedium, color: colors.gray800, marginTop: spacing.md },
  answer: { ...typography.bodySmall, color: colors.gray600, marginTop: 4, marginBottom: spacing.md, lineHeight: 20 },
  paragraph: { ...typography.bodySmall, color: colors.gray700, marginBottom: spacing.md, lineHeight: 22 },
});
