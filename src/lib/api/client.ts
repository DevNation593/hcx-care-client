import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { ApiError } from '@/types';
import { MISSING_REQUIREMENT_LABELS, type MissingRequirement } from '@/types/treatments';
import type { BillingCode, ClinicalBillingCode } from '@/types/cash';

const CLINICAL_BILLING_CODES: ClinicalBillingCode[] = [
  'FINALIZED_MEDICAL_FORM', 'SIGNED_APPLICABLE_CONSENT', 'CLINICAL_COMPLETION', 'SESSION_NOT_BILLABLE',
];
const BILLING_CODES: BillingCode[] = [
  ...CLINICAL_BILLING_CODES,
  'BILLING_PROFILE', 'INVOICE_ITEMS', 'BALANCE_DUE', 'INVOICING_NOT_CONFIGURED',
];

// ==========================================
// API CLIENT CONFIGURATION
// ==========================================

/** The text of a Blob; FileReader where Blob.text is missing (older engines, jsdom). */
function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor: Add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle 401 and refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        await this.readBlobErrorBody(error);
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const requestUrl = originalRequest?.url || '';
        const isAuthEndpoint =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/refresh') ||
          requestUrl.includes('/auth/forgot-password') ||
          requestUrl.includes('/auth/reset-password') ||
          requestUrl.includes('/auth/change-password');

        // Never try token refresh for auth endpoints (login/reset/etc.)
        if (error.response?.status === 401 && isAuthEndpoint) {
          return Promise.reject(this.normalizeError(error));
        }

        // A temporary password blocks every request but the change itself.
        if (
          error.response?.status === 403 &&
          this.getErrorCode(error) === 'PASSWORD_CHANGE_REQUIRED' &&
          typeof window !== 'undefined' &&
          window.location.pathname !== '/change-password'
        ) {
          window.location.href = '/change-password';
        }

        // Handle 401 Unauthorized for protected endpoints
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshAccessToken();
            this.isRefreshing = false;
            this.onRefreshed(newToken);
            this.refreshSubscribers = [];

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            this.refreshSubscribers = [];
            this.clearAuthData();
            
            // Redirect to login
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
            return Promise.reject(this.normalizeError(error));
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private onRefreshed(token: string): void {
    this.refreshSubscribers.forEach((callback) => callback(token));
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    this.setTokens(accessToken, newRefreshToken);
    return accessToken;
  }

  /**
   * A request that expects a file (responseType 'blob') receives its error body as a Blob too:
   * it is read as JSON so the error keeps the API's code and message.
   */
  private async readBlobErrorBody(error: AxiosError): Promise<void> {
    const response = error.response;
    if (!response || typeof Blob === 'undefined' || !(response.data instanceof Blob)) return;
    try {
      response.data = JSON.parse(await blobText(response.data));
    } catch {
      // Not JSON: the error keeps its status and the generic message.
      response.data = null;
    }
  }

  private getErrorCode(error: AxiosError): string | undefined {
    const body: unknown = error.response?.data;
    return body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      ? body.code
      : undefined;
  }

  private normalizeError(error: AxiosError): ApiError {
    if (error.response) {
      const body: unknown = error.response.data;
      const data = body && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown> : {};
      const normalized: ApiError = {
        message: typeof data.message === 'string' && data.message.trim() ? data.message : 'Ocurrió un error',
        status: error.response.status,
      };
      if (typeof data.code === 'string') normalized.code = data.code;
      // Guards report their machine-readable code in `error` (e.g. FEATURE_NOT_AVAILABLE).
      else if (typeof data.error === 'string' && /^[A-Z][A-Z0-9_]+$/.test(data.error)) {
        normalized.code = data.error;
      }
      if (typeof data.field === 'string') normalized.field = data.field;
      if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
        normalized.details = data.details as Record<string, unknown>;
      }
      // A blocked start or completion of a treatment session lists what is still missing.
      if (Array.isArray(data.missing)) {
        normalized.missing = data.missing.filter(
          (item): item is MissingRequirement =>
            typeof item === 'string' && Object.hasOwn(MISSING_REQUIREMENT_LABELS, item),
        );
        if (
          normalized.code === 'ORDER_NOT_BILLABLE' ||
          normalized.code === 'TREATMENT_DOCUMENTATION_INCOMPLETE'
        ) {
          normalized.billingEligibility = {
            eligible: false,
            missing: data.missing.filter(
              (code): code is BillingCode => BILLING_CODES.includes(code as BillingCode),
            ),
            items: Array.isArray(data.items) ? data.items.flatMap((item) => {
              if (
                !item || typeof item !== 'object' || typeof item.itemId !== 'string' ||
                typeof item.patientName !== 'string' || !Array.isArray(item.codes)
              ) return [];
              return [{
                itemId: item.itemId,
                patientName: item.patientName,
                codes: item.codes.filter(
                  (code: unknown): code is ClinicalBillingCode =>
                    CLINICAL_BILLING_CODES.includes(code as ClinicalBillingCode),
                ),
              }];
            }) : [],
          };
        }
      }
      // A treatment whose requirements are rejected lists the problems as plain texts.
      if (Array.isArray(data.issues)) {
        normalized.issues = data.issues
          .filter((issue): issue is string => typeof issue === 'string')
          .map((message) => ({ field: '', message }));
      }
      // Validation of clinical records and form definitions lists one issue per field.
      if (Array.isArray(data.details)) {
        normalized.issues = data.details.filter(
          (issue): issue is { field: string; message: string } =>
            !!issue && typeof issue === 'object' &&
            typeof (issue as Record<string, unknown>).field === 'string' &&
            typeof (issue as Record<string, unknown>).message === 'string',
        );
      }
      return normalized;
    }

    if (error.request) {
      return {
        message: 'No se recibió respuesta del servidor. Verifica tu conexión a internet.',
        code: 'NETWORK_ERROR',
      };
    }

    return {
      message: error.message || 'Ocurrió un error inesperado',
      code: 'UNKNOWN_ERROR',
    };
  }

  // ==========================================
  // TOKEN MANAGEMENT
  // ==========================================

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  public setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  public clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TENANT);
    localStorage.removeItem('auth-storage');
  }

  // ==========================================
  // HTTP METHODS
  // ==========================================

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // ==========================================
  // FILE UPLOAD
  // ==========================================

  public async upload<T>(
    url: string, 
    file: File, 
    onProgress?: (progress: number) => void,
    metadata?: Record<string, any>
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata fields to FormData
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
