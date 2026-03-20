import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { verifyReceita, verifyDocument, dispenseDocument, dispensePrescription, type VerifySuccess, type DocumentVerifyResult } from '@/api/verify';
import '@/styles/recuperar-verify.css';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const GUARDRAIL_ALERT =
  'Importante: Decisão e responsabilidade é do profissional. Conteúdo exibido para verificação.';

// FIX #10: Domínios permitidos para download de PDF (incl. 127.0.0.1 para dev local)
const ALLOWED_DOWNLOAD_DOMAINS = [
  'renovejasaude.com.br',
  'localhost',
  '127.0.0.1',
];

function isAllowedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOWNLOAD_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Formata ISO string da API para exibição em pt-BR (apenas dados retornados pela API). */
const TZ_BR = 'America/Sao_Paulo';

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TZ_BR,
    });
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
      timeZone: TZ_BR,
    });
  } catch {
    return iso;
  }
}

export default function Verify() {
  const { id } = useParams<{ id: string }>();

  const isValidId = id && UUID_REGEX.test(id.trim());

  const [code, setCode] = useState('');
  const [state, setState] = useState<VerifyState>('idle');
  const [result, setResult] = useState<VerifySuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  // FIX #25: Guard contra double-click / submissão duplicada
  const submittingRef = useRef(false);
  const [docResult, setDocResult] = useState<DocumentVerifyResult | null>(null);
  const [dispensing, setDispensing] = useState(false);

  // FIX #15: isValidId agora é calculado fora do callback e incluído no deps
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValidId || code.length !== 6 || submittingRef.current) return;
      submittingRef.current = true;
      setState('loading');
      setErrorMessage('');
      setResult(null);
      try {
        // Tentar endpoint universal primeiro (medical_documents — cobre todos os tipos)
        const docRes = await verifyDocument(id!.trim(), code.trim());
        if (docRes.status === 'valid') {
          setDocResult(docRes);
          setState('success');
          return;
        }

        // Fallback: tentar endpoint legado (prescriptions — receitas pré-consulta)
        const res = await verifyReceita({ id: id!.trim(), code: code.trim() });
        if (res.status !== 'error' && res.status !== 'invalid') {
          setResult(res.data);
          setState('success');
          return;
        }

        // Ambos falharam — mostrar erro mais relevante
        setErrorMessage(docRes.message || res.message || 'Código inválido ou documento não encontrado.');
        setState('error');
      } finally {
        submittingRef.current = false;
      }
    },
    [id, code, isValidId]
  );

  if (!isValidId) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Verificar receita</h1>
          <p style={styles.error}>ID inválido na URL. O formato esperado é um UUID (ex: 550e8400-e29b-41d4-a716-446655440000).</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card} className="verify-card">
        <h1 style={styles.title}>Verificação de Documento Médico</h1>
        <p style={styles.subtitle}>
          Use o código presente no documento (receita, atestado ou exame) para validar sua autenticidade.
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
            {result.wasDispensed && (
              <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', borderRadius: 12, marginBottom: 12, border: '1px solid #FDE68A' }}>
                <p style={{ margin: 0, fontSize: 14, color: '#92400E', fontWeight: 600 }}>
                  ⚠️ Esta receita já foi dispensada na farmácia. Não pode ser utilizada novamente.
                </p>
              </div>
            )}
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
              onClick={async () => {
                // FIX #10: Valida domínio do downloadUrl antes de abrir
                if (!result.downloadUrl) {
                  alert('Download não disponível. O PDF pode ainda estar sendo processado.');
                  return;
                }
                if (!isAllowedDownloadUrl(result.downloadUrl)) {
                  alert('URL de download inválida. Contate o suporte.');
                  return;
                }
                try {
                  const res = await fetch(result.downloadUrl);
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({})) as { error?: string };
                    alert(err?.error ?? 'Não foi possível baixar o PDF. Tente novamente.');
                    return;
                  }
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                } catch {
                  alert('Erro ao baixar o PDF. Verifique sua conexão e tente novamente.');
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
            {/* Botão dispensar (para farmacêuticos) — receitas via prescriptions */}
            {!result.wasDispensed && (
              <button
                type="button"
                disabled={dispensing}
                onClick={async () => {
                  const pharmacy = prompt('Nome da farmácia:');
                  if (!pharmacy?.trim()) return;
                  const pharmacist = prompt('Nome do(a) farmacêutico(a):');
                  if (!pharmacist?.trim()) return;
                  setDispensing(true);
                  try {
                    const res = await dispensePrescription(id!.trim(), code.trim(), pharmacy, pharmacist);
                    if (res.success) {
                      alert('Receita marcada como dispensada.');
                      setResult({ ...result, wasDispensed: true });
                    } else {
                      alert(res.error ?? 'Erro ao dispensar. Tente novamente.');
                    }
                  } catch {
                    alert('Erro ao dispensar receita. Tente novamente.');
                  } finally {
                    setDispensing(false);
                  }
                }}
                style={{ ...styles.button, marginTop: 12, backgroundColor: '#059669' }}
              >
                {dispensing ? 'Marcando...' : '✓ Marcar como dispensado'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setState('idle'); setCode(''); setResult(null); setDocResult(null); }}
              style={styles.buttonSecondary}
            >
              Verificar outro código
            </button>
          </div>
        )}

        {/* Resultado de documento universal (atestado, exame, receita via medical_documents) */}
        {state === 'success' && docResult && !result && (
          <div style={styles.success}>
            <p style={styles.validBadge}>✓ {docResult.documentType ?? 'Documento'} válido</p>
            {docResult.wasDispensed && (
              <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', borderRadius: 12, marginBottom: 12, border: '1px solid #FDE68A' }}>
                <p style={{ margin: 0, fontSize: 14, color: '#92400E', fontWeight: 600 }}>
                  ⚠️ {docResult.dispensedWarning}
                </p>
              </div>
            )}
            <div style={styles.metaGrid}>
              {docResult.issuedAt && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Emitido em</span>
                  <span style={styles.metaValue}>{formatIsoDate(docResult.issuedAt)}</span>
                </div>
              )}
              {docResult.signedAt && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Assinado em</span>
                  <span style={styles.metaValue}>{formatIsoDateTime(docResult.signedAt)}</span>
                </div>
              )}
              {docResult.documentType && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Tipo</span>
                  <span style={styles.metaValue}>{docResult.documentType}</span>
                </div>
              )}
            </div>
            <p style={styles.successNote}>{docResult.message}</p>
            {docResult.downloadUrl && (
              <button
                type="button"
                onClick={async () => {
                  if (!docResult.downloadUrl) return;
                  if (!isAllowedDownloadUrl(docResult.downloadUrl)) {
                    alert('URL de download inválida. Contate o suporte.');
                    return;
                  }
                  try {
                    const res = await fetch(docResult.downloadUrl);
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({})) as { error?: string };
                      alert(err?.error ?? 'Não foi possível baixar o PDF. Tente novamente.');
                      return;
                    }
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                  } catch {
                    alert('Erro ao baixar o PDF. Verifique sua conexão e tente novamente.');
                  }
                }}
                style={{
                  ...styles.downloadButton,
                  opacity: 1,
                  cursor: 'pointer',
                }}
              >
                Baixar PDF (2ª via)
              </button>
            )}
            {docResult.verificationUrl && (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8, textAlign: 'center' as const }}>
                Validar assinatura ICP-Brasil em: <a href={docResult.verificationUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#2563EB' }}>{docResult.verificationUrl}</a>
              </p>
            )}
            {/* Botão dispensar/utilizado (receitas, exames, atestados — todos ICP-Brasil) */}
            {!docResult.wasDispensed && (
              <button
                type="button"
                disabled={dispensing}
                onClick={async () => {
                  const pharmacy = prompt('Nome da farmácia/clínica/laboratório:');
                  if (!pharmacy?.trim()) return;
                  const pharmacist = prompt('Nome do(a) farmacêutico(a) ou responsável:');
                  if (!pharmacist?.trim()) return;
                  setDispensing(true);
                  try {
                    const res = await dispenseDocument(id!.trim(), code.trim(), pharmacy, pharmacist);
                    if (res.success) {
                      alert('Documento marcado como dispensado/utilizado.');
                      setDocResult({ ...docResult, wasDispensed: true, dispensedWarning: 'Dispensado/utilizado agora.' });
                    } else {
                      alert(res.message);
                    }
                  } catch {
                    alert('Erro ao dispensar documento. Tente novamente.');
                  } finally {
                    setDispensing(false);
                  }
                }}
                style={{ ...styles.button, marginTop: 12, backgroundColor: '#059669' }}
              >
                {dispensing ? 'Marcando...' : '✓ Marcar como dispensado/utilizado'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setState('idle'); setCode(''); setDocResult(null); }}
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

        <footer style={styles.footer}>
          <a href="/cookies" style={styles.footerLink}>Política de Cookies</a>
        </footer>
      </div>
    </div>
  );
}

// FIX #29: Removido 'downloadButtonWrap' não utilizado
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: 'var(--card-bg)',
    borderRadius: 12,
    boxShadow: 'var(--shadow)',
    padding: 32,
  },
  title: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 8,
    marginLeft: 0,
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
  },
  subtitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 24,
    marginLeft: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
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
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--card-bg)',
    color: 'var(--text)',
  },
  button: {
    padding: 14,
    fontSize: 16,
    fontWeight: 600,
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: 10,
    fontSize: 14,
    background: 'var(--border)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 8,
  },
  loading: {
    color: 'var(--text-secondary)',
    margin: 0,
  },
  success: {
    marginBottom: 24,
  },
  validBadge: {
    color: 'var(--success)',
    fontWeight: 600,
    marginBottom: 16,
  },
  downloadButton: {
    display: 'inline-block',
    marginTop: 16,
    padding: '12px 24px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  errorBox: {
    marginBottom: 24,
  },
  error: {
    color: 'var(--error)',
    margin: 0,
  },
  metaGrid: {
    marginBottom: 16,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  metaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  metaValue: {
    fontWeight: 600,
    color: 'var(--text)',
    fontSize: 14,
  },
  successNote: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    marginBottom: 16,
  },
  guardrail: {
    marginTop: 24,
    padding: 12,
    background: 'var(--warning-bg)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--warning-text)',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  footerLink: {
    color: 'var(--primary)',
    textDecoration: 'none',
  },
};
