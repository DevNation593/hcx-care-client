'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInvoiceRequests, useInvoicingPermissions } from '@/hooks/useInvoicing';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';
import { invoicingApi } from '@/lib/api/invoicing-api';
import { INVOICE_STATUS_LABELS, type InvoiceRequest, type InvoiceStatus } from '@/types/invoicing';
import type { ApiError } from '@/types';
import { InvoiceActionsMenu, type InvoiceDocumentKind } from './invoice-actions-menu';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
/** The API accepts digits and hyphens only ("001-001-000000123", "001-001", "123"). */
const SEARCH_PATTERN = /^[0-9-]{1,17}$/;
const DOCUMENT_LABELS: Record<InvoiceDocumentKind, string> = { xml: 'XML', ride: 'RIDE' };

/** YYYY-MM-DD is already the Ecuador calendar date: it is reordered, never converted. */
export function formatIssueDate(issueDate?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issueDate ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

function statusVariant(status: InvoiceStatus) {
  if (status === 'AUTHORIZED') return 'default' as const;
  if (status === 'REJECTED' || status === 'FAILED') return 'destructive' as const;
  return 'secondary' as const;
}

interface OpenMenu {
  request: InvoiceRequest;
  x: number;
  y: number;
  align: 'start' | 'end';
}

/**
 * Billing › Issued invoices: invoice number, issue date and customer, searchable by number. A right
 * click on a row (or its "Acciones" button, for the keyboard and touch screens) offers the XML and
 * the RIDE, which are downloaded with the signed-in session.
 */
export function IssuedInvoicesTable({ branchId }: { branchId?: string }) {
  const { view } = useInvoicingPermissions();
  const tenantId = useTenantId();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const focusOnClose = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const term = search.trim();
  const invalidTerm = term !== '' && !SEARCH_PATTERN.test(term);
  const invoices = useInvoiceRequests(
    {
      ...(branchId ? { branchId } : {}),
      page,
      pageSize: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(term && !invalidTerm ? { q: term } : {}),
    },
    !invalidTerm,
  );

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenu(null);
    if (restoreFocus) focusOnClose.current?.focus();
  }, []);

  function openMenu(next: OpenMenu, opener: HTMLElement | null) {
    focusOnClose.current = opener;
    setMenu(next);
  }

  async function download(request: InvoiceRequest, kind: InvoiceDocumentKind) {
    closeMenu(true);
    setNotice(null);
    setDownloading(true);
    try {
      await invoicingApi.download(requireTenantId(tenantId), request, kind);
      setNotice({
        kind: 'ok',
        text: `Descarga del ${DOCUMENT_LABELS[kind]} de la factura ${request.number ?? ''} iniciada.`,
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        text:
          (error as ApiError).message ||
          `No se pudo descargar el ${DOCUMENT_LABELS[kind]}. Inténtalo de nuevo.`,
      });
      // A file that was not ready yet may be by now: bring the list up to date.
      void invoices.refetch();
    } finally {
      setDownloading(false);
    }
  }

  if (!view)
    return (
      <p className="text-sm text-muted-foreground">No tienes permiso para consultar facturas.</p>
    );

  const items = invoices.data?.items ?? [];
  const totalPages = invoices.data ? Math.max(1, Math.ceil(invoices.data.total / PAGE_SIZE)) : 1;
  const filtered = term !== '' || status !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <Label htmlFor="invoice-search">Buscar por número de factura</Label>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            />
            <Input
              id="invoice-search"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              className="pl-9 pr-10"
              placeholder="001-001-000000123 o 123"
              value={searchInput}
              error={invalidTerm ? 'Escribe solo dígitos y guiones, por ejemplo 123 o 001-001.' : undefined}
              errorId="invoice-search-error"
              aria-invalid={invalidTerm || undefined}
              aria-describedby={invalidTerm ? 'invoice-search-error' : undefined}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput !== '' && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="sm:w-48">
          <Label htmlFor="invoice-status">Estado de factura</Label>
          <select
            id="invoice-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | '');
              setPage(1);
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice &&
        (notice.kind === 'error' ? (
          <Alert variant="destructive">{notice.text}</Alert>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {notice.text}
          </p>
        ))}

      {/* A failed refetch keeps the cached rows on screen: say they could not be verified. */}
      {!invalidTerm && invoices.isError && invoices.data && (
        <Alert variant="warning">
          No se pudieron actualizar las facturas. Los datos mostrados pueden estar desactualizados.{' '}
          <Button type="button" variant="link" onClick={() => void invoices.refetch()}>
            Reintentar facturas
          </Button>
        </Alert>
      )}

      {invalidTerm ? null : invoices.isPending ? (
        <Skeleton className="h-48" role="status" aria-label="Cargando facturas" />
      ) : invoices.isError && !invoices.data ? (
        <Alert variant="destructive">
          No se pudieron cargar las facturas.{' '}
          <Button type="button" variant="link" onClick={() => void invoices.refetch()}>
            Reintentar facturas
          </Button>
        </Alert>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {filtered
              ? term
                ? `No se encontraron facturas con el número «${term}».`
                : 'No hay facturas para estos filtros.'
              : 'Aún no hay facturas emitidas.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={invoices.isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table aria-label="Facturas emitidas" aria-busy={invoices.isFetching}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Número de factura</TableHead>
                  <TableHead scope="col">Fecha de emisión</TableHead>
                  <TableHead scope="col">Cliente</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">Orden</TableHead>
                  <TableHead scope="col" className="w-12">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => {
                  const label = request.number ?? `de la orden ${request.orderNumber ?? ''}`.trim();
                  return (
                    <TableRow
                      key={request.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMenu(
                          {
                            request,
                            x: event.clientX,
                            y: event.clientY,
                            align: 'start',
                          },
                          document.activeElement as HTMLElement | null,
                        );
                      }}
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        {request.number ?? (
                          <span className="font-normal text-muted-foreground">Sin número aún</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatIssueDate(request.issueDate)}
                      </TableCell>
                      <TableCell className="min-w-[12rem] max-w-xs break-words">
                        {request.customerName ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(request.status)}>
                          {INVOICE_STATUS_LABELS[request.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {request.orderNumber ? `#${request.orderNumber}` : '—'}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Acciones de la factura ${label}`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.request.id === request.id}
                          disabled={downloading}
                          data-invoice-menu-trigger="true"
                          onClick={(event) => {
                            const button = event.currentTarget;
                            if (menu?.request.id === request.id) {
                              closeMenu(true);
                              return;
                            }
                            const box = button.getBoundingClientRect();
                            openMenu(
                              {
                                request,
                                x: box.right,
                                y: box.bottom + 4,
                                align: 'end',
                              },
                              button,
                            );
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground">
            Clic derecho sobre una factura, o el botón de acciones, para descargar su XML o su
            RIDE.
          </p>
        </>
      )}

      {invoices.data && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={invoices.data.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {menu && (
        <InvoiceActionsMenu
          // A new request or point reopens the menu from scratch: focus and position.
          key={`${menu.request.id}-${menu.x}-${menu.y}`}
          request={invoices.data?.items.find((r) => r.id === menu.request.id) ?? menu.request}
          x={menu.x}
          y={menu.y}
          align={menu.align}
          onSelect={(kind) => void download(menu.request, kind)}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
