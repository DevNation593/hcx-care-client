import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import type { DemoRequest } from '@/types';
import { DemoRequestsTable } from './demo-requests-table';

vi.mock('@/lib/api/endpoints', () => ({
  platformApi: { listDemoRequests: vi.fn(), updateDemoRequest: vi.fn() },
}));

const request = (overrides: Partial<DemoRequest> = {}): DemoRequest => ({
  id: 'dr-1',
  name: 'Ana Vega',
  clinic: 'Centro Vida',
  email: 'ana@example.com',
  phone: '+593 99 123 4567',
  teamSize: '2-5',
  message: 'Atendemos nutrición',
  status: 'NEW',
  privacyAcceptedAt: '2026-11-07T15:00:00.000Z',
  handledAt: null,
  createdAt: '2026-11-07T15:00:00.000Z',
  updatedAt: '2026-11-07T15:00:00.000Z',
  ...overrides,
});

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DemoRequestsTable />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DemoRequestsTable', () => {
  it('lists the new requests by default with their contact data', async () => {
    vi.mocked(platformApi.listDemoRequests).mockResolvedValue([request()]);
    renderTable();

    expect(await screen.findByText('Centro Vida')).toBeInTheDocument();
    expect(platformApi.listDemoRequests).toHaveBeenCalledWith('NEW');
    expect(screen.getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com');
    expect(screen.getByRole('link', { name: '+593 99 123 4567' })).toHaveAttribute('href', 'tel:+593991234567');
    expect(screen.getByText('Atendemos nutrición')).toBeInTheDocument();
  });

  it('marks a request as contacted', async () => {
    vi.mocked(platformApi.listDemoRequests).mockResolvedValue([request()]);
    vi.mocked(platformApi.updateDemoRequest).mockResolvedValue(request({ status: 'CONTACTED' }));
    renderTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar contactada' }));

    await waitFor(() => expect(platformApi.updateDemoRequest).toHaveBeenCalledWith('dr-1', 'CONTACTED'));
  });

  it('lists every status when the filter is cleared', async () => {
    vi.mocked(platformApi.listDemoRequests).mockResolvedValue([]);
    renderTable();
    expect(await screen.findByText('No hay solicitudes con este estado')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } });

    await waitFor(() => expect(platformApi.listDemoRequests).toHaveBeenLastCalledWith(undefined));
  });

  it('says so when a status change fails', async () => {
    vi.mocked(platformApi.listDemoRequests).mockResolvedValue([request()]);
    vi.mocked(platformApi.updateDemoRequest).mockRejectedValue({ message: 'boom' });
    renderTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

    expect(await screen.findByText('No se pudo actualizar la solicitud de Centro Vida')).toBeInTheDocument();
  });
});
