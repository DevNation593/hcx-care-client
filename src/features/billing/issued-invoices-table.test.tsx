import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';
import type { InvoiceRequest } from '@/types/invoicing';
import { IssuedInvoicesTable, formatIssueDate } from './issued-invoices-table';

const api = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), view: true }));
vi.mock('@/lib/api/invoicing-api', () => ({
  invoicingApi: { list: api.list, download: api.download },
}));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: () => api.view }) }));

const invoice = (overrides: Partial<InvoiceRequest> = {}): InvoiceRequest =>
  ({
    id: 'req-1',
    orderId: 'order-1',
    orderNumber: 12,
    branchId: 'branch-1',
    billingProfileId: 'profile-1',
    status: 'AUTHORIZED',
    number: '001-001-000000123',
    sequential: '000000123',
    accessKey: '2011202601179001234500110010010000001231234567813',
    artifacts: { xml: true, ride: true },
    lastError: null,
    requestedAt: '2026-11-20T15:00:00.000Z',
    issueDate: '2026-11-20',
    customerName: 'Rosa Mora',
    ...overrides,
  }) as InvoiceRequest;

const page = (items: InvoiceRequest[], total = items.length) => ({
  items,
  total,
  page: 1,
  pageSize: 20,
});

function renderTable(props: { branchId?: string } = {}) {
  useAuthStore.setState({
    user: { id: 'user-1', role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IssuedInvoicesTable {...props} />
    </QueryClientProvider>,
  );
}

const lastFilters = () => api.list.mock.calls.at(-1)![1];
const rowOf = (text: string) => screen.getByText(text).closest('tr')!;

beforeEach(() => {
  vi.clearAllMocks();
  api.view = true;
  api.list.mockResolvedValue(page([invoice()]));
  api.download.mockResolvedValue(undefined);
});

describe('formatIssueDate', () => {
  it('reorders the Ecuador calendar date without a timezone shift', () => {
    expect(formatIssueDate('2026-11-20')).toBe('20/11/2026');
    expect(formatIssueDate(null)).toBe('—');
    expect(formatIssueDate('not a date')).toBe('—');
  });
});

describe('IssuedInvoicesTable', () => {
  it('shows number, issue date and customer first, as a semantic table', async () => {
    renderTable();
    const table = await screen.findByRole('table', { name: 'Facturas emitidas' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.slice(0, 3).map((h) => h.textContent)).toEqual([
      'Número de factura',
      'Fecha de emisión',
      'Cliente',
    ]);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    const cells = within(rowOf('001-001-000000123')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('001-001-000000123');
    expect(cells[1]).toHaveTextContent('20/11/2026');
    expect(cells[2]).toHaveTextContent('Rosa Mora');
    expect(cells[3]).toHaveTextContent('Autorizada');
  });

  it('wraps a very long customer name inside its cell instead of widening the page', async () => {
    const name = 'Corporación '.repeat(20) + 'X'.repeat(80);
    api.list.mockResolvedValue(page([invoice({ customerName: name })]));
    renderTable();
    const cell = (await screen.findByText(name.trim())).closest('td')!;
    expect(cell.className).toContain('break-words');
    expect(cell.className).toContain('max-w-xs');
  });

  it('marks an invoice without number, date or customer yet', async () => {
    api.list.mockResolvedValue(
      page([invoice({ number: null, issueDate: null, customerName: null, status: 'REQUESTED' })]),
    );
    renderTable();
    expect(await screen.findByText('Sin número aún')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acciones de la factura de la orden 12/ })).toBeVisible();
  });

  it('says when there are no invoices, while loading and when loading fails', async () => {
    api.list.mockResolvedValue(page([]));
    renderTable();
    expect(screen.getByRole('status', { name: 'Cargando facturas' })).toBeInTheDocument();
    expect(await screen.findByText('Aún no hay facturas emitidas.')).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    api.list.mockRejectedValueOnce(new Error('boom'));
    renderTable();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar facturas' }));
    expect(await screen.findByText('001-001-000000123')).toBeInTheDocument();
  });

  it('does not query without billing.view', () => {
    api.view = false;
    renderTable();
    expect(screen.getByText('No tienes permiso para consultar facturas.')).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('pages on the server and keeps the branch filter', async () => {
    api.list.mockResolvedValue(page([invoice()], 45));
    renderTable({ branchId: 'branch-9' });
    await screen.findByText('Página 1 de 3');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ page: 2, pageSize: 20, branchId: 'branch-9' }),
    );
  });
});

describe('search by invoice number', () => {
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText('Buscar por número de factura'), { target: { value } });

  it.each(['001-001-000000123', '001-001', '123'])(
    'sends %s to the server once typing pauses',
    async (term) => {
      renderTable();
      await screen.findByText('Rosa Mora');
      api.list.mockClear();
      type(term);
      expect(api.list).not.toHaveBeenCalled();
      await waitFor(() => expect(lastFilters()).toMatchObject({ q: term, page: 1 }), {
        timeout: 2000,
      });
    },
  );

  it('trims the term, goes back to page 1 and clears with one button', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    type('  123 ');
    await waitFor(() => expect(lastFilters()).toMatchObject({ q: '123' }), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByLabelText('Buscar por número de factura')).toHaveValue('');
    await waitFor(() => expect(lastFilters()).not.toHaveProperty('q'));
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).not.toBeInTheDocument();
  });

  it('answers a search without results with a clear message', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    api.list.mockResolvedValue(page([]));
    type('987');
    expect(
      await screen.findByText('No se encontraron facturas con el número «987».', undefined, {
        timeout: 2000,
      }),
    ).toBeInTheDocument();
  });

  it('never sends text that is not a number, and says what is accepted', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    api.list.mockClear();
    type("1' OR '1'='1");
    expect(
      await screen.findByText('Escribe solo dígitos y guiones, por ejemplo 123 o 001-001.', undefined, {
        timeout: 2000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar por número de factura')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(api.list).not.toHaveBeenCalled();
  });
});

describe('download menu', () => {
  const rightClick = (row: HTMLElement, clientX = 120, clientY = 80) =>
    fireEvent.contextMenu(row, { clientX, clientY });

  it('opens on right click with both downloads and downloads the chosen file', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    rightClick(rowOf('Rosa Mora'));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Descargar XML',
      'Descargar RIDE',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'Descargar XML' })).toHaveFocus();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Descargar RIDE' }));
    await waitFor(() =>
      expect(api.download).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ id: 'req-1', number: '001-001-000000123' }),
        'ride',
      ),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Descarga del RIDE');
  });

  it('is reachable without a right click: the row button opens the same menu from the keyboard', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    const button = screen.getByRole('button', {
      name: 'Acciones de la factura 001-001-000000123',
    });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const [xml, ride] = screen.getAllByRole('menuitem');
    expect(xml).toHaveFocus();
    fireEvent.keyDown(xml, { key: 'ArrowDown' });
    expect(ride).toHaveFocus();
    fireEvent.keyDown(ride, { key: 'ArrowDown' });
    expect(xml).toHaveFocus();
    fireEvent.keyDown(xml, { key: 'End' });
    expect(ride).toHaveFocus();
    fireEvent.keyDown(ride, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    // The button toggles it.
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a click outside', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    rightClick(rowOf('Rosa Mora'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stays inside the viewport when the click lands near the edge', async () => {
    renderTable();
    await screen.findByText('Rosa Mora');
    rightClick(rowOf('Rosa Mora'), 99999, 99999);
    const menu = screen.getByRole('menu');
    expect(parseInt(menu.style.left, 10)).toBeLessThanOrEqual(window.innerWidth);
    expect(parseInt(menu.style.top, 10)).toBeLessThanOrEqual(window.innerHeight);
  });

  it('keeps an unavailable file focusable but inert, and says why', async () => {
    api.list.mockResolvedValue(
      page([invoice({ status: 'AUTHORIZED', artifacts: { xml: true, ride: false } })]),
    );
    renderTable();
    await screen.findByText('Rosa Mora');
    rightClick(rowOf('Rosa Mora'));
    const ride = screen.getByRole('menuitem', { name: /Descargar RIDE/ });
    expect(ride).toHaveAttribute('aria-disabled', 'true');
    expect(ride).toHaveTextContent('Se está preparando');
    fireEvent.click(ride);
    expect(api.download).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Descargar XML' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it.each([
    ['PROCESSING', 'Disponible cuando el SRI autorice la factura.'],
    ['REJECTED', 'No disponible: la factura no fue autorizada.'],
  ] as const)('explains a %s invoice has no files', async (status, reason) => {
    api.list.mockResolvedValue(
      page([invoice({ status, artifacts: { xml: false, ride: false } })]),
    );
    renderTable();
    await screen.findByText('Rosa Mora');
    rightClick(rowOf('Rosa Mora'));
    screen.getAllByRole('menuitem').forEach((item) => {
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent(reason);
    });
  });

  it('shows the server message when a download fails and refreshes the list', async () => {
    api.download.mockRejectedValue({
      message: 'El archivo todavía no está disponible. Su descarga se volverá a intentar automáticamente.',
    });
    renderTable();
    await screen.findByText('Rosa Mora');
    api.list.mockClear();
    rightClick(rowOf('Rosa Mora'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Descargar XML' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo todavía no está disponible');
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
