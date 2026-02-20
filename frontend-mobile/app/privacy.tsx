import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppHeader, AppCard } from '../components/ui';
import { theme } from '../lib/theme';
import { COMPANY } from '../lib/company';

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
          <Text style={styles.pageTitle}>POLÍTICA DE PRIVACIDADE – {COMPANY.name}</Text>
        </View>

        <AppCard style={styles.card}>
          <Section title="1. Compromisso e base legal">
            A {COMPANY.name} está comprometida com a proteção dos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018), com o Marco Civil da Internet (Lei 12.965/2014) e com o Código de Defesa do Consumidor quando aplicável. O tratamento de dados de saúde é realizado com base em consentimento, execução de contrato e obrigação legal, conforme previsto na LGPD.
          </Section>

          <Section title="2. Controlador e finalidade">
            O controlador dos dados é {COMPANY.name}, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address}. Contato e canal para exercício de direitos em proteção de dados: {COMPANY.fullContact}. Os dados são tratados para: prestação dos serviços de telemedicina (consultas, receitas, exames), processamento de pagamentos, comunicação sobre atendimento, cumprimento de obrigações legais e regulatórias (incluindo prontuário e normas do CFM), e melhoria dos serviços. Não utilizamos seus dados para finalidades incompatíveis com essas finalidades.
          </Section>

          <Section title="3. Dados que coletamos">
            Coletamos dados de identificação e cadastro (nome, e-mail, telefone, CPF, data de nascimento, endereço quando aplicável) e dados sensíveis de saúde necessários ao atendimento: informações relacionadas a solicitações de receitas, exames e consultas, incluindo imagens e textos que você envia. Para médicos, podem ser tratados ainda CRM, especialidade e dados do certificado digital (a senha do certificado não é armazenada; é utilizada apenas no momento da assinatura). Nas consultas por vídeo: tratamos dados de voz na forma de transcrição em texto (não há gravação de áudio ou vídeo) e o texto processado por IA para fins de apoio à consulta, registro em prontuário e melhoria do serviço, em conformidade com a LGPD e com as normas do CFM; o tempo de retenção é alinhado ao prontuário e à legislação aplicável.
          </Section>

          <Section title="4. Compartilhamento e não comercialização">
            Seus dados não são vendidos nem cedidos a terceiros para fins de marketing. O compartilhamento ocorre apenas quando necessário à prestação do serviço (por exemplo, com o profissional de saúde que realiza o atendimento, com processadores de pagamento dentro dos limites contratuais) ou para cumprimento de obrigação legal ou determinação de autoridade competente. Podemos utilizar processadores que assumem obrigações de confidencialidade e segurança.
          </Section>

          <Section title="5. Retenção e segurança">
            Mantemos os dados pelo tempo necessário à prestação do serviço, ao cumprimento de obrigações legais (incluindo retenção de prontuários conforme normas do CFM) e à defesa em processos. Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição, em conformidade com as boas práticas de segurança da informação.
          </Section>

          <Section title="6. Seus direitos (LGPD)">
            Você tem direito a: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; portabilidade; eliminação dos dados tratados com consentimento (ressalvadas as hipóteses legais de retenção); revogação do consentimento; e informação sobre compartilhamento. Para exercer seus direitos ou esclarecer dúvidas sobre proteção de dados, entre em contato pelo aplicativo ou por {COMPANY.fullContact}. Você também pode acionar a Autoridade Nacional de Proteção de Dados (ANPD) em caso de insatisfação.
          </Section>

          <Section title="7. Alterações e contato" last>
            Esta Política de Privacidade pode ser alterada. Alterações relevantes serão comunicadas por meio do aplicativo ou e-mail. O uso continuado após as alterações constitui aceitação da nova versão. Para questões sobre proteção de dados e privacidade: {COMPANY.fullContact}.
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
