import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { treatmentSessionsApi } from '@/lib/api/endpoints';
import {
  useCreateTreatmentSessions,
  useEncounterNoShow,
  useSaveProcedureNotes,
  useSessionCommand,
  usePatientTreatmentSessions,
} from './useTreatmentSessions';

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

  it('refreshes the session after a 409 so stale commands go away', async () => {
    http.post.mockRejectedValue({ message: 'La atención cambió', status: 409, code: 'TREATMENT_SESSION_INVALID_TRANSITION' });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1' });
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.start.mutateAsync().catch(() => undefined); });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(true);
  });

  it('leaves the session alone after an error that is not a conflict', async () => {
    http.post.mockRejectedValue({ message: 'Error del servidor', status: 500 });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1' });
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.start.mutateAsync().catch(() => undefined); });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(false);
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

describe('useCreateTreatmentSessions', () => {
  it('sends treatmentIds, caches every session and refreshes the lists', async () => {
    http.post.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.APPOINTMENTS, []);
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1', 't-2'] }); });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/treatment-sessions', {
      treatmentIds: ['t-1', 't-2'],
    });
    // Several sessions: each one's list of siblings would be stale, so none is seeded.
    expect(client.getQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'))).toBeUndefined();
    expect(client.getQueryData(QUERY_KEYS.TREATMENT_SESSION('session-2'))).toBeUndefined();
    expect(client.getQueryState(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.APPOINTMENTS)?.isInvalidated).toBe(true);
  });

  it('seeds the cache with the session when exactly one was created', async () => {
    http.post.mockResolvedValue([{ id: 'session-1' }]);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1'] }); });

    expect(client.getQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'))).toEqual({ id: 'session-1' });
  });

  it('refreshes the visited sessions of the encounter a treatment is added to, and no others', async () => {
    http.post.mockResolvedValue([{ id: 'session-2' }, { id: 'session-3' }]);
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-a'), { id: 'session-a', encounterId: 'enc-1' });
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-b'), { id: 'session-b', encounterId: 'enc-2' });
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1', 't-2'], encounterId: 'enc-1' }); });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-a'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-b'))?.isInvalidated).toBe(false);
  });

  it('says a treatment was added when the encounter id is sent, and that an encounter began otherwise', async () => {
    http.post.mockResolvedValue([{ id: 'session-1' }]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1'], encounterId: 'enc-1' }); });
    expect(toast.success).toHaveBeenLastCalledWith('Tratamiento añadido');

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1'] }); });
    expect(toast.success).toHaveBeenLastCalledWith('Atención iniciada');
  });

  it('reads the encounters and sessions again after a 409', async () => {
    http.post.mockRejectedValue({ status: 409, code: 'ENCOUNTER_NOT_OPEN', message: 'La atención ya no está abierta' });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'), []);
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1'] }).catch(() => undefined); });

    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'))?.isInvalidated).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('La atención ya no está abierta');
  });

  it('shows no error toast when an encounter is already open, and refreshes it', async () => {
    http.post.mockRejectedValue({ status: 409, code: 'ENCOUNTER_ALREADY_OPEN', message: 'Ya hay una atención abierta' });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    const { result } = renderHook(() => useCreateTreatmentSessions('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync({ treatmentIds: ['t-1'] }).catch(() => undefined); });

    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('encounter commands', () => {
  it('completes a session with the close request of the encounter', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => {
      await result.current.complete.mutateAsync({ procedureNotes: 'Notas', closeEncounter: true, password: 'pw' });
    });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/treatment-sessions/session-1/complete', {
      procedureNotes: 'Notas', closeEncounter: true, password: 'pw',
    });
  });

  it('keeps no copy of the signing password in the mutation cache once the command settles', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => {
      await result.current.complete.mutateAsync({ closeEncounter: true, password: 'pw' });
    });
    act(() => result.current.complete.reset());

    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('says the treatment was completed, and the encounter closed when it was', async () => {
    http.post.mockResolvedValue({ id: 'session-1', patientId: 'patient-1' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.complete.mutateAsync({ procedureNotes: 'Notas' }); });
    expect(toast.success).toHaveBeenLastCalledWith('Tratamiento completado');

    await act(async () => { await result.current.complete.mutateAsync({ closeEncounter: true, password: 'pw' }); });
    expect(toast.success).toHaveBeenLastCalledWith('Tratamiento completado y atención cerrada');
  });

  it('says the treatment was cancelled', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.cancel.mutateAsync('Motivo válido'); });

    expect(toast.success).toHaveBeenLastCalledWith('Tratamiento cancelado');
  });

  it('refreshes what closing signs when completing also closes the encounter', async () => {
    http.post.mockResolvedValue({ id: 'session-1', patientId: 'patient-1' });
    const { client, wrapper } = setup();
    const keys = [
      QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'),
      QUERY_KEYS.PATIENT_SPECIALTY_RECORDS('patient-1'),
      QUERY_KEYS.PATIENT_CLINICAL_ALERTS('patient-1'),
      QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS('patient-1'),
    ];
    keys.forEach((key) => client.setQueryData(key, []));
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => { await result.current.complete.mutateAsync({ procedureNotes: 'Notas' }); });
    expect(client.getQueryState(QUERY_KEYS.PATIENT_SPECIALTY_RECORDS('patient-1'))?.isInvalidated).toBe(false);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS('patient-1'))?.isInvalidated).toBe(false);

    await act(async () => { await result.current.complete.mutateAsync({ closeEncounter: true, password: 'pw' }); });
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('refreshes the session when closing the encounter finds an unfinished treatment', async () => {
    http.post.mockRejectedValue({
      message: 'Quedan tratamientos sin terminar',
      status: 409,
      code: 'ENCOUNTER_HAS_UNFINISHED_TREATMENTS',
    });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1' });
    const { result } = renderHook(() => useSessionCommand('session-1'), { wrapper });

    await act(async () => {
      await result.current.complete
        .mutateAsync({ closeEncounter: true, password: 'pw' })
        .catch(() => undefined);
    });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Quedan tratamientos sin terminar');
  });

  it('records the no-show of an encounter and refreshes encounters, sessions and appointments', async () => {
    http.post.mockResolvedValue([{ id: 'session-1' }]);
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'), []);
    client.setQueryData(QUERY_KEYS.APPOINTMENTS, []);
    const { result } = renderHook(() => useEncounterNoShow('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('enc-1'); });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/encounters/enc-1/no-show', {});
    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.APPOINTMENTS)?.isInvalidated).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Inasistencia registrada');
  });

  it('refreshes the details of the sessions the no-show ended, and no others', async () => {
    http.post.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1' });
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-9'), { id: 'session-9' });
    const { result } = renderHook(() => useEncounterNoShow('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('enc-1'); });

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-9'))?.isInvalidated).toBe(false);
  });

  it('reads the encounters again when the no-show is refused with a 409', async () => {
    http.post.mockRejectedValue({ message: 'Hay actividad', status: 409, code: 'ENCOUNTER_HAS_ACTIVITY' });
    const { client, wrapper } = setup();
    client.setQueryData(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'), []);
    const { result } = renderHook(() => useEncounterNoShow('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('enc-1').catch(() => undefined); });

    expect(client.getQueryState(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'))?.isInvalidated).toBe(true);
  });

  it('shows the message of a failed no-show', async () => {
    http.post.mockRejectedValue({ message: 'Hay actividad', status: 409, code: 'ENCOUNTER_HAS_ACTIVITY' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useEncounterNoShow('patient-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('enc-1').catch(() => undefined); });

    expect(toast.error).toHaveBeenCalledWith('Hay actividad');
  });
});

describe('useSaveProcedureNotes', () => {
  const key = QUERY_KEYS.TREATMENT_SESSION('session-1');

  it('saves with PUT and keeps the answer when it is newer than the cached session', async () => {
    http.put.mockResolvedValue({ id: 'session-1', version: 3, procedureNotes: 'Borrador' });
    const { client, wrapper } = setup();
    client.setQueryData(key, { id: 'session-1', version: 2, procedureNotes: null });
    client.setQueryData(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'), []);
    const { result } = renderHook(() => useSaveProcedureNotes('session-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('Borrador'); });

    expect(http.put).toHaveBeenCalledWith('/tenants/tenant-1/treatment-sessions/session-1/notes', {
      procedureNotes: 'Borrador',
    });
    expect(client.getQueryData(key)).toMatchObject({ version: 3, procedureNotes: 'Borrador' });
    expect(client.getQueryState(QUERY_KEYS.PATIENT_TREATMENT_SESSIONS('patient-1'))?.isInvalidated).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('never puts back an answer older than the cached session, which a close already moved on', async () => {
    http.put.mockResolvedValue({ id: 'session-1', version: 3, status: 'IN_PROGRESS' });
    const { client, wrapper } = setup();
    client.setQueryData(key, { id: 'session-1', version: 4, status: 'CLINICAL_COMPLETE' });
    const { result } = renderHook(() => useSaveProcedureNotes('session-1'), { wrapper });

    await act(async () => { await result.current.mutateAsync('Borrador'); });

    expect(client.getQueryData(key)).toMatchObject({ version: 4, status: 'CLINICAL_COMPLETE' });
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
