import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { verifyReceita, type VerifySuccess } from '../api/verify';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const GUARDRAIL_ALERT =
  'Importante: Decisão e responsabilidade é do profissional. Conteúdo exibido para verificação.';

function mapErrorToMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_code': return 'Código inválido.';
    case 'invalid_code_format': return 'Código deve ter exatamente 6 dígitos.';
    case 'invalid_token': return 'Token inválido ou expirado.';
    case 'revoked': return 'Receita revogada.';
    case 'expired': return 'Receita expirada.';
    case 'not_found': return 'Receita não encontrada.';
    case 'invalid_id': return 'ID inválido na URL.';
    default: return code ? String(code) : 'Falha ao verificar. Tente novamente.';
  }
}

async function verifyOrThrow(id: string, code: string, v?: string): Promise<VerifySuccess> {
  const res = await verifyReceita({ id, code, v });
  if (res.status === 'error') {
    throw new Error(mapErrorToMessage(res.error));
  }
  if (res.status !== 'valid') {
    const err = 'error' in res ? res.error : undefined;
    throw new Error(mapErrorToMessage(err));
  }
  return res;
}

export default function Verify() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const v = searchParams.get('v') ?? undefined;

  const [code, setCode] = useState('');
  const [state, setState] = useState<VerifyState>('idle');
  const [result, setResult] = useState<VerifySuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || code.length !== 6) return;
      setState('loading');
      setErrorMessage('');
      setResult(null);
      setDownloadUrl(null);
      try {
        const api = await verifyOrThrow(id.trim(), code.trim(), v || undefined);

        const meta = api?.meta ?? {};
        const issuedAt = meta.issuedAt ?? meta.emitida ?? new Date().toISOString();
        const patientInitials = meta.patientInitials ?? meta.paciente ?? '—';
        const crmMasked = meta.crmMasked ?? meta.crm ?? 'CRM/UF • ****';

        setResult({
          status: 'valid',
          meta: {
            issuedAt,
            issuedDate: api?.meta?.issuedDate ?? (issuedAt ? new Date(issuedAt).toLocaleDateString('pt-BR') : undefined),
            patientInitials,
            crmMasked,
          },
          downloadUrl: api?.downloadUrl,
        });
        setDownloadUrl(api?.downloadUrl ?? null);
        setState('success');
      } catch (err) {
        const isNetworkError =
          err instanceof TypeError &&
          (err.message === 'Failed to fetch' || err.message.includes('fetch'));
        const msg = isNetworkError
          ? 'Não foi possível conectar ao servidor. Verifique sua internet e se a URL do Supabase está correta.'
          : err instanceof Error
            ? err.message
            : 'Erro de conexão.';
        setErrorMessage(msg);
        setState('error');
      }
    },
    [id, code, v]
  );

  if (!id) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Verificar receita</h1>
          <p style={styles.error}>ID inválido na URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Verificação de Receita</h1>
        <p style={styles.subtitle}>
          Use o código presente na receita para validar e obter a 2ª via (quando disponível).
        </p>

        {state === 'idle' && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label htmlFor="verify-code" style={styles.label}>Código de verificação</label>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={styles.input}
              aria-label="Código de 6 dígitos"
            />
            <button type="submit" disabled={code.length !== 6} style={styles.button}>
              Validar
            </button>
          </form>
        )}

        {state === 'loading' && (
          <p style={styles.loading}>Verificando…</p>
        )}

        {state === 'success' && result && (
          <div style={styles.success}>
            <p style={styles.validBadge}>✓ Receita válida</p>
            {result.meta.issuedDate && (
              <p><strong>Emitida em</strong> {result.meta.issuedDate}</p>
            )}
            {result.meta.patientInitials && (
              <p><strong>Paciente</strong> {result.meta.patientInitials}</p>
            )}
            {result.meta.crmMasked && (
              <p><strong>Profissional</strong> {result.meta.crmMasked}</p>
            )}
            {downloadUrl ? (
              <button
                type="button"
                onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                style={styles.downloadButton}
              >
                Baixar PDF (2ª via)
              </button>
            ) : (
              <span title="Em breve" style={styles.downloadButtonWrap}>
                <button type="button" disabled style={styles.downloadButton}>
                  Baixar PDF (2ª via)
                </button>
              </span>
            )}
          </div>
        )}

        {state === 'error' && (
          <div style={styles.errorBox}>
            <p style={styles.error}>{errorMessage}</p>
            <button
              type="button"
              onClick={() => { setState('idle'); setCode(''); setErrorMessage(''); }}
              style={styles.buttonSecondary}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div style={styles.guardrail} role="alert">
          {GUARDRAIL_ALERT}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    padding: 32,
  },
  title: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 8,
    marginLeft: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 24,
    marginLeft: 0,
    color: '#666',
    fontSize: 14,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    padding: 14,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    border: '1px solid #ccc',
    borderRadius: 8,
  },
  button: {
    padding: 14,
    fontSize: 16,
    fontWeight: 600,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: 10,
    fontSize: 14,
    background: '#f1f5f9',
    color: '#1e293b',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 8,
  },
  loading: {
    color: '#64748b',
    margin: 0,
  },
  success: {
    marginBottom: 24,
  },
  validBadge: {
    color: '#16a34a',
    fontWeight: 600,
    marginBottom: 16,
  },
  downloadButton: {
    display: 'inline-block',
    marginTop: 16,
    padding: '12px 24px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  downloadButtonWrap: {
    display: 'block',
    marginTop: 16,
  },
  errorBox: {
    marginBottom: 24,
  },
  error: {
    color: '#dc2626',
    margin: 0,
  },
  guardrail: {
    marginTop: 24,
    padding: 12,
    background: '#fef3c7',
    borderRadius: 8,
    fontSize: 12,
    color: '#92400e',
  },
};
