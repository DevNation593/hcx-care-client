import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { treatmentSessionsApi } from '@/lib/api/endpoints';
import { useSessionCommand, usePatientTreatmentSessions } from './useTreatmentSessions';

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
  http.get.mockResolvedValue([]);
  http.post.mockResolvedValue({ id: 'session-1', patientId: 'patient-1' });
  http.put.mockResolvedValue({ id: 'session-1', patientId: 'patient-1' });
});

describe('useSessionCommand', () => {
  it('starts a session with POST and refreshes the session and the patient lists', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1' });
    client.setQueryData(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.APPOINTMENTS, []);
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.start.mutateAsync(); });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/treatment-sessions/session-1/start', {});
    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.APPOINTMENTS)?.isInvalidated).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('hands the missing requirements of a 422 to the caller without a generic toast', async () => {
    const blocked = {
      message: 'Faltan requisitos', status: 422, code: 'TREATMENT_REQUIREMENTS_MISSING',
      missing: ['FINALIZED_MEDICAL_FORM', 'BEFORE_PHOTOS'],
    };
    http.post.mockRejectedValue(blocked);
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => {
      await expect(result.current.start.mutateAsync()).rejects.toMatchObject({ missing: blocked.missing });
    });

    await waitFor(() => expect(result.current.start.error?.missing).toEqual(blocked.missing));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the message of any other error', async () => {
    http.post.mockRejectedValue({ message: 'La atención ya inició', status: 409, code: 'TREATMENT_SESSION_INVALID_TRANSITION' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.start.mutateAsync().catch(() => undefined); });

    expect(toast.error).toHaveBeenCalledWith('La atención ya inició');
  });

  it('saves the whole form answers with PUT', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.saveForm.mutateAsync({ pregnant: 'NO' }); });

    expect(http.put).toHaveBeenCalledWith('/tenants/tenant-1/treatment-sessions/session-1/form', { data: { pregnant: 'NO' } });
  });

  it('signs, refuses and revokes a consent document by its id', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });
    const signature = {
      signerRole: 'PATIENT' as const, signerName: 'Ana Pérez', understood: true,
      questionsAnswered: true, marketingPhotos: false, signature: 'data:image/png;base64,AAAA',
    };

    await act(async () => {
      await result.current.signConsent.mutateAsync({ documentId: 'doc-1', input: signature });
      await result.current.refuseConsent.mutateAsync({ documentId: 'doc-1', reason: 'Prefiere pensarlo' });
      await result.current.revokeConsent.mutateAsync({ documentId: 'doc-1', reason: 'Cambió de opinión' });
    });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/consent-documents/doc-1/sign', signature);
    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/consent-documents/doc-1/refuse', { reason: 'Prefiere pensarlo' });
    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/consent-documents/doc-1/revoke', { reason: 'Cambió de opinión' });
  });

  it('revoking a consent also refreshes the other sessions that reused it', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-2'), { id: 'session-2' });
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => {
      await result.current.revokeConsent.mutateAsync({ documentId: 'doc-1', reason: 'Cambió de opinión' });
    });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-2'))?.isInvalidated).toBe(true);
  });

  it('does not refresh other sessions after a command that cannot affect them', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-2'), { id: 'session-2' });
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.start.mutateAsync(); });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-2'))?.isInvalidated).toBe(false);
  });

  it('uploads a photo as multipart fields file, phase and description', async () => {
    http.upload.mockResolvedValue({ id: 'file-1', patientId: 'patient-1' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });
    const file = new File(['x'], 'antes.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.uploadMedia.mutateAsync({ file, phase: 'BEFORE', description: 'Frente' });
    });

    expect(http.upload).toHaveBeenCalledWith(
      '/tenants/tenant-1/treatment-sessions/session-1/media', file, undefined,
      { phase: 'BEFORE', description: 'Frente' },
    );
  });
});

describe('usePatientTreatmentSessions', () => {
  it('lists the sessions of the patient and waits for the patient id', async () => {
    const { wrapper } = setup();
    const idle = renderHook(() => usePatientTreatmentSessions(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => usePatientTreatmentSessions('patient-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/treatment-sessions');
  });
});

describe('treatmentSessionsApi', () => {
  beforeEach(() => {
    useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
  });

  it('downloads the consent PDF as a blob', async () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    http.get.mockResolvedValue(pdf);

    await expect(treatmentSessionsApi.consentPdf('doc-1')).resolves.toBe(pdf);

    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/consent-documents/doc-1/pdf', { responseType: 'blob' });
  });

  it('leaves the description out of the upload when there is none', async () => {
    const file = new File(['x'], 'despues.png', { type: 'image/png' });

    await treatmentSessionsApi.uploadMedia('session-1', file, 'AFTER');

    expect(http.upload).toHaveBeenCalledWith(
      '/tenants/tenant-1/treatment-sessions/session-1/media', file, undefined, { phase: 'AFTER' },
    );
  });
});
