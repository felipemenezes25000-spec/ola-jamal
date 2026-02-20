/**
 * Verify prescription via Supabase Edge Function.
 * Uses anon key only; Edge Function uses service_role internally.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export interface VerifyPayload {
  id: string;
  code: string;
  v?: string;
}

export interface VerifySuccessMeta {
  issuedAt?: string;
  issuedDate?: string;
  patientInitials?: string;
  crmMasked?: string;
  /** Campos legados (respostas alternativas) */
  emitida?: string;
  paciente?: string;
  crm?: string;
}

export interface VerifySuccess {
  status: 'valid';
  downloadUrl?: string;
  meta: VerifySuccessMeta;
}

export interface VerifyError {
  status: 'invalid' | 'error';
  error?: string;
}

export type VerifyResponse = VerifySuccess | VerifyError;

export async function verifyReceita(payload: VerifyPayload): Promise<VerifyResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Variáveis de ambiente ausentes: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY.');
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/verify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      id: payload.id.trim(),
      code: payload.code.trim(),
      ...(payload.v ? { v: payload.v.trim() } : {}),
    }),
  });

  const data = (await res.json()) as VerifyResponse;

  if (!res.ok) {
    return {
      status: 'error',
      error: (data as VerifyError).error ?? `HTTP ${res.status}`,
    };
  }

  return data;
}
