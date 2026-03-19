/**
 * API do painel admin — aprovação/reprovação de médicos.
 * Usa VITE_API_URL (mesma URL do backend que o frontend-web usa para verify).
 */

function getApiBase(): string {
  const env = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
  if (env) return env;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

const ADMIN_TOKEN_KEY = "admin_auth_token";
const ADMIN_LOGIN_AT_KEY = "admin_login_at";
const ADMIN_ROLE_KEY = "admin_user_role";
/** Tokens do backend expiram em 30 dias; consideramos expirado após 25 dias no client para evitar UX quebrada. */
const TOKEN_VALID_DAYS = 25;

function getToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getLoginTimestamp(): number | null {
  const raw = localStorage.getItem(ADMIN_LOGIN_AT_KEY);
  if (!raw) return null;
  const ts = parseInt(raw, 10);
  return Number.isNaN(ts) ? null : ts;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  if (!base) throw new Error("URL da API não configurada. Defina VITE_API_URL.");
  const token = getToken();
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
    ...(options.headers as Record<string, string> || {}),
  };
  // Don't set Content-Type for FormData — browser sets multipart boundary automatically
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  // Send Authorization header as fallback for legacy localStorage tokens.
  // New logins use HttpOnly cookies sent automatically via credentials: 'include'.
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${base}${url}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error("Erro de conexão. Verifique sua internet e tente novamente.");
  }
  if (res.status === 401) {
    clearAdminSession();
    window.location.href = "/admin/login";
    throw new Error("Não autorizado");
  }
  if (res.status === 403) {
    clearAdminSession();
    window.location.href = "/admin/login?error=forbidden";
    throw new Error("Acesso negado — apenas administradores");
  }
  return res;
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_LOGIN_AT_KEY);
  localStorage.removeItem(ADMIN_ROLE_KEY);
}

export async function login(email: string, password: string) {
  const base = getApiBase();
  if (!base) throw new Error("URL da API não configurada. Defina VITE_API_URL.");
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Credenciais inválidas");
  const data = await res.json();

  // Verificar se o usuário é admin ou sus (ambos têm acesso ao painel)
  const role = data.user?.role;
  if (role !== "admin" && role !== "sus") {
    throw new Error("ACCESS_DENIED");
  }

  localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
  localStorage.setItem(ADMIN_LOGIN_AT_KEY, String(Date.now()));
  localStorage.setItem(ADMIN_ROLE_KEY, role);
  return data;
}

export async function logout() {
  // Call backend to invalidate token and clear HttpOnly cookie
  try {
    const base = getApiBase();
    const token = getToken();
    const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers,
      credentials: "include",
    }).catch(() => {}); // best-effort
  } catch { /* silent */ }
  clearAdminSession();
  window.location.href = "/admin/login";
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  // Verificar se a role salva é admin ou sus
  const role = localStorage.getItem(ADMIN_ROLE_KEY);
  if (role && role !== "admin" && role !== "sus") {
    clearAdminSession();
    return false;
  }

  const loginAt = getLoginTimestamp();
  if (loginAt == null) return true;
  const ageDays = (Date.now() - loginAt) / (1000 * 60 * 60 * 24);
  if (ageDays > TOKEN_VALID_DAYS) {
    clearAdminSession();
    return false;
  }
  return true;
}

export async function getDoctors(status?: string) {
  const query = status && status !== "all" ? `?status=${status}` : "";
  const res = await authFetch(`/api/admin/doctors${query}`);
  if (!res.ok) throw new Error("Erro ao buscar médicos");
  return res.json();
}

export async function approveDoctor(id: string) {
  const res = await authFetch(`/api/admin/doctors/${id}/approve`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao aprovar médico");
  return res.json();
}

export async function rejectDoctor(id: string, reason?: string) {
  const res = await authFetch(`/api/admin/doctors/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  });
  if (!res.ok) throw new Error("Erro ao recusar médico");
  return res.json();
}
