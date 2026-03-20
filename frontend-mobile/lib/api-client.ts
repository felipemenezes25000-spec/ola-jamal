import { Platform } from 'react-native';
import { trackApiLatency } from './analytics';
import { logApiError } from './logger';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from './constants/storage-keys';
import { getSecureItem, setSecureItem } from './secure-storage';

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

/** Timeout para evitar loading infinito quando a API está inacessível.
 *  API (AWS) pode levar até 60s para cold start, então usamos 60s. */
const REQUEST_TIMEOUT_MS = 60_000;

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
type OnForbiddenCallback = (message?: string) => void | Promise<void>;

class ApiClient {
  private baseUrl: string;
  private onUnauthorized: OnUnauthorizedCallback | null = null;
  private onForbidden: OnForbiddenCallback | null = null;

  /**
   * Mutex for token refresh: when a 401 triggers a refresh, concurrent requests
   * wait for the same refresh promise instead of firing multiple refresh calls.
   */
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * Returns true if refresh succeeded, false otherwise.
   * Uses a mutex so concurrent 401s share a single refresh call.
   */
  async tryRefreshToken(): Promise<boolean> {
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

  private async executeRefresh(): Promise<boolean> {
    try {
      const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          ...this.getCommonHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (!data?.token || !data?.refreshToken) return false;

      // Persist the new tokens
      await setSecureItem(AUTH_TOKEN_KEY, data.token);
      await setSecureItem(REFRESH_TOKEN_KEY, data.refreshToken);
      this.tokenCache = data.token;

      return true;
    } catch {
      return false;
    }
  }

  setOnUnauthorized(cb: OnUnauthorizedCallback | null) {
    this.onUnauthorized = cb;
  }

  setOnForbidden(cb: OnForbiddenCallback | null) {
    this.onForbidden = cb;
  }

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

  /** Headers comuns a todas as requisições (ex.: ngrok exige header para não devolver página HTML no browser). */
  private getCommonHeaders(): Record<string, string> {
    // Always send ngrok header: on web the baseUrl is empty (relative URLs via proxy),
    // but the proxy target may still be behind ngrok.
    return {
      'X-Correlation-Id': generateCorrelationId(),
      'ngrok-skip-browser-warning': 'true',
    };
  }

  /** Executa fetch com timeout e combina signal do caller (navegação/desmontagem) com signal de timeout. */
  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
   * Handles non-ok responses: parses error body, triggers callbacks (401/403), logs.
   * The `skipUnauthorizedCallback` flag suppresses the onUnauthorized callback —
   * used when the caller will handle 401 via token refresh + retry.
   */
  private async handleResponse<T>(response: Response, skipUnauthorizedCallback = false): Promise<T> {
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
          const path = getPathFromResponse(response);
          // 403 em avatar/senha/requests/documentos/PDF: não deslogar — pode ser validação (ex.: médico pendente, tipo de arquivo, sem permissão ao documento)
          const skipForbiddenLogout = /\/api\/(auth\/(avatar|change-password)|requests\/|post-consultation\/|doctors\/|fhir-lite\/)/.test(path);
          if (response.status === 403 && this.onForbidden && !skipForbiddenLogout) {
            this.onForbidden(errorMessage);
          }
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

      const path = getPathFromResponse(response);
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
      const skipForbiddenLogout = /\/api\/(auth\/(avatar|change-password)|requests\/|post-consultation\/|doctors\/|fhir-lite\/)/.test(path);
      if (response.status === 403 && this.onForbidden && !skipForbiddenLogout) {
        this.onForbidden(errorMessage);
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
      return {} as T;
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
   * and retries the request once. If refresh fails, triggers onUnauthorized.
   *
   * Auth endpoints (login, register, refresh) bypass the retry logic.
   */
  private async fetchWithAuthRetry<T>(
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const isAuthEndpoint = /\/api\/auth\/(login|register|refresh|google|forgot-password|reset-password)/.test(url);

    const response = await this.fetchWithTimeout(url, init);

    if (response.status === 401 && !isAuthEndpoint) {
      // Try to refresh the token before giving up
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Rebuild auth header with the new token and retry
        const newAuthHeaders = await this.getAuthHeader();
        const retryHeaders = { ...init.headers, ...newAuthHeaders } as Record<string, string>;
        const retryResponse = await this.fetchWithTimeout(url, { ...init, headers: retryHeaders });
        return this.handleResponse<T>(retryResponse);
      }
      // Refresh failed — parse and throw the original 401 (which triggers onUnauthorized)
      return this.handleResponse<T>(response);
    }

    return this.handleResponse<T>(response);
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

  /** GET que retorna Blob (ex.: PDF). */
  async getBlob(path: string): Promise<Blob> {
    const authHeaders = await this.getAuthHeader();
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { ...this.getCommonHeaders(), ...authHeaders },
    });
    if (!response.ok) {
      let msg = 'Erro ao obter recurso';
      try {
        const err = await response.json();
        msg = err.message || err.error || msg;
      } catch { }
      throw { message: msg, status: response.status };
    }
    return response.blob();
  }

  async post<T>(path: string, body?: unknown, isMultipart: boolean = false): Promise<T> {
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

    return this.fetchWithAuthRetry<T>(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: bodyData,
    });
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
