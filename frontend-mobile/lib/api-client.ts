import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { trackApiLatency } from './analytics';
import { logApiError } from './logger';

const TOKEN_KEY = '@renoveja:auth_token';

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
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
};

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim()
    ? process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, '')
    : getDefaultBaseUrl();

/** Timeout para evitar loading infinito quando a API está inacessível.
 *  Render free tier pode levar até 60s para cold start, então usamos 60s. */
const REQUEST_TIMEOUT_MS = 60_000;

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
  /** Campos faltantes na validação de receita (ex: paciente.sexo, médico.endereço) */
  missingFields?: string[];
  /** Mensagens de validação em PT-BR */
  messages?: string[];
}

type OnUnauthorizedCallback = () => void | Promise<void>;
type OnForbiddenCallback = (message?: string) => void | Promise<void>;

class ApiClient {
  private baseUrl: string;
  private onUnauthorized: OnUnauthorizedCallback | null = null;
  private onForbidden: OnForbiddenCallback | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
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
    const token = await AsyncStorage.getItem(TOKEN_KEY);
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
    } catch (e: any) {
      clearTimeout(timeoutId);
      trackApiLatency(endpoint, Date.now() - start, 0);

      if (e?.name === 'AbortError') {
        // Se foi o caller que abortou (navegação), re-throw sem mensagem amigável
        if (callerSignal?.aborted) throw e;
        throw {
          message:
            'O servidor demorou para responder. Isso pode acontecer quando o servidor está iniciando — aguarde alguns segundos e tente novamente.',
          status: 0,
        } as ApiError;
      }
      const msg = e?.message ?? String(e);
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

  private async handleResponse<T>(response: Response): Promise<T> {
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
            firstError ||
            `${response.status} ${response.statusText}`;
          const err: ApiError = {
            message: errorMessage,
            status: response.status,
            errors,
            missingFields: errorData.missingFields,
            messages: errorData.messages,
          };
          if (response.status === 401 && this.onUnauthorized && !unauthorizedHandled) {
            unauthorizedHandled = true;
            this.onUnauthorized();
          }
          if (response.status === 403 && this.onForbidden) {
            this.onForbidden(errorMessage);
          }
          const path = getPathFromResponse(response);
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
      } catch (e: any) {
        // Re-throw structured ApiErrors (already parsed from response body)
        if (e?.status !== undefined) {
          throw e;
        }
        // 400 com corpo vazio/não-JSON: comum com AllowedHosts, Supabase inválido ou backend acordando (Render)
        const hint =
          response.status === 400
            ? ' Se usar Render, aguarde 1–2 min (serviço pode estar acordando). Verifique EXPO_PUBLIC_API_URL.'
            : '';
        errorMessage = `${response.status} ${response.statusText || 'Erro na requisição'}${hint}`;
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

      if (response.status === 401 && this.onUnauthorized && !unauthorizedHandled) {
        this.onUnauthorized();
      }
      if (response.status === 403 && this.onForbidden) {
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

  async get<T>(path: string, params?: Record<string, any>, options?: { signal?: AbortSignal }): Promise<T> {
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

    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: { ...this.getCommonHeaders(), ...authHeaders },
      signal: options?.signal,
    });

    return this.handleResponse<T>(response);
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

  async post<T>(path: string, body?: any, isMultipart: boolean = false): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const headers: Record<string, string> = {
      ...this.getCommonHeaders(),
      ...authHeaders,
    };

    let bodyData: any;

    if (isMultipart) {
      // FormData handles its own content-type with boundary
      bodyData = body;
    } else {
      headers['Content-Type'] = 'application/json';
      bodyData = JSON.stringify(body ?? {});
    }

    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: bodyData,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body?: any): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        ...this.getCommonHeaders(),
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body?: any): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...this.getCommonHeaders(),
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async patchMultipart<T>(path: string, formData: FormData): Promise<T> {
    const authHeaders = await this.getAuthHeader();
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...this.getCommonHeaders(),
        ...authHeaders,
      },
      body: formData,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        ...this.getCommonHeaders(),
        ...authHeaders,
      },
    });

    return this.handleResponse<T>(response);
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
    const token = await AsyncStorage.getItem(TOKEN_KEY);
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
