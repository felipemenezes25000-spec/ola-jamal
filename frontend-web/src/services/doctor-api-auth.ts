/**
 * doctor-api-auth.ts — Authentication, profile, and base HTTP client.
 *
 * Exports `authFetch` which is the shared HTTP client used by all other
 * doctor-api-* modules.
 */

import type { DoctorUser, DoctorProfile } from './doctorApi';

// ── API Base & Auth Helpers ──

export function getApiBase(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

const TOKEN_KEY = 'doctor_auth_token';
const USER_KEY = 'doctor_user';

/**
 * Returns the auth token if available.
 * With HttpOnly cookies the token is NOT accessible via JS — this only returns
 * a legacy localStorage token during migration. New logins no longer store tokens
 * in localStorage; the HttpOnly cookie is sent automatically by the browser.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Returns true if the user is likely authenticated (has cached user data).
 * Since HttpOnly cookies are not readable from JS, we use the presence of
 * cached user data as a proxy. The actual auth check happens server-side.
 */
export function hasAuthSession(): boolean {
  return !!localStorage.getItem(USER_KEY) || !!localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): DoctorUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(_token: string, user: DoctorUser) {
  // Token is now stored as an HttpOnly cookie (set by the server).
  // We only cache user data in localStorage for quick rehydration.
  // Legacy: keep token in localStorage during migration for fallback.
  localStorage.setItem(TOKEN_KEY, _token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Limpa token e usuário (usado em authFetch 401 e em SignalR 401). */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// FIX #19: Cooldown por timestamp para evitar race conditions com múltiplas requests 401 simultâneas.
let lastRedirectAt = 0;
const REDIRECT_COOLDOWN_MS = 2000;

/** Base HTTP client with JWT auth. Used by all doctor-api-* modules.
 * Auth token is sent automatically via HttpOnly cookie (credentials: 'include').
 * Falls back to Authorization header if a legacy localStorage token exists (migration period).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada. Defina VITE_API_URL.');
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  // Fallback: send Authorization header if legacy localStorage token exists.
  // New logins use HttpOnly cookies (sent automatically via credentials: 'include').
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${base}${url}`, { ...options, headers, credentials: 'include' });
  } catch {
    // Erro de rede/DNS/CORS/timeout — NÃO limpar auth
    throw new Error('Erro de conexão com o servidor.');
  }

  if (res.status === 401) {
    clearAuth();
    // FIX #19: Cooldown baseado em timestamp, sem flag global stale
    const now = Date.now();
    if (now - lastRedirectAt >= REDIRECT_COOLDOWN_MS) {
      lastRedirectAt = now;
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new Error('Sessão expirada');
  }
  return res;
}

// ── Auth Endpoints ──

export async function loginDoctor(email: string, password: string) {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada.');
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      res.status >= 500
        ? 'Erro no servidor. Tente novamente.'
        : (data.message || 'Credenciais inválidas');
    throw new Error(message);
  }
  const data = await res.json();
  const role = (data.user?.role ?? '').toString().toLowerCase();
  if (role !== 'doctor') {
    throw new Error('Acesso restrito a médicos. Use uma conta de médico.');
  }
  storeAuth(data.token, data.user);
  return data;
}

// FIX #8: Alinhado campo `specialty` (nome da especialidade) com o mobile.
// O backend espera `specialty` (string), não `specialtyId`.
export async function registerDoctorFull(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  crm: string;
  crmState: string;
  specialty: string;
  professionalPhone?: string;
  professionalAddress?: string;
  city?: string;
  state?: string;
  cep?: string;
}) {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada.');
  const res = await fetch(`${base}/api/auth/register-doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erro ao criar conta');
  }
  return res.json();
}

export async function logoutDoctor() {
  // Chamar API de logout para invalidar token no servidor e limpar HttpOnly cookie
  try {
    const base = getApiBase();
    const token = getToken();
    const headers: Record<string, string> = {};
    // Send Authorization header as fallback if legacy token exists
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    }).catch(() => {}); // best-effort — não bloquear logout local se a API falhar
  } catch { /* silent */ }

  clearAuth();
  // Disparar evento para React redirecionar via Router, sem hard reload
  window.dispatchEvent(new CustomEvent('auth:expired'));
  // Fallback: se o React não redirecionar em 500ms, forçar navegação
  setTimeout(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, 500);
}

export async function getMe(): Promise<DoctorUser> {
  const res = await authFetch('/api/auth/me');
  if (!res.ok) throw new Error('Erro ao buscar perfil');
  const data = await res.json();
  localStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

export async function getDoctorProfile(): Promise<DoctorProfile> {
  const res = await authFetch('/api/doctors/me');
  if (!res.ok) throw new Error('Erro ao buscar perfil médico');
  return res.json();
}

export async function updateDoctorProfile(payload: Partial<DoctorProfile>) {
  const res = await authFetch('/api/doctors/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar perfil');
  return res.json();
}

export async function updateAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await authFetch('/api/auth/avatar', {
    method: 'PATCH',
    body: formData,
  });
  if (!res.ok) throw new Error('Erro ao atualizar avatar');
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await authFetch('/api/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error('Erro ao alterar senha');
  return res.json();
}

export async function forgotPassword(email: string) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao enviar email');
  return res.json();
}
