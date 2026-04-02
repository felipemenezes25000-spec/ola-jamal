/**
 * Política de Cookies — RenoveJá+
 * O site de verificação (frontend-web) é minimalista e atualmente não utiliza cookies.
 * Esta página antecipa requisitos de compliance (LGPD, ANPD) caso analytics ou outras funcionalidades sejam adicionadas.
 */
export default function Cookies() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Política de Cookies</h1>
        <p style={styles.lastUpdate}>Última atualização: abril de 2026</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. O que são cookies</h2>
          <p style={styles.p}>
            Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site. Eles permitem que o site reconheça seu dispositivo e armazene informações sobre suas preferências.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Uso atual</h2>
          <p style={styles.p}>
            O site de verificação de receitas (renovejasaude.com.br/verify) atualmente <strong>não utiliza cookies</strong>. A página serve exclusivamente para validar receitas por código e disponibilizar a 2ª via quando aplicável.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. Caso passemos a utilizar cookies</h2>
          <p style={styles.p}>
            Se no futuro implementarmos cookies (por exemplo, para analytics ou funcionalidades adicionais), esta política será atualizada. Os cookies serão utilizados de forma transparente, com base legal adequada (consentimento quando exigido pela LGPD) e com a possibilidade de gerenciamento pelas configurações do navegador.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. Contato</h2>
          <p style={styles.p}>
            Dúvidas sobre cookies ou proteção de dados:{' '}
            <a href="mailto:privacidade@renovejasaude.com.br" style={styles.link}>privacidade@renovejasaude.com.br</a>
            {' '}· WhatsApp (11) 98631-8000 · www.renovejasaude.com.br
          </p>
        </section>

        <p style={styles.footer}>
          <a href="/" style={styles.link}>Voltar</a>
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
