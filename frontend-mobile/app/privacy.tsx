import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppHeader, AppCard } from '../components/ui';
import { theme } from '../lib/theme';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { COMPANY } from '../lib/company';

const s = theme.spacing;
const t = theme.typography;

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen scroll edges={['bottom']} padding={false}>
      <AppHeader title="Privacidade" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
          <Text style={styles.pageTitle}>POLÍTICA DE PRIVACIDADE – {COMPANY.name}</Text>
        </View>
        <Text style={styles.lastUpdate}>Última atualização: março de 2026</Text>

        <AppCard style={styles.card}>
          <Section title="1. Compromisso e base legal">
          A {COMPANY.name} está comprometida com a proteção dos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018), com o Marco Civil da Internet (Lei 12.965/2014) e com o Código de Defesa do Consumidor quando aplicável. O tratamento de dados de saúde é realizado com base, conforme o caso, na execução de contrato, no cumprimento de obrigação legal ou regulatória e na tutela da saúde (artigos 7º e 11 da LGPD), podendo ainda se apoiar em consentimento quando exigido pela legislação.
          </Section>

          <Section title="2. Controlador, DPO e finalidade">
            O controlador dos dados é {COMPANY.name}, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address}, responsável pelo aplicativo RenoveJá+. O Encarregado de Proteção de Dados (DPO) pode ser contatado por {COMPANY.fullContact} para exercício de direitos e esclarecimentos sobre tratamento de dados. Os dados são tratados para: prestação dos serviços de telemedicina (consultas, receitas, exames), processamento de pagamentos, comunicação sobre atendimento, cumprimento de obrigações legais e regulatórias (incluindo prontuário e normas do CFM), e melhoria dos serviços. Não utilizamos seus dados para finalidades incompatíveis com essas finalidades. A infraestrutura de armazenamento e processamento pode envolver provedores de computação em nuvem localizados no Brasil e no exterior, sempre com salvaguardas adequadas e contratos que asseguram proteção compatível com a LGPD.
          </Section>

          <Section title="3. Dados que coletamos">
            Coletamos dados de identificação e cadastro (nome, e-mail, telefone, CPF, data de nascimento, endereço quando aplicável) e dados sensíveis de saúde necessários ao atendimento: informações relacionadas a solicitações de receitas, exames e consultas, incluindo imagens e textos que você envia. Para médicos, podem ser tratados ainda CRM, especialidade e dados do certificado digital (a senha do certificado não é armazenada; é utilizada apenas no momento da assinatura). Nas consultas por vídeo: tratamos dados de voz na forma de transcrição em texto (não há gravação de áudio ou vídeo) e o texto processado por IA para fins de apoio à consulta, registro em prontuário e melhoria do serviço, em conformidade com a LGPD e com as normas do CFM; o tempo de retenção é alinhado ao prontuário e à legislação aplicável.
          </Section>

          <Section title="3.2. Uso de IA e operadores">
            Imagens de receita e exame são enviadas a provedor de IA (OpenAI) para análise e triagem — o médico sempre decide. O áudio da consulta é transcrito por provedor externo (Deepgram) e o texto pode ser processado por IA para anamnese. Não há gravação de áudio nem vídeo; apenas texto e dados estruturados são armazenados. Esses provedores são tratados como operadores com obrigações de confidencialidade e proteção de dados equivalentes às nossas.
          </Section>

          <Section title="3.1. Dados do assistente virtual e conduta médica">
            Além dos dados descritos na seção anterior, coletamos e tratamos: dados de interação com o assistente virtual de triagem (Dra. Renoveja), incluindo mensagens visualizadas e ações tomadas, para melhoria do serviço; condutas médicas registradas pelo profissional de saúde, que integram o prontuário eletrônico; e observações automáticas geradas pela plataforma, de caráter orientativo. Estes dados são tratados com as mesmas salvaguardas aplicadas aos demais dados de saúde, em conformidade com a LGPD.
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
  children: React.ReactNode;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.section, !last && styles.sectionBorder]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginBottom: s.xs,
    paddingHorizontal: s.xs,
  },
  lastUpdate: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: s.lg,
    paddingHorizontal: s.xs,
  },
  pageTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: t.fontWeight.bold,
    color: colors.text,
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
    borderBottomColor: colors.borderLight,
  },
  sectionTitle: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.bold,
    color: colors.text,
    marginBottom: s.sm,
  },
  paragraph: {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  });
}
