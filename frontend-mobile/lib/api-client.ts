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
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'Ocorreu um erro na requisição';
      let errors: Record<string, string[]> | undefined;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.title || errorMessage;
        errors = errorData.errors;
      } catch {
        // If parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
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

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    // For text responses (like PIX code)
    return (await response.text()) as unknown as T;
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
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
      headers: { ...authHeaders },
    });

    return this.handleResponse<T>(response);
  }

  /** GET que retorna Blob (ex.: PDF). */
  async getBlob(path: string): Promise<Blob> {
    const authHeaders = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { ...authHeaders },
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
