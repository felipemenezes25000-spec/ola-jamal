import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacidade (LGPD)</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Política de Privacidade</Text>
        <Text style={styles.paragraph}>
          O RenoveJá+ está comprometido com a proteção dos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
        </Text>
        <Text style={styles.sectionTitle}>Dados que coletamos</Text>
        <Text style={styles.paragraph}>
          Coletamos dados necessários para prestar o serviço de telemedicina: nome, e-mail, telefone, CPF, data de nascimento e informações de saúde relacionadas às suas solicitações (receitas, exames, consultas).
        </Text>
        <Text style={styles.sectionTitle}>Finalidade do tratamento</Text>
        <Text style={styles.paragraph}>
          Utilizamos seus dados para: processar solicitações médicas, realizar pagamentos, comunicar atualizações sobre seu atendimento, cumprir obrigações legais e melhorar nossos serviços.
        </Text>
        <Text style={styles.sectionTitle}>Seus direitos</Text>
        <Text style={styles.paragraph}>
          Você tem direito a: acesso aos seus dados, correção de dados incorretos, exclusão dos dados (exceto quando houver obrigação legal de retenção), portabilidade e revogação do consentimento.
        </Text>
        <Text style={styles.sectionTitle}>Segurança</Text>
        <Text style={styles.paragraph}>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição.
        </Text>
        <Text style={styles.paragraph}>
          Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail de suporte disponível na área de Ajuda do aplicativo.
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
  paragraph: { ...typography.bodySmall, color: colors.gray700, marginBottom: spacing.md, lineHeight: 22 },
});
