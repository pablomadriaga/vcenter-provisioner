const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(callback: () => void) {
  onUnauthorizedCallback = callback;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isUnauthorized: boolean = false,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async processResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
      }
      throw new ApiError(errorMessage, response.status, false, false);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh(refreshToken)
        .finally(() => { this.refreshPromise = null; });
    }

    return this.refreshPromise;
  }

  private async doRefresh(refreshToken: string): Promise<boolean> {
    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      localStorage.setItem('token', data.token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      return true;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    const { timeout = 10000, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'same-origin'
      });

      if (response.status === 401) {
        const refreshed = await this.attemptTokenRefresh();

        if (refreshed) {
          const newToken = localStorage.getItem('token');
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, { ...fetchOptions, headers, credentials: 'same-origin' });
        } else {
          if (onUnauthorizedCallback) onUnauthorizedCallback();
          throw new ApiError('Session expired. Please log in again.', 401, true, false);
        }
      }

      return this.processResponse<T>(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Request timed out', 408, false, true);
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error. Please check your connection.', 0, false, true);
    } finally {
      clearTimeout(timer);
    }
  }

  async get<T>(endpoint: string, options?: { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, options?: { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
