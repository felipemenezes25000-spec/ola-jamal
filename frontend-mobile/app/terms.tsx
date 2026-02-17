import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppHeader, AppCard } from '../components/ui';
import { theme } from '../lib/theme';

const c = theme.colors;
const s = theme.spacing;
const t = theme.typography;

export default function TermsScreen() {
  return (
    <Screen scroll edges={['bottom']} padding={false}>
      <AppHeader title="Termos de Uso" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="document-text-outline" size={24} color={c.primary.main} />
          <Text style={styles.pageTitle}>TERMOS DE USO – RenoveJá+</Text>
        </View>

        <AppCard style={styles.card}>
          <Section title="Aceitação dos Termos">
            Ao utilizar o aplicativo RenoveJá+, você concorda com os presentes Termos de Uso. O
            aplicativo oferece serviços de telemedicina, incluindo renovação de receitas,
            solicitação de exames e consultas online.
          </Section>

          <Section title="Uso adequado">
            O usuário compromete-se a fornecer informações verdadeiras e a utilizar o serviço
            apenas para fins legítimos de saúde. É vedado o uso fraudulento ou que viole a
            legislação vigente.
          </Section>

          <Section title="Responsabilidade">
            O RenoveJá+ atua como plataforma intermediária entre pacientes e médicos. Os
            atendimentos são realizados por profissionais devidamente registrados. O usuário é
            responsável por manter o sigilo de sua senha e por todas as atividades realizadas em
            sua conta.
          </Section>

          <Section title="Pagamentos">
            Os valores dos serviços estão disponíveis no aplicativo. O pagamento é processado de
            forma segura. Políticas de reembolso estão disponíveis na seção de Ajuda.
          </Section>

          <Section title="Alterações" last>
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações
            significativas serão comunicadas por meio do aplicativo. O uso continuado após as
            alterações constitui aceitação dos novos termos.
          </Section>
        </AppCard>
      </View>
    </Screen>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.section, !last && styles.sectionBorder]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginBottom: s.lg,
    paddingHorizontal: s.xs,
  },
  pageTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: t.fontWeight.bold,
    color: c.text.primary,
    flex: 1,
  },
  card: {
    padding: s.lg,
  },
  section: {
    paddingBottom: s.lg,
    marginBottom: s.lg,
  },
  sectionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: c.border.light,
  },
  sectionTitle: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.bold,
    color: c.text.primary,
    marginBottom: s.sm,
  },
  paragraph: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.regular,
    color: c.text.secondary,
    lineHeight: 22,
  },
});
