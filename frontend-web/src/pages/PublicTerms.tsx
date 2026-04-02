/**
 * Termos de Uso — RenoveJá+
 * Página pública acessível em /termos.
 */
import { COMPANY } from '@/lib/company';

export default function PublicTerms() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Termos de Uso</h1>
        <p style={styles.lastUpdate}>Última atualização: abril de 2026</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. Identificação do prestador</h2>
          <p style={styles.p}>
            <strong>{COMPANY.name}</strong>
            <br />
            CNPJ: {COMPANY.cnpj}
            <br />
            Endereço: {COMPANY.address}
            <br />
            Telefone: {COMPANY.phone}
            <br />
            Site:{' '}
            <a href={`https://${COMPANY.website}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {COMPANY.website}
            </a>
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Aceitação dos termos</h2>
          <p style={styles.p}>
            O uso da plataforma RenoveJá+ implica na aceitação integral destes Termos de Uso. A plataforma é destinada
            a maiores de 18 anos. Caso não concorde com qualquer disposição, interrompa o uso imediatamente.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. Natureza do serviço</h2>
          <p style={styles.p}>
            O RenoveJá+ é uma plataforma de telemedicina que conecta pacientes a médicos credenciados para teleconsultas
            e renovação de receitas (simples e controladas), em conformidade com a Resolução CFM 2.314/2022 e demais normas aplicáveis.
            Em breve: renovação de receitas azuis (notificação B) e amarelas (notificação A) com fluxo específico de segurança.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. A consulta presencial é a referência</h2>
          <p style={styles.p}>
            A telemedicina é uma modalidade complementar. A consulta presencial permanece como referência em atendimento
            médico. O médico pode, a seu critério clínico, recusar o atendimento por telemedicina e orientar a busca por
            atendimento presencial quando julgar necessário.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>5. Limitações</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>
              O RenoveJá+ <strong>não substitui atendimento de urgência ou emergência</strong>. Em situações graves,
              procure assistência presencial ou ligue para o <strong>SAMU 192</strong>.
            </li>
            <li style={styles.li}>
              A plataforma não é um dispositivo médico e não realiza diagnósticos automatizados.
            </li>
            <li style={styles.li}>
              Os resultados gerados por inteligência artificial são de caráter auxiliar e não substituem a avaliação
              clínica do profissional de saúde.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>6. Responsabilidades</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Plataforma (RenoveJá+):</strong> responsável pela infraestrutura tecnológica, segurança dos
              dados, disponibilidade do sistema e conformidade regulatória da plataforma.
            </li>
            <li style={styles.li}>
              <strong>Médico:</strong> responsável pela conduta clínica, prescrição, diagnóstico e decisões médicas. O
              médico exerce autonomia profissional plena.
            </li>
            <li style={styles.li}>
              <strong>Inteligência Artificial:</strong> ferramenta de apoio à decisão clínica. Não substitui o juízo
              clínico do médico e não gera responsabilidade autônoma.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>7. Propriedade intelectual</h2>
          <p style={styles.p}>
            Todo o conteúdo da plataforma — incluindo textos, marcas, logotipos, interfaces, código-fonte e
            funcionalidades — é de propriedade exclusiva da {COMPANY.name} ou de seus licenciadores, protegido pela
            legislação brasileira de propriedade intelectual. É vedada a reprodução, distribuição ou uso não autorizado.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>8. Modificações dos termos</h2>
          <p style={styles.p}>
            Estes Termos de Uso podem ser atualizados a qualquer momento. As alterações entram em vigor na data de
            publicação nesta página. O uso continuado da plataforma após a publicação constitui aceitação dos novos
            termos.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>9. Foro</h2>
          <p style={styles.p}>
            Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer controvérsias
            decorrentes destes Termos de Uso, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>10. Contato</h2>
          <p style={styles.p}>
            Dúvidas sobre estes Termos de Uso:{' '}
            <a href="mailto:contato@renovejasaude.com.br" style={styles.link}>
              contato@renovejasaude.com.br
            </a>
            <br />
            WhatsApp:{' '}
            <a href={COMPANY.whatsapp} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {COMPANY.phone}
            </a>
            <br />
            Site:{' '}
            <a href={`https://${COMPANY.website}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {COMPANY.website}
            </a>
          </p>
        </section>

        <p style={styles.footer}>
          <a href="/" style={styles.link}>
            Voltar
          </a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    background: '#f8fafc',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    maxWidth: 600,
    margin: '0 auto',
    background: '#fff',
    padding: 32,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  h2: {
    fontSize: 16,
    fontWeight: 600,
    color: '#334155',
    margin: '0 0 8px 0',
  },
  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#475569',
    margin: 0,
  },
  ul: {
    margin: '8px 0 0 0',
    paddingLeft: 20,
  },
  li: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#475569',
    marginBottom: 4,
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: '1px solid #e2e8f0',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: 14,
  },
};
