import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppHeader, AppCard } from '../components/ui';
import { theme } from '../lib/theme';

const c = theme.colors;
const s = theme.spacing;
const t = theme.typography;

export default function PrivacyScreen() {
  return (
    <Screen scroll edges={['bottom']} padding={false}>
      <AppHeader title="Privacidade" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="lock-closed-outline" size={24} color={c.primary.main} />
          <Text style={styles.pageTitle}>POLÍTICA DE PRIVACIDADE – RenoveJá+</Text>
        </View>

        <AppCard style={styles.card}>
          <Section title="Política de Privacidade">
            O RenoveJá+ está comprometido com a proteção dos seus dados pessoais em conformidade
            com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
          </Section>

          <Section title="Dados que coletamos">
            Coletamos dados necessários para prestar o serviço de telemedicina: nome, e-mail,
            telefone, CPF, data de nascimento e informações de saúde relacionadas às suas
            solicitações (receitas, exames, consultas).
          </Section>

          <Section title="Finalidade do tratamento">
            Utilizamos seus dados para: processar solicitações médicas, realizar pagamentos,
            comunicar atualizações sobre seu atendimento, cumprir obrigações legais e melhorar
            nossos serviços.
          </Section>

          <Section title="Seus direitos">
            Você tem direito a: acesso aos seus dados, correção de dados incorretos, exclusão dos
            dados (exceto quando houver obrigação legal de retenção), portabilidade e revogação do
            consentimento.
          </Section>

          <Section title="Segurança" last>
            Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
            autorizado, alteração, divulgação ou destruição. Para exercer seus direitos ou
            esclarecer dúvidas, entre em contato pelo e-mail de suporte disponível na área de
            Ajuda do aplicativo.
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
