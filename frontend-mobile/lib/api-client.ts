import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackApiLatency } from './analytics';
import { logApiError } from './logger';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from './constants/storage-keys';
import { getSecureItem, setSecureItem } from './secure-storage';

const FORBIDDEN_MESSAGE_KEY = '@renoveja:forbidden_message';

/** Debounce 401 logs: múltiplas chamadas simultâneas geram um único log. */
let last401LogAt = 0;
const LOG_401_DEBOUNCE_MS = 3000;

function getPathFromResponse(response: Response): string {
  try {
    const base = typeof response.url === 'string' && response.url.startsWith('/')
      ? 'http://localhost'
      : undefined;
    return new URL(response.url, base).pathname || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Pathname confiável: no RN `response.url` costuma vir vazio → usar sempre a URL da requisição. */
function resolveApiPath(response: Response, requestUrl?: string): string {
  if (requestUrl) {
    try {
      const p = new URL(requestUrl).pathname;
      if (p) return p;
    } catch {
      /* fall through */
    }
  }
  return getPathFromResponse(response);
}

/** Gera um ID de correlação de 16 hex para rastrear a requisição no backend. */
function generateCorrelationId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * 16)];
  }
  return id;
}

// Android emulator uses 10.0.2.2 to reach host machine's localhost
// Physical device needs the LAN IP
// Web uses relative URLs so the Metro dev proxy handles /api/* requests (avoids CORS)
const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web') return '';
  if (Platform.OS === 'android') {
    // 10.0.2.2 só funciona no EMULADOR. Para device físico, defina EXPO_PUBLIC_API_URL no .env
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[ApiClient] Usando 10.0.2.2:5000 (emulador). Para device físico, defina EXPO_PUBLIC_API_URL.');
    }
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim()
    ? process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, '')
    : getDefaultBaseUrl();

/** Timeout padrão para evitar loading infinito quando a API está inacessível.
 *  API (AWS) pode levar até ~60s para cold start. */
const REQUEST_TIMEOUT_MS = 60_000;

/** POST /api/post-consultation/emit — assinatura ICP-Brasil + vários PDFs + S3; costuma ser > 60s. */
export const POST_CONSULTATION_EMIT_TIMEOUT_MS = 180_000;

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
  /** Campos faltantes na validação de receita (ex: paciente.sexo, médico.endereço) */
  missingFields?: string[];
  /** Mensagens de validação em PT-BR */
  messages?: string[];
  /** Código da regra de duplicata: "active_request" | "cooldown_prescription" | "cooldown_exam" */
  code?: string;
  /** Dias restantes até poder solicitar novamente (apenas para cooldown) */
  cooldownDays?: number;
}

type OnUnauthorizedCallback = () => void | Promise<void>;

/**
 * Resultado do refresh:
 * - 'success': token renovado com sucesso
 * - 'invalid': refresh token inválido/expirado (401) → logout é correto
 * - 'error': erro de rede/servidor → NÃO deslogar, manter sessão
 */
type RefreshResult = 'success' | 'invalid' | 'error';

class ApiClient {
  private baseUrl: string;
  private onUnauthorized: OnUnauthorizedCallback | null = null;

  /**
   * Mutex for token refresh: when a 401 triggers a refresh, concurrent requests
   * wait for the same refresh promise instead of firing multiple refresh calls.
   */
  private refreshPromise: Promise<RefreshResult> | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * Returns the result so callers can decide whether to logout or not.
   * Uses a mutex so concurrent 401s share a single refresh call.
   */
  async tryRefreshToken(): Promise<RefreshResult> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async executeRefresh(): Promise<RefreshResult> {
    try {
      const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return 'invalid';

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          ...this.getCommonHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        if (response.status === 401) return 'invalid';
        // 403 from refresh may be DoctorApprovalFilter blocking pending doctors — not an invalid token
        if (response.status === 403) return 'error';
        // 429 (rate limit), 500, 502, etc. = problema transitório → NÃO deslogar
        return 'error';
      }

      const data = await response.json();
      if (!data?.token || !data?.refreshToken) return 'invalid';

      // Persist the new tokens
      await setSecureItem(AUTH_TOKEN_KEY, data.token);
      await setSecureItem(REFRESH_TOKEN_KEY, data.refreshToken);
      this.tokenCache = data.token;

      return 'success';
    } catch {
      // Erro de rede (offline, timeout, DNS) → NÃO deslogar
      return 'error';
    }
  }

  setOnUnauthorized(cb: OnUnauthorizedCallback | null) {
    this.onUnauthorized = cb;
  }

  /** @deprecated 403 não desloga mais; mantido para compat. com mocks antigos. */
  setOnForbidden(_cb: unknown) {}

  /** Cache em memória do token para evitar AsyncStorage em toda requisição (P1 performance). */
  private tokenCache: string | null | undefined = undefined;

  /** Sincroniza o cache com o token atual. Chamar em signIn/signUp após persistir no AsyncStorage. */
  setTokenCache(token: string | null) {
    this.tokenCache = token ?? null;
  }

  /** Limpa o cache. Chamar em signOut/clearAuth. */
  clearTokenCache() {
    this.tokenCache = null;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    if (this.tokenCache !== undefined) {
      return this.tokenCache ? { Authorization: `Bearer ${this.tokenCache}` } : {};
    }
    const token = await getSecureItem(AUTH_TOKEN_KEY);
    this.tokenCache = token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Headers comuns a todas as requisições. */
  private getCommonHeaders(): Record<string, string> {
    return {
      'X-Correlation-Id': generateCorrelationId(),
    };
  }

  /** Executa fetch com timeout e combina signal do caller (navegação/desmontagem) com signal de timeout. */
  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    const endpoint = url.replace(this.baseUrl, '').split('?')[0];

    // Propagar abort do caller para o controller combinado
    const callerSignal = init.signal;
    if (callerSignal) {
      if (callerSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      trackApiLatency(endpoint, Date.now() - start, res.status);
      return res;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      trackApiLatency(endpoint, Date.now() - start, 0);

      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') {
        // Se foi o caller que abortou (navegação), re-throw sem mensagem amigável
        if (callerSignal?.aborted) throw e;
        throw {
          message:
            'O servidor demorou para responder. Isso pode acontecer quando o servidor está iniciando — aguarde alguns segundos e tente novamente.',
          status: 0,
        } as ApiError;
      }
      const msg = err?.message ?? String(e);
      if (typeof msg === 'string' && (msg.includes('Network request failed') || msg.includes('network'))) {
        throw {
          message:
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
          status: 0,
        } as ApiError;
      }
      throw e;
    }
  }

  /**
   * Handles non-ok responses: parses error body, triggers onUnauthorized em 401, logs.
   * 403 não dispara logout global — o backend usa Forbid() em quase todo recurso (vídeo, pedido, documento, médico pendente).
   * Sessão inválida: apenas 401 (+ refresh falho).
   * The `skipUnauthorizedCallback` flag suppresses the onUnauthorized callback —
   * used when the caller will handle 401 via token refresh + retry.
   */
  private async handleResponse<T>(
    response: Response,
    skipUnauthorizedCallback = false,
    requestUrl?: string,
  ): Promise<T> {
    if (!response.ok) {
      let errorMessage = `Erro ${response.status}: Ocorreu um erro na requisição`;
      let errors: Record<string, string[]> | undefined;
      let unauthorizedHandled = false;

      let rawBody = '';
      try {
        rawBody = await response.text();
        if (rawBody) {
          const errorData = JSON.parse(rawBody);
          errors = typeof errorData.errors === 'object' && !Array.isArray(errorData.errors) ? errorData.errors : undefined;
          const firstError =
            Array.isArray(errorData.errors) && errorData.errors.length > 0
              ? errorData.errors[0]
              : errors && typeof errors === 'object'
                ? (Object.values(errors).flat()[0] as string | undefined)
                : null;
          errorMessage =
            errorData.message ||
            errorData.title ||
            errorData.detail ||
            errorData.error ||
            firstError ||
            `${response.status} ${response.statusText}`;
          const err: ApiError = {
            message: errorMessage,
            status: response.status,
            errors,
            missingFields: errorData.missingFields,
            messages: errorData.messages,
            code: errorData.code,
            cooldownDays: errorData.cooldownDays,
          };
          if (response.status === 401 && this.onUnauthorized && !unauthorizedHandled && !skipUnauthorizedCallback) {
            unauthorizedHandled = true;
            this.onUnauthorized();
          }
          if (response.status === 403) {
            AsyncStorage.setItem(FORBIDDEN_MESSAGE_KEY, errorMessage).catch(() => {});
          }
          const path = resolveApiPath(response, requestUrl);
          if (response.status === 401) {
            const now = Date.now();
            if (now - last401LogAt > LOG_401_DEBOUNCE_MS) {
              last401LogAt = now;
              logApiError(response.status, path, errorMessage, {
                body: rawBody ? rawBody.slice(0, 200) : undefined,
              });
            }
          } else {
            logApiError(response.status, path, errorMessage, {
              body: rawBody ? rawBody.slice(0, 200) : undefined,
            });
          }
          throw err;
        } else {
          errorMessage = `${response.status} ${response.statusText}`;
        }
      } catch (e: unknown) {
        // Re-throw structured ApiErrors (already parsed from response body)
        const parsed = e as { status?: number };
        if (parsed?.status !== undefined) {
          throw e;
        }
        // Corpo não-JSON (proxy/WAF/html): tentar texto curto em vez de mensagem genérica
        const trimmed = rawBody.trim();
        if (trimmed && !trimmed.startsWith('<') && trimmed.length < 800) {
          errorMessage = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
        } else {
          // 400 com corpo vazio/nao-JSON: comum com AllowedHosts inválidos ou backend acordando (cold start)
          const hint =
            response.status === 400
              ? ' Aguarde 1–2 min (serviço pode estar acordando). Verifique EXPO_PUBLIC_API_URL.'
              : '';
          errorMessage = `${response.status} ${response.statusText || 'Erro na requisição'}${hint}`;
        }
      }

      const path = resolveApiPath(response, requestUrl);
      const bodyExtra = rawBody ? { body: rawBody.slice(0, 200) } : undefined;
      if (response.status === 401) {
        const now = Date.now();
        if (now - last401LogAt > LOG_401_DEBOUNCE_MS) {
          last401LogAt = now;
          logApiError(response.status, path, errorMessage, bodyExtra);
        }
      } else {
        logApiError(response.status, path, errorMessage, bodyExtra);
      }

      if (response.status === 401 && this.onUnauthorized && !unauthorizedHandled && !skipUnauthorizedCallback) {
        this.onUnauthorized();
      }
      if (response.status === 403) {
        AsyncStorage.setItem(FORBIDDEN_MESSAGE_KEY, errorMessage).catch(() => {});
      }

      const error: ApiError = {
        message: errorMessage,
        status: response.status,
        errors,
      };

      throw error;
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    // Ngrok devolve HTML de "browser warning" quando o header ngrok-skip-browser-warning não é aceite. Tratar como erro.
    if (contentType.includes('text/html')) {
      logApiError(502, getPathFromResponse(response), 'Resposta HTML em vez de JSON (ngrok?). Verifique EXPO_PUBLIC_API_URL.');
      throw {
        message: 'A API retornou uma página em vez de dados. Se estiver usando ngrok, confira a URL da API (EXPO_PUBLIC_API_URL) e tente novamente.',
        status: 502,
      } as ApiError;
    }
    // For text responses (like PIX code)
    return (await response.text()) as unknown as T;
  }

  /**
   * Executes an authenticated fetch. On 401, attempts to refresh the token
   * and retries the request once.
   *
   * Refresh results:
   * - 'success': retry com novo token
   * - 'invalid': refresh token expirado → onUnauthorized (logout)
   * - 'error': rede/servidor falhou → NÃO deslogar, propagar erro sem callback
   *
   * Auth endpoints (login, register, refresh) bypass the retry logic.
   */
  private async fetchWithAuthRetry<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const isAuthEndpoint = /\/api\/auth\/(login|register|refresh|google|forgot-password|reset-password)/.test(url);

    const response = await this.fetchWithTimeout(url, init, timeoutMs);

    if (response.status === 401 && !isAuthEndpoint) {
      const refreshResult = await this.tryRefreshToken();
      if (refreshResult === 'success') {
        // Rebuild auth header with the new token and retry
        const newAuthHeaders = await this.getAuthHeader();
        const retryHeaders = { ...init.headers, ...newAuthHeaders } as Record<string, string>;
        const retryResponse = await this.fetchWithTimeout(url, { ...init, headers: retryHeaders }, timeoutMs);
        return this.handleResponse<T>(retryResponse, false, url);
      }
      if (refreshResult === 'error') {
        // Rede/servidor falhou no refresh — NÃO deslogar.
        // Propagar o 401 original sem disparar onUnauthorized (skipUnauthorizedCallback = true).
        return this.handleResponse<T>(response, true, url);
      }
      // 'invalid' — refresh token realmente expirado/inválido → dispara onUnauthorized (logout)
      return this.handleResponse<T>(response, false, url);
    }

    return this.handleResponse<T>(response, false, url);
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>, options?: { signal?: AbortSignal }): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    // Build query string
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return this.fetchWithAuthRetry<T>(url, {
      method: 'GET',
      headers: { ...this.getCommonHeaders(), ...authHeaders },
      signal: options?.signal,
    });
  }

  /** GET que retorna Blob (ex.: PDF). Com retry de token em 401. */
  async getBlob(path: string): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;

    const doFetch = async () => {
      const authHeaders = await this.getAuthHeader();
      return this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { ...this.getCommonHeaders(), ...authHeaders },
      });
    };

    let response = await doFetch();

    if (response.status === 401) {
      const refreshResult = await this.tryRefreshToken();
      if (refreshResult === 'success') {
        response = await doFetch();
      } else if (refreshResult === 'invalid') {
        if (this.onUnauthorized) this.onUnauthorized();
      }
      // 'error' (network/server) → don't logout, fall through with original response
    }

    if (!response.ok) {
      let msg = 'Erro ao obter recurso';
      try {
        const err = await response.json();
        msg = err.message || err.error || msg;
      } catch { }
      if (response.status === 403) {
        AsyncStorage.setItem(FORBIDDEN_MESSAGE_KEY, msg).catch(() => {});
      }
      throw { message: msg, status: response.status } as ApiError;
    }
    return response.blob();
  }

  /**
   * @param third `true` = multipart (legado). Ou objeto com `isMultipart` e/ou `timeoutMs` para rotas longas.
   */
  async post<T>(
    path: string,
    body?: unknown,
    third?: boolean | { isMultipart?: boolean; timeoutMs?: number },
  ): Promise<T> {
    const isMultipart = typeof third === 'boolean' ? third : third?.isMultipart ?? false;
    const timeoutMs =
      typeof third === 'object' && third !== null && typeof third.timeoutMs === 'number'
        ? third.timeoutMs
        : REQUEST_TIMEOUT_MS;

    const authHeaders = await this.getAuthHeader();

    const headers: Record<string, string> = {
      ...this.getCommonHeaders(),
      ...authHeaders,
    };

    let bodyData: string | FormData;

    if (isMultipart) {
      // FormData handles its own content-type with boundary
      bodyData = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      bodyData = JSON.stringify(body ?? {});
    }

    return this.fetchWithAuthRetry<T>(
      `${this.baseUrl}${path}`,
      {
        method: 'POST',
        headers,
        body: bodyData,
      },
      timeoutMs,
    );
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    return this.fetchWithAuthRetry<T>(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        ...this.getCommonHeaders(),
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    return this.fetchWithAuthRetry<T>(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...this.getCommonHeaders(),
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async patchMultipart<T>(path: string, formData: FormData): Promise<T> {
    const authHeaders = await this.getAuthHeader();
    return this.fetchWithAuthRetry<T>(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...this.getCommonHeaders(),
        ...authHeaders,
      },
      body: formData,
    });
  }

  async delete<T>(path: string): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    return this.fetchWithAuthRetry<T>(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        ...this.getCommonHeaders(),
        ...authHeaders,
      },
    });
  }

  // Helper to set base URL (useful for testing or changing environments)
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Token para construir URL da chamada de vídeo (ex.: call-page?access_token=...) */
  async getAuthToken(): Promise<string | null> {
    if (this.tokenCache !== undefined) return this.tokenCache;
    const token = await getSecureItem(AUTH_TOKEN_KEY);
    this.tokenCache = token;
    return token;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

/**
 * Extrai mensagem de erro amigável para exibir na UI.
 * Use em todas as telas que mostram erro de API (Alert, setError, etc.).
 */
export function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as ApiError).message === 'string') {
    return (err as ApiError).message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Ocorreu um erro. Tente novamente.';
}

// Export class for testing or multiple instances
export default ApiClient;
