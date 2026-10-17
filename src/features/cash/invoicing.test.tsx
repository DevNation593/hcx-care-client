import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';
import type { Order } from '@/types/cash';
import { InvoicingSettings } from '../billing/invoicing-settings';
import { InvoiceRequestPanel } from './invoice-request-panel';
import { InvoicesTab } from './invoices-tab';

const state = vi.hoisted(() => ({ view: true, create: true, known: true }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/hooks/usePermissions', () => ({
  useMyPermissions: () => ({
    can: (key: string, fallback: boolean) =>
      state.known ? (key === 'billing.view' ? state.view : state.create) : fallback,
  }),
}));
vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({ data: [{ id: 'b1', name: 'Principal', isActive: true }] }),
}));
const taxpayer = {
  id: 'tax1',
  legalName: 'Emisor real',
  ruc: '1234567890001',
  defaultEnvironment: '1',
  establishments: [
    { id: 'est1', code: '001', emissionPoints: [{ id: 'point1', code: '002', enabled: true }] },
  ],
};
const connection = {
  id: 'con1',
  taxpayerId: 'tax1',
  taxpayerName: 'Emisor real',
  environment: '1',
  hasApiKey: true,
  hasWebhookSecret: false,
  active: true,
  webhookUrl: null,
  points: [],
};
const receipt = (overrides = {}) => ({
  id: 'req1',
  orderId: 'o1',
  status: 'REQUESTED',
  requiresReconciliation: false,
  artifacts: { xml: false, ride: false },
  lastError: null,
  number: null,
  requestedAt: '2026-10-17T12:00:00Z',
  ...overrides,
});
const order = {
  id: 'o1',
  number: 1,
  status: 'PAID',
  total: '10.00',
  balance: '0.00',
  items: [],
  billingProfile: null,
} as unknown as Order;
const eligible = { eligible: true, missing: [], items: [] };
let latest = receipt();
let client: QueryClient;
function mount(ui: React.ReactNode, role = UserRole.MASTER) {
  useAuthStore.setState({ user: { id: 'me', role, tenantId: 't1' } as User, tenant: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.view = true;
  state.create = true;
  state.known = true;
  latest = receipt();
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url.endsWith('/invoicing/connection')) return null;
    if (url.endsWith('/invoicing/options')) return { taxpayers: [taxpayer] };
    if (url.endsWith('/invoice-requests/req1')) return latest;
    return { items: [], total: 0, page: 1, pageSize: 20 };
  });
  vi.mocked(apiClient.post).mockImplementation(async (url) =>
    url.endsWith('/invoicing/test') ? { taxpayers: [taxpayer] } : receipt(),
  );
  vi.mocked(apiClient.put).mockResolvedValue(connection);
});
afterEach(() => {
  client?.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('InvoicingSettings', () => {
  it('tests a blank unsaved key, saves the real issuer, then loads saved point choices', async () => {
    mount(<InvoicingSettings />);
    const key = await screen.findByLabelText('API key');
    expect(key).toHaveValue('');
    fireEvent.change(key, { target: { value: 'typed-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }));
    expect(await screen.findByText('Emisor real · 1234567890001')).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalledWith('/tenants/t1/invoicing/options');
    fireEvent.change(screen.getByLabelText('Emisor'), { target: { value: 'tax1' } });
    expect(screen.getByText('Pruebas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar conexión' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/tenants/t1/invoicing/connection', {
        taxpayerId: 'tax1',
        apiKey: 'typed-secret',
        active: true,
      }),
    );
    expect(
      await screen.findByText('Sin webhook: los estados se actualizan por consulta periódica.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('API key')).toHaveValue(''));
    fireEvent.change(await screen.findByLabelText('Establecimiento · Principal'), {
      target: { value: 'est1' },
    });
    fireEvent.change(screen.getByLabelText('Punto de emisión · Principal'), {
      target: { value: 'point1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto · Principal' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/tenants/t1/branches/b1/emission-point', {
        establishmentId: 'est1',
        emissionPointId: 'point1',
      }),
    );
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('typed-secret');
  });
  it('invalidates tested issuer choices when the key changes', async () => {
    mount(<InvoicingSettings />);
    fireEvent.change(await screen.findByLabelText('API key'), { target: { value: 'first-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }));
    await screen.findByText('Emisor real · 1234567890001');
    fireEvent.change(screen.getByLabelText('Emisor'), { target: { value: 'tax1' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-key' } });
    expect(screen.queryByText('Emisor real · 1234567890001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar conexión' })).toBeDisabled();
  });
  it('preserves omitted credentials and offers webhook copy', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/connection')
        ? { ...connection, hasWebhookSecret: true, webhookUrl: 'https://hcx.test/callback' }
        : { taxpayers: [taxpayer] },
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mount(<InvoicingSettings />);
    await screen.findByText('API key guardada');
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(screen.getByLabelText('Secreto webhook (opcional)')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar URL webhook' }));
    expect(writeText).toHaveBeenCalledWith('https://hcx.test/callback');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar conexión' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/tenants/t1/invoicing/connection', {
        taxpayerId: 'tax1',
        active: true,
      }),
    );
  });
  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL])(
    'never mounts MASTER queries for %s',
    (role) => {
      mount(<InvoicingSettings />, role);
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    },
  );
  it('shows a clear retry when the provider host is not configured', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ message: 'Configura EMITE_FACIL_API_URL' });
    mount(<InvoicingSettings />);
    expect(await screen.findByText('Configura EMITE_FACIL_API_URL')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });
});

describe('InvoiceRequestPanel', () => {
  it('disables emission until eligible and does not show optimistic authorization', async () => {
    const { rerender } = mount(
      <InvoiceRequestPanel
        order={order}
        eligibility={{ eligible: false, missing: ['BILLING_PROFILE'], items: [] }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Emitir factura' })).toBeDisabled();
    rerender(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    expect(await screen.findByText('Solicitada')).toBeInTheDocument();
    expect(screen.queryByText('Autorizada')).not.toBeInTheDocument();
  });
  it('keeps the same header after a lost response and failed background refetch', async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Sin conexión' })
      .mockResolvedValueOnce(receipt());
    const { rerender } = mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    await screen.findByText('Sin conexión');
    vi.mocked(apiClient.get).mockRejectedValue({ message: 'Refetch failed' });
    await client.invalidateQueries();
    rerender(
      <InvoiceRequestPanel
        order={{ ...order, status: 'INVOICED' }}
        eligibility={{ ...eligible, eligible: false }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar emisión' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(apiClient.post).mock.calls;
    expect(calls[0][2]?.headers?.['Idempotency-Key']).toBeTruthy();
    expect(calls[1][2]?.headers?.['Idempotency-Key']).toBe(
      calls[0][2]?.headers?.['Idempotency-Key'],
    );
    expect(screen.queryByText('Autorizada')).not.toBeInTheDocument();
  });
  it('stops retry controls when a lost response is resolved as authorized', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ code: 'NETWORK_ERROR', message: 'Sin conexión' });
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    await screen.findByText('Sin conexión');
    latest = receipt({ status: 'AUTHORIZED', artifacts: { xml: true, ride: true } });
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/req1') ? latest : { items: [latest], total: 1 },
    );
    await act(async () => {
      await client.invalidateQueries();
    });
    await screen.findByText('Autorizada');
    expect(screen.queryByRole('button', { name: 'Reintentar emisión' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver a emitir' })).not.toBeInTheDocument();
  });
  it('renders the runtime normalized 422 checklist inline', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      status: 422,
      message: 'Falta documentación',
      billingEligibility: {
        eligible: false,
        missing: ['BILLING_PROFILE', 'SIGNED_APPLICABLE_CONSENT'],
        items: [{ itemId: 'i1', patientName: 'Ana Paz', codes: ['SIGNED_APPLICABLE_CONSENT'] }],
      },
    });
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    expect(
      await screen.findByText('Falta el consentimiento firmado de Ana Paz'),
    ).toBeInTheDocument();
    expect(screen.getByText('Elige quién recibe la factura')).toBeInTheDocument();
  });
  it('polls every five seconds through uncertainty and pending artifacts, then stops', async () => {
    vi.useFakeTimers();
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' })));
    latest = receipt({ status: 'FAILED', requiresReconciliation: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText(/Conciliación pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver a emitir' })).not.toBeInTheDocument();
    latest = receipt({ status: 'AUTHORIZED', artifacts: { xml: true, ride: false } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole('button', { name: 'Descargar XML' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Descargar RIDE' })).toBeDisabled();
    latest = receipt({ status: 'AUTHORIZED', artifacts: { xml: true, ride: true } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole('button', { name: 'Descargar RIDE' })).toBeEnabled();
    const calls = vi.mocked(apiClient.get).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(apiClient.get).toHaveBeenCalledTimes(calls);
  });
  it('offers a fresh key only after a known safe rejection', async () => {
    latest = receipt({
      status: 'REJECTED',
      lastError: { message: 'Rechazo SRI real', code: 'SRI' },
    });
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    await screen.findByText('Rechazo SRI real');
    expect(screen.getByRole('button', { name: 'Volver a emitir' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a emitir' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(apiClient.post).mock.calls;
    expect(calls[1][2]?.headers?.['Idempotency-Key']).not.toBe(
      calls[0][2]?.headers?.['Idempotency-Key'],
    );
  });
  it('refreshes order, eligibility and sessions after the final detail arrives', async () => {
    let finish: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/req1') ? pending : { items: [receipt({ status: 'PROCESSING' })], total: 1 },
    );
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    await screen.findByText('En proceso');
    client.setQueryData(QUERY_KEYS.ORDER(order.id), order);
    client.setQueryData(QUERY_KEYS.ORDER_ELIGIBILITY(order.id), eligible);
    client.setQueryData(QUERY_KEYS.TREATMENT_SESSIONS, []);
    finish(receipt({ status: 'REJECTED' }));
    await screen.findByText('Rechazada');
    await waitFor(() =>
      expect(client.getQueryState(QUERY_KEYS.ORDER_ELIGIBILITY(order.id))?.isInvalidated).toBe(
        true,
      ),
    );
    expect(client.getQueryState(QUERY_KEYS.ORDER(order.id))?.isInvalidated).toBe(true);
    expect(client.getQueryState(QUERY_KEYS.TREATMENT_SESSIONS)?.isInvalidated).toBe(true);
  });
  it('does not request list/detail or protected explanations with create alone', async () => {
    state.view = false;
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />, UserRole.ASISTENTE);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir factura' }));
    await screen.findByText('Solicitada');
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.getByText(/billing.view/)).toBeInTheDocument();
  });
  it('keeps delegated invoice APIs closed while grants are unknown', () => {
    state.known = false;
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />, UserRole.ASISTENTE);
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Emitir factura' })).not.toBeInTheDocument();
  });
  it('shows the actual protected SRI explanation and identifiers', async () => {
    latest = receipt({
      status: 'REJECTED',
      lastError: {
        code: 'SRI_REJECTED',
        message: 'Rechazo fiscal real',
        attempts: [
          {
            id: 'a1',
            operation: 'RECEPTION',
            sriStatus: 'DEVUELTA',
            messages: [
              {
                identifier: '43',
                message: 'Identificación del comprador inválida',
                additionalInfo: 'Revisar identificación fiscal',
                type: 'ERROR',
              },
            ],
          },
        ],
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/req1') ? latest : { items: [latest], total: 1 },
    );
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />);
    expect(await screen.findByText('Rechazo fiscal real')).toBeInTheDocument();
    expect(screen.getByText('Recepción: DEVUELTA')).toBeInTheDocument();
    expect(
      screen.getByText(
        '43 · Identificación del comprador inválida · Revisar identificación fiscal · ERROR',
      ),
    ).toBeInTheDocument();
  });
  it('shows state without emission controls to a view-only user', async () => {
    state.create = false;
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/req1')
        ? receipt({ status: 'PROCESSING' })
        : { items: [receipt({ status: 'PROCESSING' })], total: 1 },
    );
    mount(<InvoiceRequestPanel order={order} eligibility={eligible} />, UserRole.PROFESIONAL);
    await screen.findByText('En proceso');
    expect(screen.queryByRole('button', { name: 'Emitir factura' })).not.toBeInTheDocument();
  });
});

describe('InvoicesTab', () => {
  it('filters and paginates on the server including patientId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [receipt()],
      total: 45,
      page: 1,
      pageSize: 20,
    });
    mount(<InvoicesTab branchId="b1" patientId="p1" />);
    await screen.findByText('Página 1 de 3');
    expect(apiClient.get).toHaveBeenCalledWith('/tenants/t1/invoice-requests', {
      params: { branchId: 'b1', patientId: 'p1', page: 1, pageSize: 20 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith('/tenants/t1/invoice-requests', {
        params: { branchId: 'b1', patientId: 'p1', page: 2, pageSize: 20 },
      }),
    );
    fireEvent.change(screen.getByLabelText('Estado de factura'), {
      target: { value: 'AUTHORIZED' },
    });
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith('/tenants/t1/invoice-requests', {
        params: { branchId: 'b1', patientId: 'p1', page: 1, pageSize: 20, status: 'AUTHORIZED' },
      }),
    );
  });
  it('uses authenticated Blob transport and revokes the temporary download URL', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url.endsWith('/xml')
        ? new Blob(['xml'])
        : {
            items: [receipt({ status: 'AUTHORIZED', artifacts: { xml: true, ride: false } })],
            total: 1,
          },
    );
    const create = vi.fn().mockReturnValue('blob:invoice');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mount(<InvoicesTab branchId="b1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar XML' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:invoice'));
    expect(apiClient.get).toHaveBeenCalledWith('/tenants/t1/invoice-requests/req1/xml', {
      responseType: 'blob',
    });
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
  it('does not query when billing.view is absent', () => {
    state.view = false;
    mount(<InvoicesTab branchId="b1" />);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
