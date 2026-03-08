/**
 * API de autenticação — forgot-password, reset-password.
 * Usa VITE_API_URL (mesma base do verify e admin).
 */

function getApiBaseUrl(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    throw new Error('URL da API não configurada. Defina VITE_API_URL.');
  }

  const res = await fetch(`${apiBase}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = (json as { error?: string; message?: string })?.error
      ?? (json as { error?: string; message?: string })?.message
      ?? `Erro ao redefinir senha (${res.status}).`;
    throw new Error(msg);
  }
}
