import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import type { PlatformSummary as Summary } from '@/types';
import { PlatformSummary } from './platform-summary';

vi.mock('@/lib/api/endpoints', () => ({
  platformApi: { getSummary: vi.fn() },
}));

const summary: Summary = {
  tenants: { active: 7, suspended: 2 },
  subscriptions: { trialing: 3, active: 4, pastDue: 1, blocked: 2 },
  pendingPayments: { count: 5, amount: 250, currency: 'USD' },
  trialsEndingSoon: [{ id: 't-1', name: 'Clínica Sol', trialEndsAt: '2026-10-05T00:00:00.000Z' }],
  recentTenants: [
    { id: 't-2', name: 'Centro Luna', planName: 'Clínica Pro', createdAt: '2026-09-30T00:00:00.000Z' },
  ],
};

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlatformSummary />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PlatformSummary', () => {
  it('shows the four clinic counters and the pending payments with their amount', async () => {
    vi.mocked(platformApi.getSummary).mockResolvedValue(summary);
    renderSummary();
    const counter = async (label: string) =>
      (await screen.findByText(label)).closest('[data-testid]') as HTMLElement;

    expect(await counter('En prueba')).toHaveTextContent('3');
    expect(await counter('Al día')).toHaveTextContent('4');
    expect(await counter('Vencidos')).toHaveTextContent('1');
    expect(await counter('Bloqueados')).toHaveTextContent('2');
    const pending = await counter('Pagos pendientes');
    expect(pending).toHaveTextContent('5');
    expect(pending).toHaveTextContent(/250/);
    expect(pending).toHaveTextContent(/USD/);
    expect(screen.getByText('Clínica Sol')).toBeInTheDocument();
    expect(screen.getByText('Centro Luna')).toBeInTheDocument();
  });

  it('links the pending payments card to /platform/payments', async () => {
    vi.mocked(platformApi.getSummary).mockResolvedValue(summary);
    renderSummary();
    const link = await screen.findByRole('link', { name: /Pagos pendientes/ });
    expect(link).toHaveAttribute('href', '/platform/payments');
  });

  it('shows an empty state when there are no clinics', async () => {
    vi.mocked(platformApi.getSummary).mockResolvedValue({
      tenants: { active: 0, suspended: 0 },
      subscriptions: { trialing: 0, active: 0, pastDue: 0, blocked: 0 },
      pendingPayments: { count: 0, amount: 0, currency: 'USD' },
      trialsEndingSoon: [],
      recentTenants: [],
    });
    renderSummary();
    expect(await screen.findByText('Aún no hay consultorios registrados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo consultorio' })).toHaveAttribute(
      'href',
      '/platform/tenants/new',
    );
  });

  it('shows the error with a retry button when the request fails', async () => {
    vi.mocked(platformApi.getSummary).mockRejectedValueOnce(new Error('boom'));
    renderSummary();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el resumen');

    vi.mocked(platformApi.getSummary).mockResolvedValue(summary);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Centro Luna')).toBeInTheDocument());
    expect(platformApi.getSummary).toHaveBeenCalledTimes(2);
  });
});
