/**
 * Verificação de receita via API backend (POST /api/prescriptions/verify).
 * Validação server-side; sem mock ou fallback — a UI exibe apenas os campos retornados.
 * Se VITE_API_URL não estiver definida, usa a mesma origem (window.location.origin) para front e API no mesmo domínio.
 */

function getApiBaseUrl(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export interface VerifyPayload {
  id: string;
  code: string;
  v?: string;
}

/** Resposta da API: válida quando is_valid === true; caso contrário reason indica o motivo. */
export interface PrescriptionVerifyResponse {
  isValid: boolean;
  status: string;
  reason?: string | null;
  issuedAt?: string | null;
  signedAt?: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  downloadUrl?: string | null;
  wasDispensed?: boolean;
}

/** Dados exibidos na UI apenas quando a verificação é válida (sem fallbacks). */
export interface VerifySuccess {
  status: 'valid';
  issuedAt: string;
  signedAt: string | null;
  patientName: string | null;
  doctorName: string | null;
  doctorCrm: string | null;
  downloadUrl: string | null;
  wasDispensed?: boolean;
}

export type VerifyResponse =
  | { status: 'valid'; data: VerifySuccess }
  | { status: 'invalid'; reason: string; message: string }
  | { status: 'error'; message: string };

const REASON_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'Código inválido.',
  NOT_SIGNED: 'Receita ainda não assinada.',
  NOT_FOUND: 'Receita não encontrada.',
  EXPIRED: 'Receita expirada.',
  REVOKED: 'Receita revogada.',
};

function reasonToMessage(reason: string | undefined): string {
  if (!reason) return 'Falha ao verificar. Tente novamente.';
  return REASON_MESSAGES[reason] ?? reason;
}

export async function verifyReceita(payload: VerifyPayload): Promise<VerifyResponse> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return { status: 'error', message: 'URL da API não configurada. Defina VITE_API_URL ou use o mesmo domínio.' };
  }

  const id = payload.id.trim();
  const code = payload.code.trim();

  if (!id || !code) {
    return { status: 'error', message: 'ID e código são obrigatórios.' };
  }

  const url = `${apiBase}/api/prescriptions/verify`;
  let res: Response;
  let data: PrescriptionVerifyResponse;

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prescriptionId: id,
        verificationCode: code,
      }),
    });
    const json = await res.json().catch(() => ({}));
    data = json as PrescriptionVerifyResponse;
  } catch (err) {
    const isNetwork =
      err instanceof TypeError &&
      (err instanceof Error ? err.message : '').toLowerCase().includes('fetch');
    return {
      status: 'error',
      message: isNetwork
        ? 'Não foi possível conectar ao servidor. Verifique sua internet e a URL da API.'
        : (err instanceof Error ? err.message : 'Erro de conexão.'),
    };
  }

  if (!res.ok) {
    const errBody = data as unknown as { error?: string; message?: string; detail?: string };
    let msg = errBody?.error ?? errBody?.message ?? errBody?.detail ?? `Erro do servidor (${res.status}).`;
    if (res.status === 405) {
      msg =
        '405 Método não permitido. Verifique se VITE_API_URL aponta para a URL da API (AWS), e não para o domínio do site. Faça novo build e deploy após alterar.';
    }
    return { status: 'error', message: msg };
  }

  if (!data.isValid) {
    return {
      status: 'invalid',
      reason: data.reason ?? 'INVALID_CODE',
      message: reasonToMessage(data.reason ?? undefined),
    };
  }

  return {
    status: 'valid',
    data: {
      status: 'valid',
      issuedAt: data.issuedAt ?? '',
      signedAt: data.signedAt ?? null,
      patientName: data.patientName ?? null,
      doctorName: data.doctorName ?? null,
      doctorCrm: data.doctorCrm ?? null,
      downloadUrl: data.downloadUrl ?? null,
      wasDispensed: data.wasDispensed ?? false,
    },
  };
}

/** Marca receita como dispensada (farmácia). Endpoint público: POST /api/verify/{id}/dispense */
export async function dispensePrescription(
  prescriptionId: string,
  code: string,
  pharmacyName: string,
  pharmacistName: string
): Promise<{ success: boolean; error?: string }> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return { success: false, error: 'URL da API não configurada.' };

  try {
    const res = await fetch(`${apiBase}/api/verify/${prescriptionId}/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode: code.trim(),
        pharmacyName: pharmacyName.trim(),
        pharmacistName: pharmacistName.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok) return { success: false, error: data?.error ?? `Erro ${res.status}` };
    return { success: data?.success ?? false, error: data?.error };
  } catch {
    return { success: false, error: 'Erro de conexão.' };
  }
}


// ── Verificação universal (atestados, exames, receitas via medical_documents) ──

export interface DocumentVerifyResult {
  status: 'valid' | 'invalid' | 'error';
  documentType?: string;
  documentTypeCode?: string;
  signedAt?: string;
  issuedAt?: string;
  wasDispensed?: boolean;
  dispenseCount?: number;
  dispensedWarning?: string | null;
  verificationUrl?: string;
  /** URL para baixar o PDF após verificação (GET com código na query). */
  downloadUrl?: string | null;
  message: string;
  reason?: string;
}

export async function verifyDocument(documentId: string, code: string): Promise<DocumentVerifyResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return { status: 'error', message: 'URL da API não configurada.' };

  try {
    const res = await fetch(`${apiBase}/api/documents/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: documentId.trim(), code: code.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.status) {
      const errBody = data as { error?: string; message?: string };
      return { status: 'error', message: errBody?.error ?? errBody?.message ?? `Erro do servidor (${res.status}).` };
    }
    return data as DocumentVerifyResult;
  } catch {
    return { status: 'error', message: 'Erro de conexão.' };
  }
}

/** Dispense com código (público — receitas, exames, atestados). */
export async function dispenseDocument(
  documentId: string,
  code: string,
  pharmacyName: string,
  pharmacistName: string
): Promise<{ success: boolean; message: string }> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return { success: false, message: 'URL da API não configurada.' };

  try {
    const res = await fetch(`${apiBase}/api/documents/${documentId}/dispense-by-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim(),
        pharmacyName: pharmacyName.trim(),
        pharmacistName: pharmacistName.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
    if (!res.ok) return { success: false, message: data?.error ?? data?.message ?? 'Erro ao processar.' };
    return { success: data?.success ?? false, message: data?.message ?? data?.error ?? '' };
  } catch {
    return { success: false, message: 'Erro de conexão.' };
  }
}
