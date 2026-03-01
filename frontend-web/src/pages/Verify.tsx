import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { verifyReceita, type VerifySuccess } from '../api/verify';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const GUARDRAIL_ALERT =
  'Importante: Decisão e responsabilidade é do profissional. Conteúdo exibido para verificação.';

/** Formata ISO string da API para exibição em pt-BR (apenas dados retornados pela API). */
function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Verify() {
  const { id } = useParams<{ id: string }>();

  const [code, setCode] = useState('');
  const [state, setState] = useState<VerifyState>('idle');
  const [result, setResult] = useState<VerifySuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || code.length !== 6) return;
      setState('loading');
      setErrorMessage('');
      setResult(null);
      const res = await verifyReceita({ id: id.trim(), code: code.trim() });

      if (res.status === 'error') {
        setErrorMessage(res.message);
        setState('error');
        return;
      }
      if (res.status === 'invalid') {
        setErrorMessage(res.message);
        setState('error');
        return;
      }
      setResult(res.data);
      setState('success');
    },
    [id, code]
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
            <div style={styles.metaGrid}>
              {result.issuedAt && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Emitida em</span>
                  <span style={styles.metaValue}>{formatIsoDate(result.issuedAt)}</span>
                </div>
              )}
              {result.signedAt != null && result.signedAt !== '' && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Assinada em</span>
                  <span style={styles.metaValue}>{formatIsoDateTime(result.signedAt)}</span>
                </div>
              )}
              {result.patientName != null && result.patientName !== '' && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Paciente</span>
                  <span style={styles.metaValue}>{result.patientName}</span>
                </div>
              )}
              {(result.doctorName != null && result.doctorName !== '') && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Médico</span>
                  <span style={styles.metaValue}>{result.doctorName}</span>
                </div>
              )}
              {result.doctorCrm != null && result.doctorCrm !== '' && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>CRM</span>
                  <span style={styles.metaValue}>{result.doctorCrm}</span>
                </div>
              )}
            </div>
            <p style={styles.successNote}>Verificação concluída com sucesso.</p>
            <button
              type="button"
              onClick={() => {
                if (result.downloadUrl) {
                  window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
                } else {
                  alert('Download não disponível. O PDF pode ainda estar sendo processado.');
                }
              }}
              style={{
                ...styles.downloadButton,
                opacity: result.downloadUrl ? 1 : 0.5,
                cursor: result.downloadUrl ? 'pointer' : 'not-allowed',
              }}
            >
              Baixar PDF (2ª via)
            </button>
            <button
              type="button"
              onClick={() => { setState('idle'); setCode(''); setResult(null); }}
              style={styles.buttonSecondary}
            >
              Verificar outro código
            </button>
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
  metaGrid: {
    marginBottom: 16,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  metaValue: {
    fontWeight: 600,
    color: '#1e293b',
    fontSize: 14,
  },
  successNote: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 16,
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
