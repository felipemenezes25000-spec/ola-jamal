import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, AppCard } from '../components/ui';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { COMPANY } from '../lib/company';

export default function TermsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Termos de Uso" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          <Text style={styles.pageTitle}>Termos de Uso – {COMPANY.name}</Text>
        </View>
        <Text style={styles.lastUpdate}>Última atualização: abril de 2026</Text>

        <AppCard style={styles.card}>
          <Section title="1. Identificação do prestador">
            {COMPANY.name}, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address}. Contato: {COMPANY.fullContact}. Estes Termos regem o uso do aplicativo RenoveJá+ e dos serviços de telemedicina oferecidos pela plataforma.
          </Section>

          <Section title="2. Aceitação dos Termos">
            Ao utilizar o aplicativo RenoveJá+ ({COMPANY.name}), você declara ter lido, compreendido e aceitado os presentes Termos de Uso. O cadastro e o uso dos serviços constituem aceitação eletrônica. Os serviços são oferecidos a maiores de 18 anos ou com representação legal. O aplicativo oferece serviços de telemedicina em conformidade com a legislação brasileira, incluindo renovação de receitas (simples e controladas), solicitação de exames e consultas online. Em breve: renovação de receitas azuis (notificação B) e amarelas (notificação A) com fluxo específico de segurança.
          </Section>

          <Section title="3. Definições">
            Plataforma: ambiente digital RenoveJá+ ({COMPANY.name}). Usuários: pacientes e médicos cadastrados. Serviços: telemedicina (consultas, receitas, exames) realizados por profissionais com registro ativo no Conselho Federal de Medicina (CFM) ou conselho de classe competente. A plataforma atua como intermediária entre usuários e profissionais de saúde.
          </Section>

          <Section title="4. Telemedicina e normativas">
            Os atendimentos realizados na plataforma observam a Resolução CFM nº 2.314/2022 (telemedicina) e normas do CFM aplicáveis. As consultas são registradas em prontuário eletrônico, com identificação do profissional e do paciente. O médico mantém autonomia para indicar atendimento presencial quando necessário.
          </Section>

          <Section title="5. Limitação de responsabilidade">
            A {COMPANY.name} é responsável pelo meio tecnológico e pelo funcionamento da plataforma RenoveJá+. O conteúdo clínico e as condutas médicas são de responsabilidade exclusiva do profissional que realiza o atendimento. O teleatendimento não substitui o exame físico quando este for indispensável; caberá ao médico a decisão de encaminhar o paciente ao presencial. O usuário (paciente) é responsável pela veracidade das informações fornecidas e pelo sigilo de sua senha.
          </Section>

          <Section title="5.1. Assistente virtual de triagem">
            O assistente virtual de triagem (Dra. Renoveja) é uma ferramenta de apoio que acompanha o paciente durante o uso do aplicativo. Suas funções incluem: orientar sobre o fluxo de cada serviço; fornecer lembretes sobre a importância do acompanhamento médico presencial; sugerir teleconsulta quando identificar padrões que indiquem necessidade de atenção profissional; e informar sobre cuidados gerais de saúde. O assistente não realiza diagnóstico, não prescreve medicamentos e não substitui a avaliação médica. As mensagens são geradas automaticamente com base em regras predefinidas e análise de contexto, podendo utilizar inteligência artificial.
          </Section>

          <Section title="5.2. Conduta médica e observações">
            A plataforma permite que o médico registre condutas e recomendações clínicas no prontuário eletrônico do paciente. Observações automáticas de caráter orientativo são incluídas nos documentos emitidos (receitas e pedidos de exame) com o objetivo de reforçar a importância do acompanhamento médico contínuo. Estas observações não substituem a avaliação médica individual. O médico pode editar, complementar ou remover as observações antes da assinatura do documento.
          </Section>

          <Section title="5.3. Uso de inteligência artificial">
            O RenoveJá+ utiliza recursos de inteligência artificial para triagem pré-atendimento, auxílio na leitura de receitas e exames, geração de sugestões de conduta médica, transcrição de consultas por vídeo e interação proativa com o paciente por meio do assistente virtual. As decisões clínicas finais permanecem sob responsabilidade exclusiva do médico. O usuário está ciente e concorda com o uso dessas ferramentas nos termos da Política de Privacidade. Alguns desses recursos podem ser operados por provedores externos de computação em nuvem, contratados pela plataforma, os quais assumem obrigações de confidencialidade e proteção de dados equivalentes às adotadas pela {COMPANY.name}.
          </Section>

          <Section title="6.1. Consultas por vídeo – informação ao paciente">
            Nas consultas por vídeo, a conversa pode ser transcrita em tempo quase real (apenas em texto) e o texto pode ser processado por ferramentas de inteligência artificial para auxiliar o médico (estruturação de anamnese e sugestões de apoio). A sessão de vídeo poderá ser gravada para segurança e auditoria, com armazenamento seguro e acesso restrito. O texto da transcrição e os dados estruturados (anamnese) são armazenados e integram o prontuário eletrônico do paciente, nos termos da Resolução CFM nº 2.314/2022 e das normas do CFM aplicáveis. O uso está em conformidade com a LGPD (finalidade legítima, apoio à prestação do serviço de saúde e ao prontuário) e com a Política de Privacidade da plataforma. Ao agendar ou iniciar uma consulta por vídeo, o paciente declara estar ciente dessas condições.
          </Section>

          <Section title="6.2. Uso profissional – médicos">
            A plataforma pode utilizar transcrição em tempo quase real e inteligência artificial (estruturação de anamnese e sugestões) como apoio durante a consulta por vídeo. A decisão clínica e a responsabilidade são exclusivamente do médico; a IA atua como ferramenta de apoio (copiloto) e não substitui o julgamento profissional, em conformidade com o Código de Ética Médica e com as resoluções do CFM. O transcript e a anamnese gerados são incorporados ao prontuário eletrônico do paciente e ficam acessíveis a outros médicos que atendam o paciente, nos termos da legislação e das boas práticas de prontuário.
          </Section>

          <Section title="7. Uso adequado">
            O usuário compromete-se a fornecer informações verdadeiras e a utilizar o RenoveJá+ apenas para fins legítimos de saúde. É vedado o uso fraudulento, a violação de legislação vigente ou de normas dos conselhos de classe. O descumprimento pode resultar em cancelamento da conta e medidas legais cabíveis.
          </Section>

          <Section title="8. Serviços e cancelamento">
            Os serviços são oferecidos conforme disponibilização no aplicativo RenoveJá+. Políticas de cancelamento estão disponíveis na seção de Ajuda. Em caso de dúvidas, o consumidor pode acionar os canais de atendimento ({COMPANY.fullContact}) e, se necessário, os órgãos de defesa do consumidor.
          </Section>

          <Section title="9. Alterações e lei aplicável">
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações significativas serão comunicadas por meio do aplicativo ou e-mail. O uso continuado após as alterações constitui aceitação dos novos termos. Estes Termos são regidos pelas leis da República Federativa do Brasil. Para questões relativas a dados pessoais, aplica-se a LGPD (Lei 13.709/2018).
          </Section>

          <Section title="10. Contato e foro" last>
            Dúvidas sobre estes Termos: {COMPANY.fullContact}. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.
          </Section>
        </AppCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
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
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  return (
    <View style={[styles.section, !last && styles.sectionBorder]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: uiTokens.spacing.sm,
      marginBottom: uiTokens.spacing.xs,
    },
    lastUpdate: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textMuted,
      marginBottom: uiTokens.spacing.lg,
    },
    pageTitle: {
      flex: 1,
      fontSize: 18,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.text,
    },
    card: {
      padding: uiTokens.spacing.lg,
    },
    bottomSpacer: {
      height: uiTokens.sectionGap * 2,
    },
  });
}

function makeSectionStyles(colors: DesignColors) {
  return StyleSheet.create({
    section: {
      paddingBottom: uiTokens.spacing.lg,
      marginBottom: uiTokens.spacing.lg,
    },
    sectionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.text,
      marginBottom: uiTokens.spacing.sm,
    },
    paragraph: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });
}
