/**
 * Política de Privacidade (LGPD) — RenoveJá+
 * Página pública acessível em /privacidade.
 */
import { COMPANY } from '@/lib/company';

export default function PublicPrivacy() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Política de Privacidade</h1>
        <p style={styles.lastUpdate}>Última atualização: março de 2026</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. Controlador dos Dados</h2>
          <p style={styles.p}>
            <strong>{COMPANY.name}</strong>
            <br />
            CNPJ: {COMPANY.cnpj}
            <br />
            Endereço: {COMPANY.address}
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Encarregado de Dados (DPO)</h2>
          <p style={styles.p}>
            Nome: Departamento de Proteção de Dados
            <br />
            E-mail:{' '}
            <a href="mailto:privacidade@renovejasaude.com.br" style={styles.link}>
              privacidade@renovejasaude.com.br
            </a>
            <br />
            Telefone: {COMPANY.phone}
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. Dados que coletamos</h2>
          <p style={styles.p}>
            <strong>Dados de identificação:</strong> nome completo, CPF, data de nascimento, telefone e e-mail.
          </p>
          <p style={{ ...styles.p, marginTop: 8 }}>
            <strong>Dados de saúde:</strong> sintomas relatados, diagnósticos, prescrições médicas e transcrições de
            teleconsulta.
          </p>
          <p style={{ ...styles.p, marginTop: 8 }}>
            <strong>Dados de navegação:</strong> endereço IP, user-agent do navegador e timestamps de acesso.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. Finalidade e base legal</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Prestação de serviço de saúde</strong> — tutela da saúde do titular (Art. 7º, VIII e Art. 11, II,
              "f" da LGPD).
            </li>
            <li style={styles.li}>
              <strong>Cumprimento de obrigação legal e regulatória</strong> — normas do CFM e ANVISA.
            </li>
            <li style={styles.li}>
              <strong>Consentimento explícito para uso de IA</strong> — análise assistida por inteligência artificial
              (Art. 11, I da LGPD).
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>5. Compartilhamento de dados</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Médicos credenciados:</strong> para a prestação do serviço de teleconsulta.
            </li>
            <li style={styles.li}>
              <strong>OpenAI:</strong> análise por inteligência artificial, sem retenção de dados de saúde pelo
              provedor.
            </li>
            <li style={styles.li}>
              <strong>Daily.co / Deepgram:</strong> infraestrutura de videochamada e transcrição de teleconsulta.
            </li>
            <li style={styles.li}>
              <strong>AWS (Amazon Web Services):</strong> infraestrutura de hospedagem e armazenamento, com dados na
              região sa-east-1 (São Paulo).
            </li>
            <li style={styles.li}>
              <strong>Mercado Pago:</strong> processamento de pagamentos.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>6. Retenção de dados</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Prontuário médico:</strong> 20 anos, conforme CFM Resolução 1.821/2007.
            </li>
            <li style={styles.li}>
              <strong>Logs de auditoria:</strong> 5 anos.
            </li>
            <li style={styles.li}>
              <strong>Dados de conta:</strong> período ativo + 5 anos após inativação.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>7. Direitos do titular (LGPD Art. 18)</h2>
          <p style={styles.p}>Você pode exercer, a qualquer momento, os seguintes direitos:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>Confirmação da existência de tratamento e acesso aos dados;</li>
            <li style={styles.li}>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li style={styles.li}>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li style={styles.li}>Portabilidade dos dados a outro fornecedor;</li>
            <li style={styles.li}>Eliminação dos dados tratados com consentimento;</li>
            <li style={styles.li}>Informação sobre entidades com as quais seus dados foram compartilhados;</li>
            <li style={styles.li}>Revogação do consentimento.</li>
          </ul>
          <p style={{ ...styles.p, marginTop: 8 }}>
            Para exercer seus direitos, entre em contato com o DPO pelo e-mail{' '}
            <a href="mailto:privacidade@renovejasaude.com.br" style={styles.link}>
              privacidade@renovejasaude.com.br
            </a>
            .
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>8. Segurança</h2>
          <p style={styles.p}>
            Adotamos medidas técnicas e organizacionais para proteger seus dados pessoais, incluindo:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Comunicação criptografada via HTTPS com TLS 1.3;</li>
            <li style={styles.li}>Criptografia de dados em repouso com AES-256;</li>
            <li style={styles.li}>Assinatura digital de documentos com certificado ICP-Brasil;</li>
            <li style={styles.li}>Web Application Firewall (WAF) para proteção contra ataques;</li>
            <li style={styles.li}>Trilha de auditoria (audit trail) para rastreabilidade de acessos e ações.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>9. Contato do DPO</h2>
          <p style={styles.p}>
            Departamento de Proteção de Dados
            <br />
            E-mail:{' '}
            <a href="mailto:privacidade@renovejasaude.com.br" style={styles.link}>
              privacidade@renovejasaude.com.br
            </a>
            <br />
            Telefone: {COMPANY.phone}
            <br />
            WhatsApp:{' '}
            <a href={COMPANY.whatsapp} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {COMPANY.phone}
            </a>
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>10. Atualização da política</h2>
          <p style={styles.p}>
            Esta política pode ser atualizada periodicamente. A versão mais recente estará sempre disponível nesta
            página. Última atualização: março de 2026.
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
