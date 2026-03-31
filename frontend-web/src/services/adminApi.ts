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
const ADMIN_REFRESH_TOKEN_KEY = "admin_refresh_token";
const ADMIN_LOGIN_AT_KEY = "admin_login_at";
const ADMIN_ROLE_KEY = "admin_user_role";
const TOKEN_VALID_DAYS = 25;

let adminRefreshPromise: Promise<boolean> | null = null;
let lastAdminRedirectAt = 0;

function getToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
}

function getLoginTimestamp(): number | null {
  const raw = localStorage.getItem(ADMIN_LOGIN_AT_KEY);
  if (!raw) return null;
  const ts = parseInt(raw, 10);
  return Number.isNaN(ts) ? null : ts;
}

async function executeAdminRefresh(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const base = getApiBase();
    if (!base) return false;
    const response = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data?.token || !data?.refreshToken) return false;
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function tryAdminRefreshToken(): Promise<boolean> {
  if (adminRefreshPromise) return adminRefreshPromise;
  adminRefreshPromise = executeAdminRefresh();
  try {
    return await adminRefreshPromise;
  } finally {
    adminRefreshPromise = null;
  }
}

function buildAdminHeaders(options: RequestInit): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
    ...(options.headers as Record<string, string> || {}),
  };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  if (!base) throw new Error("URL da API não configurada. Defina VITE_API_URL.");
  let res: Response;
  try {
    res = await fetch(`${base}${url}`, { ...options, headers: buildAdminHeaders(options), credentials: "include" });
  } catch {
    throw new Error("Erro de conexão. Verifique sua internet e tente novamente.");
  }
  if (res.status === 401) {
    const refreshed = await tryAdminRefreshToken();
    if (refreshed) {
      try {
        res = await fetch(`${base}${url}`, { ...options, headers: buildAdminHeaders(options), credentials: "include" });
      } catch {
        throw new Error("Erro de conexão. Verifique sua internet e tente novamente.");
      }
      if (res.status !== 401) return res;
    }
    const now = Date.now();
    if (now - lastAdminRedirectAt < 3000) return res;
    lastAdminRedirectAt = now;
    clearAdminSession();
    window.location.href = "/admin/login";
    throw new Error("Não autorizado");
  }
  if (res.status === 403) {
    throw new Error("Acesso negado — você não tem permissão para esta ação.");
  }
  return res;
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
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
  if (data.refreshToken) {
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, data.refreshToken);
  }
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
  if (loginAt == null) return false;
  const ageDays = (Date.now() - loginAt) / (1000 * 60 * 60 * 24);
  if (ageDays > TOKEN_VALID_DAYS) {
    clearAdminSession();
    return false;
  }
  return true;
}

export async function validateAdminToken(signal?: AbortSignal): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  const base = getApiBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getDoctors(params?: { status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const res = await authFetch(`/api/admin/doctors${qs ? `?${qs}` : ""}`);
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
