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
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar las facturas.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Aún no hay facturas emitidas.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    api.list.mockClear();
    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar facturas' }));
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('001-001-000000123')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('when a refresh fails after the list had loaded', () => {
    const loadThenFailRefresh = async () => {
      const view = renderTable();
      await screen.findByText('Rosa Mora');
      api.list.mockRejectedValue(new Error('boom'));
      // A failed download makes the component refetch the list on its own; that refetch fails.
      api.download.mockRejectedValue({ message: 'Archivo no disponible.' });
      fireEvent.click(screen.getByRole('button', { name: /Acciones de la factura/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Descargar XML' }));
      await screen.findByText(/No se pudieron actualizar las facturas/);
      return view;
    };

    it('keeps the cached rows and warns they may be outdated', async () => {
      await loadThenFailRefresh();
      expect(screen.getByRole('table', { name: 'Facturas emitidas' })).toBeInTheDocument();
      expect(rowOf('Rosa Mora')).toHaveTextContent('Autorizada');
      const warning = screen
        .getAllByRole('alert')
        .find((el) => /No se pudieron actualizar las facturas/.test(el.textContent ?? ''))!;
      expect(warning).toHaveTextContent('Los datos mostrados pueden estar desactualizados.');
      expect(within(warning).getByRole('button', { name: 'Reintentar facturas' })).toBeVisible();
      expect(screen.queryByText('No se pudieron cargar las facturas.')).not.toBeInTheDocument();
    });

    it('retries the refresh and clears the warning once it succeeds', async () => {
      await loadThenFailRefresh();
      api.list.mockClear();
      api.list.mockResolvedValue(page([invoice({ customerName: 'Rosa Mora Actualizada' })]));
      const warning = screen
        .getAllByRole('alert')
        .find((el) => /No se pudieron actualizar las facturas/.test(el.textContent ?? ''))!;
      fireEvent.click(within(warning).getByRole('button', { name: 'Reintentar facturas' }));
      expect(api.list).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Rosa Mora Actualizada')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText(/No se pudieron actualizar las facturas/)).not.toBeInTheDocument(),
      );
    });
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

describe('rejection detail', () => {
  const rejected = (overrides: Partial<InvoiceRequest> = {}) =>
    invoice({
      id: 'req-rej',
      status: 'REJECTED',
      artifacts: { xml: false, ride: false },
      lastError: {
        code: 'SRI_REJECTED',
        message: 'El SRI rechazó la factura.',
        messages: [
          {
            identifier: '35',
            message: 'ERROR SECUENCIAL REGISTRADO',
            additionalInfo: 'Secuencial 000000123 ya existe',
            type: 'ERROR',
          },
          { identifier: null, message: 'Segundo aviso', additionalInfo: null, type: null },
        ],
      },
      ...overrides,
    });
  const toggle = (name: RegExp) => screen.getByRole('button', { name });

  it('keeps the reason closed, opens it with the button and hides it again', async () => {
    api.list.mockResolvedValue(page([rejected()]));
    renderTable();
    await screen.findByText('Rosa Mora');
    const button = toggle(/Ver motivo del rechazo de la factura 001-001-000000123/);
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveTextContent('Ver motivo');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // Nothing to control while the panel is not in the page.
    expect(button).not.toHaveAttribute('aria-controls');
    expect(screen.queryByText('El SRI rechazó la factura.')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    // A native button is activated by Enter/Space, which the browser turns into this click.
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);

    const open = toggle(/Ocultar motivo del rechazo de la factura 001-001-000000123/);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(open).toHaveTextContent('Ocultar motivo');
    const panel = screen.getByRole('region', {
      name: 'Motivo del rechazo de la factura 001-001-000000123',
    });
    expect(open).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveTextContent('El SRI rechazó la factura.');
    expect(panel).toHaveTextContent('Código: SRI_REJECTED');
    expect(
      within(panel).getByText('35 · ERROR SECUENCIAL REGISTRADO · Secuencial 000000123 ya existe'),
    ).toBeVisible();
    expect(within(panel).getByText('Segundo aviso')).toBeVisible();
    // The reason sits in its own row right under the invoice, spanning every column.
    expect(rowOf('Rosa Mora').nextElementSibling).toContainElement(panel);
    expect(panel.closest('td')).toHaveAttribute('colspan', '6');

    fireEvent.click(open);
    expect(toggle(/Ver motivo del rechazo/)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('El SRI rechazó la factura.')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('labels each toggle with its own invoice and opens them independently', async () => {
    api.list.mockResolvedValue(
      page([
        rejected(),
        rejected({
          id: 'req-failed',
          status: 'FAILED',
          number: '001-001-000000124',
          customerName: 'Luis Vera',
          lastError: { code: 'X', message: 'Fallo interno', messages: [] },
        }),
      ]),
    );
    renderTable();
    await screen.findByText('Luis Vera');
    fireEvent.click(toggle(/Ver motivo del fallo de la factura 001-001-000000124/));
    expect(screen.getByText('Fallo interno')).toBeInTheDocument();
    expect(screen.queryByText('El SRI rechazó la factura.')).not.toBeInTheDocument();
    expect(toggle(/Ver motivo del rechazo de la factura 001-001-000000123/)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it.each(['REJECTED', 'FAILED'] as const)(
    'explains that a %s invoice came without a reason',
    async (status) => {
      api.list.mockResolvedValue(page([rejected({ status, lastError: null })]));
      renderTable();
      await screen.findByText('Rosa Mora');
      fireEvent.click(toggle(/Ver motivo/));
      expect(screen.getByRole('region')).toHaveTextContent(
        'No se registró un motivo para esta factura.',
      );
    },
  );

  it('does not break when the error carries no list of SRI messages', async () => {
    api.list.mockResolvedValue(
      page([rejected({ lastError: { code: 'X', message: 'Solo mensaje' } })]),
    );
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    expect(screen.getByRole('region')).toHaveTextContent('Solo mensaje');
  });

  it.each(['AUTHORIZED', 'REQUESTED', 'PROCESSING'] as const)(
    'offers no reason for a %s invoice, even if it carries an error',
    async (status) => {
      api.list.mockResolvedValue(
        page([
          invoice({
            status,
            lastError: { code: 'X', message: 'Error antiguo', messages: [] },
          }),
        ]),
      );
      renderTable();
      await screen.findByText('Rosa Mora');
      expect(screen.queryByRole('button', { name: /motivo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(screen.queryByText('Error antiguo')).not.toBeInTheDocument();
    },
  );

  it('shows HTML from the API as literal text, never as elements', async () => {
    api.list.mockResolvedValue(
      page([
        rejected({
          lastError: {
            code: 'X',
            message: '<img src=x onerror=alert(1)>',
            messages: [
              { identifier: null, message: '<b>hola</b>', additionalInfo: null, type: null },
            ],
          },
        }),
      ]),
    );
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    const panel = screen.getByRole('region');
    expect(within(panel).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(within(panel).getByText('<b>hola</b>')).toBeInTheDocument();
    expect(panel.querySelector('img, b')).toBeNull();
  });

  it('leaves the actions menu and its disabled downloads untouched', async () => {
    api.list.mockResolvedValue(page([rejected()]));
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    const actions = screen.getByRole('button', {
      name: 'Acciones de la factura 001-001-000000123',
    });
    fireEvent.click(actions);
    expect(actions).toHaveAttribute('aria-expanded', 'true');
    screen.getAllByRole('menuitem').forEach((item) => {
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('No disponible: la factura no fue autorizada.');
    });
    // Opening the menu does not close the reason, and the reason toggle does not open the menu.
    expect(screen.getByRole('region')).toBeInTheDocument();
    fireEvent.click(actions);
    fireEvent.click(toggle(/Ocultar motivo/));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(api.download).not.toHaveBeenCalled();
  });

  it('drops an open reason when its invoice leaves the page', async () => {
    api.list.mockResolvedValue(page([rejected()]));
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    api.list.mockResolvedValue(page([invoice({ id: 'req-2', number: '001-001-000000200' })]));
    fireEvent.change(screen.getByLabelText('Estado de factura'), {
      target: { value: 'AUTHORIZED' },
    });
    await screen.findByText('001-001-000000200');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByText('El SRI rechazó la factura.')).not.toBeInTheDocument();
  });

  it('does not render a blank line for an SRI message with every field empty', async () => {
    api.list.mockResolvedValue(
      page([
        rejected({
          lastError: {
            code: 'X',
            message: 'Motivo general',
            messages: [
              { identifier: null, message: null, additionalInfo: null, type: null },
              { identifier: '', message: 'Detalle real', additionalInfo: '', type: null },
            ],
          },
        }),
      ]),
    );
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    const paragraphs = Array.from(screen.getByRole('region').querySelectorAll('p'));
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      'Motivo general',
      'Código: X',
      'Detalle real',
    ]);
  });

  it('starts closed again after the status filter changes', async () => {
    api.list.mockResolvedValue(page([rejected()]));
    renderTable();
    await screen.findByText('Rosa Mora');
    fireEvent.click(toggle(/Ver motivo/));
    expect(screen.getByRole('region')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado de factura'), {
      target: { value: 'REJECTED' },
    });
    const again = await screen.findByRole('button', { name: /Ver motivo/ });
    expect(again).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
