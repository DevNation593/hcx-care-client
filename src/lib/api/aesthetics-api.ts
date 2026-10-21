import { apiClient } from './client';
import type {
  AestheticBooking, AestheticClient, AestheticConsent, AestheticPhoto, AestheticService, AestheticSession,
} from '@/types/aesthetics';

const base = (tenantId: string) => `/tenants/${encodeURIComponent(tenantId)}/aesthetics`;
const session = (tenantId: string, sessionId: string) => `${base(tenantId)}/sessions/${encodeURIComponent(sessionId)}`;

export const aestheticsApi = {
  clients: (tenantId: string) => apiClient.get<AestheticClient[]>(`${base(tenantId)}/clients`),
  createClient: (tenantId: string, input: { firstName: string; lastName: string; email?: string; phone?: string }) =>
    apiClient.post<AestheticClient>(`${base(tenantId)}/clients`, input),
  updateClient: (tenantId: string, id: string, input: Partial<Pick<AestheticClient, 'firstName' | 'lastName' | 'email' | 'phone'>>) =>
    apiClient.patch<AestheticClient>(`${base(tenantId)}/clients/${encodeURIComponent(id)}`, input),
  services: (tenantId: string) => apiClient.get<AestheticService[]>(`${base(tenantId)}/services`),
  createService: (tenantId: string, input: { name: string; description?: string; durationMinutes: number; price: number; consentText?: string }) =>
    apiClient.post<AestheticService>(`${base(tenantId)}/services`, input),
  updateService: (tenantId: string, id: string, input: Partial<{ name: string; description: string; durationMinutes: number; price: number; consentText: string }>) =>
    apiClient.patch<AestheticService>(`${base(tenantId)}/services/${encodeURIComponent(id)}`, input),
  bookings: (tenantId: string) => apiClient.get<AestheticBooking[]>(`${base(tenantId)}/bookings`),
  createBooking: (tenantId: string, input: { clientId: string; serviceId: string; staffId: string; startAt: string }) =>
    apiClient.post<AestheticBooking>(`${base(tenantId)}/bookings`, input),
  updateBooking: (tenantId: string, id: string, input: Partial<{ startAt: string; staffId: string; status: AestheticBooking['status'] }>) =>
    apiClient.patch<AestheticBooking>(`${base(tenantId)}/bookings/${encodeURIComponent(id)}`, input),
  sessions: (tenantId: string) => apiClient.get<AestheticSession[]>(`${base(tenantId)}/sessions`),
  createSession: (tenantId: string, input: { clientId: string; serviceId: string; staffId: string; bookingId?: string; notes?: string }) =>
    apiClient.post<AestheticSession>(`${base(tenantId)}/sessions`, input),
  completeSession: (tenantId: string, id: string, notes?: string) =>
    apiClient.post<AestheticSession>(`${session(tenantId, id)}/complete`, { notes }),
  consents: (tenantId: string) => apiClient.get<AestheticConsent[]>(`${base(tenantId)}/consents`),
  recordConsent: (tenantId: string, sessionId: string, signerName: string, expectedConsentText: string) =>
    apiClient.post<AestheticConsent>(`${session(tenantId, sessionId)}/consent`, { signerName, expectedConsentText }),
  photos: (tenantId: string, sessionId: string) =>
    apiClient.get<AestheticPhoto[]>(`${session(tenantId, sessionId)}/photos`),
  uploadPhoto: (tenantId: string, sessionId: string, phase: AestheticPhoto['phase'], file: File) =>
    apiClient.upload<AestheticPhoto>(`${session(tenantId, sessionId)}/photos`, file, undefined, { phase }),
  downloadPhoto: (tenantId: string, sessionId: string, photoId: string) =>
    apiClient.get<Blob>(`${session(tenantId, sessionId)}/photos/${encodeURIComponent(photoId)}/download`, { responseType: 'blob' }),
  removePhoto: (tenantId: string, sessionId: string, photoId: string) =>
    apiClient.delete<{ deleted: boolean }>(`${session(tenantId, sessionId)}/photos/${encodeURIComponent(photoId)}`),
};
