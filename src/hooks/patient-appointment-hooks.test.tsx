import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { usePatients, usePatient, useCreatePatient, useUpdatePatient } from './usePatients';
import { useAppointments, useCreateAppointment, useUpdateAppointment, useCancelAppointment } from './useAppointments';
import { toast } from 'sonner';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
function tenant(id: string | null) {
  useAuthStore.setState({ tenant: id ? { id } as ReturnType<typeof useAuthStore.getState>['tenant'] : null, user: null });
}
function seed(client: QueryClient) {
  const keys = [
    ['appointments', 'tenant', 'tenant-1', undefined],
    ['appointments', 'tenant', 'tenant-1', { patientId: 'patient-1' }],
    ['appointments', 'tenant', 'tenant-2', undefined],
    ['appointments', 'tenant', 'tenant-1', 'appointment-1'],
    ['appointments', 'tenant', 'tenant-2', 'appointment-1'],
    ['patient-team', 'tenant-1', 'patient-1'],
    ['patient-team', 'tenant-1', 'patient-2'],
    ['patient-team', 'tenant-2', 'patient-1'],
  ];
  keys.forEach((key) => client.setQueryData(key, { old: true }));
  return keys;
}
beforeEach(() => {
  vi.clearAllMocks();
  tenant('tenant-1');
  http.get.mockResolvedValue([]);
  http.post.mockResolvedValue({ id: 'appointment-1', patientId: 'patient-1' });
  http.patch.mockResolvedValue({ id: 'appointment-1', patientId: 'patient-2' });
  http.delete.mockResolvedValue(undefined);
});

describe('tenant-scoped existing hooks', () => {
  it('rekeys patient and appointment reads when tenant changes', async () => {
    const { client, wrapper } = setup();
    const patients = renderHook(() => usePatients(), { wrapper });
    const patient = renderHook(() => usePatient('patient-1'), { wrapper });
    const appointments = renderHook(() => useAppointments(), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(3));
    act(() => tenant('tenant-2'));
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(6));
    expect(client.getQueryState(['patients', 'tenant', 'tenant-1', undefined])).toBeDefined();
    expect(client.getQueryState(['patients', 'tenant', 'tenant-2', undefined])).toBeDefined();
    expect(client.getQueryState(['patients', 'tenant', 'tenant-1', 'patient-1'])).toBeDefined();
    expect(client.getQueryState(['appointments', 'tenant', 'tenant-2', undefined])).toBeDefined();
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-2/patients', { params: undefined });
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-2/appointments', { params: undefined });
    patients.unmount(); patient.unmount(); appointments.unmount();
  });

  it('disables reads without tenant and fails writes before transport', async () => {
    tenant(null);
    const { wrapper } = setup();
    const patients = renderHook(() => usePatients(), { wrapper });
    const appointments = renderHook(() => useAppointments(), { wrapper });
    const create = renderHook(() => useCreatePatient(), { wrapper });
    expect(patients.result.current.fetchStatus).toBe('idle');
    expect(appointments.result.current.fetchStatus).toBe('idle');
    await act(async () => { await expect(create.result.current.mutateAsync({ firstName: 'Ana', lastName: 'Paz' })).rejects.toThrow('No tenant'); });
    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('updates the patient captured at invocation after a hook ID change', async () => {
    const { client, wrapper } = setup();
    const first = ['patients', 'tenant', 'tenant-1', 'patient-1'];
    const second = ['patients', 'tenant', 'tenant-1', 'patient-2'];
    client.setQueryData(first, { firstName: 'Ana' });
    client.setQueryData(second, { firstName: 'Noa' });
    const hook = renderHook(({ id }) => useUpdatePatient(id), {
      wrapper, initialProps: { id: 'patient-1' },
    });
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.mutateAsync({ firstName: 'Eva' }); });
    hook.rerender({ id: 'patient-2' });
    await act(async () => { await pending; });
    expect(http.patch).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1', { firstName: 'Eva' });
    expect(client.getQueryState(first)?.isInvalidated).toBe(true);
    expect(client.getQueryState(second)?.isInvalidated).toBe(false);
  });

  it('create invalidates only tenant appointment lists and its patient team', async () => {
    const { client, wrapper } = setup();
    const keys = seed(client);
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ patientId: 'patient-1', professionalId: 'pro-1', specialtyId: 'nutrition', title: 'Consulta', startTime: '2026-10-01T10:00', duration: 60, isOnline: false }); });
    await waitFor(() => expect(result.current.variables).toMatchObject({ patientId: 'patient-1', professionalId: 'pro-1' }));
    for (const index of [0, 1, 5]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(true);
    for (const index of [2, 3, 4, 6, 7]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(false);
  });

  it('shows the API rejection message as mutation feedback', async () => {
    http.post.mockRejectedValue({
      code: 'APPOINTMENT_CONFLICT',
      status: 409,
      message: 'Este horario tiene conflicto con cita(s) existente(s)',
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        patientId: 'patient-1',
        professionalId: 'pro-1',
        specialtyId: 'nutrition',
        title: 'Consulta',
        startTime: '2026-10-01T10:00',
        duration: 60,
        isOnline: false,
      })).rejects.toMatchObject({ code: 'APPOINTMENT_CONFLICT' });
    });

    expect(toast.error).toHaveBeenCalledWith('Este horario tiene conflicto con cita(s) existente(s)');
  });

  it('finishes an in-flight create in the tenant where it started after a tenant switch', async () => {
    const { client, wrapper } = setup();
    const keys = seed(client);
    let resolve!: (value: object) => void;
    http.post.mockImplementation(() => new Promise<object>((done) => { resolve = done; }));
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });
    const input = { patientId: 'patient-1', professionalId: 'pro-1', specialtyId: 'nutrition',
      title: 'Consulta', startTime: '2026-10-01T10:00', duration: 60, isOnline: false };
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.mutateAsync(input); });
    act(() => tenant('tenant-2'));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/appointments', input));
    await act(async () => { resolve({ id: 'appointment-1', patientId: 'patient-1' }); await pending; });
    expect(client.getQueryState(keys[0])?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys[5])?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys[2])?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys[7])?.isInvalidated).toBe(false);
  });

  it('reassign invalidates old and new patient teams plus scoped appointment detail', async () => {
    const { client, wrapper } = setup();
    const keys = seed(client);
    const { result } = renderHook(() => useUpdateAppointment('appointment-1'), { wrapper });
    await act(async () => { await result.current.mutateAsync({ patientId: 'patient-2', previousPatientId: 'patient-1', professionalId: 'pro-2', specialtyId: 'nutrition' }); });
    for (const index of [0, 1, 3, 5, 6]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(true);
    for (const index of [2, 4, 7]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(false);
    expect(http.patch).toHaveBeenCalledWith('/tenants/tenant-1/appointments/appointment-1', { patientId: 'patient-2', professionalId: 'pro-2', specialtyId: 'nutrition' });
  });

  it('updates the invocation appointment after its hook ID and tenant change', async () => {
    const { client, wrapper } = setup();
    const keys = seed(client);
    const otherDetail = ['appointments', 'tenant', 'tenant-1', 'appointment-2'];
    client.setQueryData(otherDetail, { old: true });
    let resolve!: (value: object) => void;
    http.patch.mockImplementation(() => new Promise<object>((done) => { resolve = done; }));
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    const hook = renderHook(({ id }) => useUpdateAppointment(id), {
      wrapper, initialProps: { id: 'appointment-1' },
    });
    const update = { patientId: 'patient-2', previousPatientId: 'patient-1', title: 'Reasignada' };
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.mutateAsync(update, { onSuccess, onSettled }); });
    hook.rerender({ id: 'appointment-2' });
    act(() => tenant('tenant-2'));
    await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/tenants/tenant-1/appointments/appointment-1', {
      patientId: 'patient-2', title: 'Reasignada',
    }));
    await act(async () => { resolve({ id: 'appointment-1', patientId: 'patient-2' }); await pending; });
    for (const index of [0, 3, 5, 6]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(true);
    for (const index of [2, 4, 7]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(false);
    expect(client.getQueryState(otherDetail)?.isInvalidated).toBe(false);
    expect(hook.result.current.variables).toEqual(update);
    expect(onSuccess.mock.calls[0][1]).toEqual(update);
    expect(onSettled.mock.calls[0][2]).toEqual(update);
  });

  it('cancel uses patientId in variables and invalidates its exact team and appointment detail', async () => {
    const { client, wrapper } = setup();
    const keys = seed(client);
    const { result } = renderHook(() => useCancelAppointment(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: 'appointment-1', patientId: 'patient-1', reason: 'Reprogramar' }); });
    for (const index of [0, 1, 3, 5]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(true);
    for (const index of [2, 4, 6, 7]) expect(client.getQueryState(keys[index])?.isInvalidated).toBe(false);
    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/appointments/appointment-1/cancel', { reason: 'Reprogramar' });
  });
});
