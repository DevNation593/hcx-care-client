import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useCloseEncounter, useStartEncounter } from './useEncounters';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const keys = () => invalidated.mock.calls.map(([filters]) => filters?.queryKey);
  return { wrapper, keys };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as never, user: { id: 'me', tenantId: 'tenant-1' } as never });
  http.post.mockResolvedValue({ id: 'encounter-1', status: 'CLOSED' });
});

describe('encounter mutations', () => {
  it('reloads the records of the patient when closing signs them, so they show as signed', async () => {
    const { wrapper, keys } = setup();
    const close = renderHook(() => useCloseEncounter('patient-1'), { wrapper });

    await act(() => close.result.current.mutateAsync({ encounterId: 'encounter-1', password: 'clave' }));

    expect(keys()).toEqual(
      expect.arrayContaining([
        QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'),
        QUERY_KEYS.PATIENT_SPECIALTY_RECORDS('patient-1'),
        QUERY_KEYS.PATIENT_CLINICAL_ALERTS('patient-1'),
        QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS('patient-1'),
      ]),
    );
  });

  it('refreshes the visited treatment sessions of the encounter it closes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-1'), { id: 'session-1', encounterId: 'encounter-1' });
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSION('session-2'), { id: 'session-2', encounterId: 'encounter-2' });
    const close = renderHook(() => useCloseEncounter('patient-1'), { wrapper });

    await act(() => close.result.current.mutateAsync({ encounterId: 'encounter-1', password: 'clave' }));

    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSION('session-2'))?.isInvalidated).toBe(false);
  });

  it('reads the encounters again after a 409 when closing', async () => {
    http.post.mockRejectedValue({ status: 409, message: 'La atención ya está cerrada' });
    const { wrapper, keys } = setup();
    const close = renderHook(() => useCloseEncounter('patient-1'), { wrapper });

    await act(async () => {
      await close.result.current.mutateAsync({ encounterId: 'encounter-1', password: 'clave' }).catch(() => undefined);
    });

    expect(keys()).toContainEqual(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'));
    expect(toast.error).toHaveBeenCalledWith('La atención ya está cerrada');
  });

  it('leaves the encounters alone after an error that is not a conflict', async () => {
    http.post.mockRejectedValue({ status: 500, message: 'Error' });
    const { wrapper, keys } = setup();
    const close = renderHook(() => useCloseEncounter('patient-1'), { wrapper });

    await act(async () => {
      await close.result.current.mutateAsync({ encounterId: 'encounter-1', password: 'clave' }).catch(() => undefined);
    });

    expect(keys()).toEqual([]);
  });

  it('leaves the records alone when an encounter starts', async () => {
    const { wrapper, keys } = setup();
    const start = renderHook(() => useStartEncounter('patient-1'), { wrapper });

    await act(() => start.result.current.mutateAsync({ encounterType: 'CONTROL', reason: 'Control' }));

    expect(keys()).toContainEqual(QUERY_KEYS.PATIENT_ENCOUNTERS('patient-1'));
    expect(keys()).not.toContainEqual(QUERY_KEYS.PATIENT_SPECIALTY_RECORDS('patient-1'));
  });
});
