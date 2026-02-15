import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termos de Uso</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Aceitação dos Termos</Text>
        <Text style={styles.paragraph}>
          Ao utilizar o aplicativo RenoveJá+, você concorda com os presentes Termos de Uso. O aplicativo oferece serviços de telemedicina, incluindo renovação de receitas, solicitação de exames e consultas online.
        </Text>
        <Text style={styles.sectionTitle}>Uso adequado</Text>
        <Text style={styles.paragraph}>
          O usuário compromete-se a fornecer informações verdadeiras e a utilizar o serviço apenas para fins legítimos de saúde. É vedado o uso fraudulento ou que viole a legislação vigente.
        </Text>
        <Text style={styles.sectionTitle}>Responsabilidade</Text>
        <Text style={styles.paragraph}>
          O RenoveJá+ atua como plataforma intermediária entre pacientes e médicos. Os atendimentos são realizados por profissionais devidamente registrados. O usuário é responsável por manter o sigilo de sua senha e por todas as atividades realizadas em sua conta.
        </Text>
        <Text style={styles.sectionTitle}>Pagamentos</Text>
        <Text style={styles.paragraph}>
          Os valores dos serviços estão disponíveis no aplicativo. O pagamento é processado de forma segura. Políticas de reembolso estão disponíveis na seção de Ajuda.
        </Text>
        <Text style={styles.sectionTitle}>Alterações</Text>
        <Text style={styles.paragraph}>
          Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações significativas serão comunicadas por meio do aplicativo. O uso continuado após as alterações constitui aceitação dos novos termos.
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
