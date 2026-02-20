import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppHeader, AppCard } from '../components/ui';
import { theme } from '../lib/theme';
import { COMPANY } from '../lib/company';

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
          <Text style={styles.pageTitle}>TERMOS DE USO – {COMPANY.name}</Text>
        </View>

        <AppCard style={styles.card}>
          <Section title="1. Identificação do prestador">
            {COMPANY.name}, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address}. Contato: {COMPANY.fullContact}. Estes Termos regem o uso do aplicativo e dos serviços de telemedicina oferecidos pela plataforma.
          </Section>

          <Section title="2. Aceitação dos Termos">
            Ao utilizar o aplicativo {COMPANY.name}, você declara ter lido, compreendido e aceitado os presentes Termos de Uso. O cadastro e o uso dos serviços constituem aceitação eletrônica. Os serviços são oferecidos a maiores de 18 anos ou com representação legal. O aplicativo oferece serviços de telemedicina em conformidade com a legislação brasileira, incluindo renovação de receitas, solicitação de exames e consultas online.
          </Section>

          <Section title="3. Definições">
            Plataforma: ambiente digital {COMPANY.name}. Usuários: pacientes e médicos cadastrados. Serviços: telemedicina (consultas, receitas, exames) realizados por profissionais com registro ativo no Conselho Federal de Medicina (CFM) ou conselho de classe competente. A plataforma atua como intermediária entre usuários e profissionais de saúde.
          </Section>

          <Section title="4. Telemedicina e normativas">
            Os atendimentos realizados na plataforma observam a Resolução CFM nº 2.314/2022 (telemedicina) e normas do CFM aplicáveis. As consultas são registradas em prontuário eletrônico, com identificação do profissional e do paciente. O médico mantém autonomia para indicar atendimento presencial quando necessário.
          </Section>

          <Section title="5. Limitação de responsabilidade">
            A {COMPANY.name} é responsável pelo meio tecnológico e pelo funcionamento da plataforma. O conteúdo clínico e as condutas médicas são de responsabilidade exclusiva do profissional que realiza o atendimento. O teleatendimento não substitui o exame físico quando este for indispensável; caberá ao médico a decisão de encaminhar o paciente ao presencial. O usuário (paciente) é responsável pela veracidade das informações fornecidas e pelo sigilo de sua senha.
          </Section>

          <Section title="5. Uso de inteligência artificial">
            A plataforma utiliza recursos de inteligência artificial para triagem e para auxílio na leitura de receitas e exames, com o objetivo de agilizar o fluxo de atendimento. As decisões clínicas finais permanecem sob responsabilidade do médico. O usuário está ciente e concorda com o uso dessas ferramentas nos termos da Política de Privacidade.
          </Section>

          <Section title="6.1. Consultas por vídeo – informação ao paciente">
            Nas consultas por vídeo, a conversa pode ser transcrita em tempo quase real (apenas em texto) e o texto pode ser processado por ferramentas de inteligência artificial para auxiliar o médico (estruturação de anamnese e sugestões de apoio). Não há gravação de áudio nem de vídeo; apenas o texto da transcrição e os dados estruturados (anamnese) são armazenados e integram o prontuário eletrônico do paciente, nos termos da Resolução CFM nº 2.314/2022 e das normas do CFM aplicáveis. O uso está em conformidade com a LGPD (finalidade legítima, apoio à prestação do serviço de saúde e ao prontuário) e com a Política de Privacidade da plataforma. Ao agendar ou iniciar uma consulta por vídeo, o paciente declara estar ciente dessas condições.
          </Section>

          <Section title="6.2. Uso profissional – médicos">
            A plataforma pode utilizar transcrição em tempo quase real e inteligência artificial (estruturação de anamnese e sugestões) como apoio durante a consulta por vídeo. A decisão clínica e a responsabilidade são exclusivamente do médico; a IA atua como ferramenta de apoio (copiloto) e não substitui o julgamento profissional, em conformidade com o Código de Ética Médica e com as resoluções do CFM. O transcript e a anamnese gerados são incorporados ao prontuário eletrônico do paciente e ficam acessíveis a outros médicos que atendam o paciente, nos termos da legislação e das boas práticas de prontuário.
          </Section>

          <Section title="7. Uso adequado">
            O usuário compromete-se a fornecer informações verdadeiras e a utilizar o serviço apenas para fins legítimos de saúde. É vedado o uso fraudulento, a violação de legislação vigente ou de normas dos conselhos de classe. O descumprimento pode resultar em cancelamento da conta e medidas legais cabíveis.
          </Section>

          <Section title="8. Pagamentos">
            Os valores dos serviços estão disponíveis no aplicativo. O pagamento é processado de forma segura. Políticas de reembolso e cancelamento estão disponíveis na seção de Ajuda. Em caso de dúvidas, o consumidor pode acionar os canais de atendimento e, se necessário, os órgãos de defesa do consumidor.
          </Section>

          <Section title="9. Alterações e lei aplicável">
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações significativas serão comunicadas por meio do aplicativo ou e-mail. O uso continuado após as alterações constitui aceitação dos novos termos. Estes Termos são regidos pelas leis da República Federativa do Brasil. Para questões relativas a dados pessoais, aplica-se a LGPD (Lei 13.709/2018).
          </Section>

          <Section title="10. Contato e foro" last>
            Dúvidas sobre estes Termos: {COMPANY.fullContact}. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.
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
