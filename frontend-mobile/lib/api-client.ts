import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = '@renoveja:auth_token';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
// Physical device needs the LAN IP
// Web uses localhost directly
const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:5000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultBaseUrl();

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

class ApiClient {
  private baseUrl: string;
  private onUnauthorized: OnUnauthorizedCallback | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setOnUnauthorized(cb: OnUnauthorizedCallback | null) {
    this.onUnauthorized = cb;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /** Headers comuns a todas as requisições (ex.: ngrok exige header para não devolver página HTML no browser). */
  private getCommonHeaders(): Record<string, string> {
    const isNgrok = this.baseUrl.includes('ngrok');
    return isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {};
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `Erro ${response.status}: Ocorreu um erro na requisição`;
      let errors: Record<string, string[]> | undefined;

      try {
        const text = await response.text();
        if (text) {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.title || errorData.detail || `${response.status} ${response.statusText}`;
          errors = errorData.errors;
          const err: ApiError = {
            message: errorMessage,
            status: response.status,
            errors,
            missingFields: errorData.missingFields,
            messages: errorData.messages,
          };
          if (response.status === 401 && this.onUnauthorized) {
            this.onUnauthorized();
          }
          if (__DEV__) {
            console.warn('[API] Erro:', response.status, errorMessage);
          }
          throw err;
        } else {
          errorMessage = `${response.status} ${response.statusText}`;
        }
      } catch (e: any) {
        if (e?.missingFields !== undefined || e?.messages !== undefined) {
          throw e;
        }
        errorMessage = `${response.status} ${response.statusText || 'Erro na requisição'}`;
      }

      if (__DEV__) {
        console.warn('[API] Erro:', response.status, errorMessage);
      }

      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
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
      if (__DEV__) {
        console.warn('[API] Resposta 200 com content-type text/html (página ngrok). Verifique EXPO_PUBLIC_API_URL e se o header ngrok-skip-browser-warning está sendo enviado.');
      }
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

    const response = await fetch(url, {
      method: 'GET',
      headers: { ...this.getCommonHeaders(), ...authHeaders },
      signal: options?.signal,
    });

    return this.handleResponse<T>(response);
  }

  /** GET que retorna Blob (ex.: PDF). */
  async getBlob(path: string): Promise<Blob> {
    const authHeaders = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { ...this.getCommonHeaders(), ...authHeaders },
    });
    if (!response.ok) {
      let msg = 'Erro ao obter recurso';
      try {
        const err = await response.json();
        msg = err.message || err.error || msg;
      } catch {}
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
      bodyData = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: bodyData,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body?: any): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
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

    const response = await fetch(`${this.baseUrl}${path}`, {
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

  async delete<T>(path: string): Promise<T> {
    const authHeaders = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
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
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing or multiple instances
export default ApiClient;
