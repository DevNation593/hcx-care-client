import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { markApiError } from '@/lib/monitoring/api-error-marker';
import { isAccessTokenExpired } from './access-token';
import { ApiError } from '@/types';
import { MISSING_REQUIREMENT_LABELS, type MissingRequirement } from '@/types/treatments';
import type { BillingCode, ClinicalBillingCode } from '@/types/cash';
import {
  messageFromBody,
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from './error-messages';

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

/**
 * The web client identifies itself to the API with this header. The refresh token is an HttpOnly
 * cookie that the browser sends on its own, and the API only accepts it from a request that
 * carries the header: being a non-simple header it cannot be added by a cross-site form.
 */
const WEB_CLIENT_HEADERS = { 'X-Client': 'web' } as const;

/** Name of the Web Lock that serialises the token refresh across the tabs of the browser. */
const REFRESH_LOCK = 'hcx-refresh-session';

/** Same limit as any other request. It also bounds the wait for the lock of another tab. */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Only an answer of the API that refuses the refresh cookie ends the session. A network error,
 * a timeout, a 5xx or a 429 says nothing about the session: it is kept and the next request
 * tries again.
 */
function refusesSession(error: unknown): boolean {
  const status = (error as AxiosError | null)?.response?.status;
  return status === 401 || status === 403;
}

/** What the requests queued during a refresh are told once it ends. */
type RefreshOutcome = { token: string } | { error: unknown };

export type SessionRestoreResult = 'active' | 'expired' | 'unavailable';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(outcome: RefreshOutcome) => void> = [];
  private refreshInFlight: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      // Sends and receives the refresh cookie on every call to the API.
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        ...WEB_CLIENT_HEADERS,
      },
    });

    // Earlier versions kept the refresh token in localStorage, where a script can read it.
    this.clearLegacyRefreshToken();
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
          requestUrl.includes('/auth/change-password') ||
          requestUrl.includes('/auth/mfa/verify');

        // Never try token refresh for auth endpoints (login/reset/etc.)
        if (error.response?.status === 401 && isAuthEndpoint) {
          return Promise.reject(markApiError(this.normalizeError(error)));
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

        // A clinic that requires two-factor sign-in blocks everything until it is set up.
        if (
          error.response?.status === 403 &&
          this.getErrorCode(error) === 'MFA_ENROLLMENT_REQUIRED' &&
          typeof window !== 'undefined' &&
          window.location.pathname !== '/security/two-factor'
        ) {
          window.location.href = '/security/two-factor';
        }

        // Handle 401 Unauthorized for protected endpoints
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve, reject) => {
              this.refreshSubscribers.push((outcome) => {
                if ('error' in outcome) {
                  // The session ended: the request fails as the unauthorised one it was.
                  // Otherwise the refresh could not be done and says why.
                  const cause = refusesSession(outcome.error) ? error : (outcome.error as AxiosError);
                  reject(markApiError(this.normalizeError(cause)));
                  return;
                }
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${outcome.token}`;
                }
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshAccessToken(this.bearerOf(originalRequest));
            this.isRefreshing = false;
            this.settleSubscribers({ token: newToken });

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            // Queued requests are answered too, never left hanging.
            this.settleSubscribers({ error: refreshError });

            if (!refusesSession(refreshError)) {
              // Network, timeout, 5xx or 429: the session may be fine. Keep it, fail this request
              // with what happened and let the next one try the refresh again.
              return Promise.reject(markApiError(this.normalizeError(refreshError as AxiosError)));
            }
            this.clearAuthData();

            // Redirect to login
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
            return Promise.reject(markApiError(this.normalizeError(error)));
          }
        }

        return Promise.reject(markApiError(this.normalizeError(error)));
      }
    );
  }

  private settleSubscribers(outcome: RefreshOutcome): void {
    const subscribers = this.refreshSubscribers;
    this.refreshSubscribers = [];
    subscribers.forEach((callback) => callback(outcome));
  }

  /** The access token a request was sent with. */
  private bearerOf(request: InternalAxiosRequestConfig): string | null {
    const header = request.headers?.Authorization;
    return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
  }

  /**
   * Gets a new access token with the refresh cookie (no body: the token is never readable from
   * here). Concurrent calls share one request, because rotating the same cookie twice would be
   * read by the API as a reused token and end the session.
   *
   * `staleToken` is the access token that was rejected (or found expired). If another tab
   * already replaced it while this one waited its turn, that newer token is used instead of
   * rotating the cookie again.
   */
  public refreshAccessToken(staleToken: string | null = this.getAccessToken()): Promise<string> {
    this.refreshInFlight ??= this.refreshWithLock(staleToken).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async refreshWithLock(staleToken: string | null): Promise<string> {
    // A newer valid access token than the stale one means another tab already refreshed.
    const replacement = (): string | null => {
      const current = this.getAccessToken();
      return current && current !== staleToken && !isAccessTokenExpired(current) ? current : null;
    };
    const refresh = async (): Promise<string> => {
      const replaced = replacement();
      if (replaced) return replaced;

      // A refresh that never answers must not hold the lock of every tab nor the start-up.
      const response = await axios.post<{ accessToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        undefined,
        { withCredentials: true, headers: WEB_CLIENT_HEADERS, timeout: REQUEST_TIMEOUT_MS },
      );
      this.setAccessToken(response.data.accessToken);
      return response.data.accessToken;
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return refresh();

    // The wait for the lock is bounded too: another tab may be stuck holding it.
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await locks.request(REFRESH_LOCK, { signal: waiting.signal }, () => {
        clearTimeout(timer);
        return refresh();
      });
    } catch (error) {
      // The wait ran out: the tab that held the lock may have refreshed in the meantime, so its
      // token is used instead of failing a session that is fine.
      if (waiting.signal.aborted) {
        const replaced = replacement();
        if (replaced) return replaced;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Called when the app starts with a persisted user. If the access token is missing or
   * expired, a new one is requested with the refresh cookie before anything else runs.
   * `expired`: the API refused the cookie (401/403), so the session is over. `unavailable`: the
   * API could not be reached, failed or timed out; the session is kept and the next request
   * tries again.
   */
  public async restoreSession(): Promise<SessionRestoreResult> {
    if (typeof window === 'undefined') return 'unavailable';
    const token = this.getAccessToken();
    if (token && !isAccessTokenExpired(token)) return 'active';
    try {
      await this.refreshAccessToken(token);
      return 'active';
    } catch (error) {
      return refusesSession(error) ? 'expired' : 'unavailable';
    }
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
        message: messageFromBody(data.message, error.response.status),
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

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { message: TIMEOUT_ERROR_MESSAGE, code: 'TIMEOUT' };
    }

    if (error.request) {
      return { message: NETWORK_ERROR_MESSAGE, code: 'NETWORK_ERROR' };
    }

    // Axios' own texts ("canceled", "Network Error") are English and say nothing to the user.
    return { message: UNKNOWN_ERROR_MESSAGE, code: 'UNKNOWN_ERROR' };
  }

  // ==========================================
  // TOKEN MANAGEMENT
  // ==========================================

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /** The refresh token is not stored here: it only exists in the HttpOnly cookie. */
  public setAccessToken(accessToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    this.clearLegacyRefreshToken();
  }

  /** Erases the refresh token that versions before the cookie left in localStorage. */
  private clearLegacyRefreshToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH_TOKEN);
  }

  public clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    this.clearLegacyRefreshToken();
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
