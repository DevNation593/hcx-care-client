'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePagination } from '@/hooks/usePagination';
import { usePlatformDemoRequests, useUpdateDemoRequest } from '@/hooks/usePlatform';
import { formatDate } from '@/lib/utils';
import type { DemoRequest, DemoRequestStatus } from '@/types';

export const DEMO_REQUEST_STATUS_LABELS: Record<DemoRequestStatus, string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactada',
  CLOSED: 'Cerrada',
};

const STATUS_VARIANT: Record<DemoRequestStatus, 'warning' | 'success' | 'secondary'> = {
  NEW: 'warning',
  CONTACTED: 'success',
  CLOSED: 'secondary',
};

/** The next step offered for each status. */
const ACTIONS: Record<DemoRequestStatus, { status: DemoRequestStatus; label: string }[]> = {
  NEW: [
    { status: 'CONTACTED', label: 'Marcar contactada' },
    { status: 'CLOSED', label: 'Cerrar' },
  ],
  CONTACTED: [{ status: 'CLOSED', label: 'Cerrar' }],
  CLOSED: [{ status: 'NEW', label: 'Reabrir' }],
};

const selectClass =
  'h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function DemoRequestsTable() {
  const [status, setStatus] = useState<DemoRequestStatus | ''>('NEW');
  const [error, setError] = useState<string | null>(null);
  const { data, isPending, isError, isFetching, refetch } = usePlatformDemoRequests(status);
  const pagination = usePagination(data ?? [], { resetKey: status });
  const update = useUpdateDemoRequest();

  async function changeStatus(request: DemoRequest, next: DemoRequestStatus) {
    setError(null);
    try {
      await update.mutateAsync({ id: request.id, status: next });
    } catch {
      setError(`No se pudo actualizar la solicitud de ${request.clinic}`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="demo-request-status" className="mb-1 block text-sm font-medium">
          Estado
        </label>
        <select
          id="demo-request-status"
          className={selectClass}
          value={status}
          onChange={(event) => setStatus(event.target.value as DemoRequestStatus | '')}
        >
          <option value="">Todas</option>
          {(Object.keys(DEMO_REQUEST_STATUS_LABELS) as DemoRequestStatus[]).map((value) => (
            <option key={value} value={value}>
              {DEMO_REQUEST_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert variant="destructive" title={error} />}

      {isPending ? (
        <Skeleton className="h-48" aria-busy="true" />
      ) : isError || !data ? (
        <div className="space-y-3">
          <Alert variant="destructive" title="No se pudo cargar el listado de solicitudes" />
          <Button variant="outline" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No hay solicitudes con este estado
          </CardContent>
        </Card>
      ) : (
        <Card className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultorio</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageItems.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <p className="font-medium">{request.clinic}</p>
                    <p className="text-xs text-muted-foreground">{request.name}</p>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${request.email}`} className="block text-sm text-primary hover:underline">
                      {request.email}
                    </a>
                    <a href={`tel:${request.phone.replace(/[^\d+]/g, '')}`} className="block text-xs text-muted-foreground hover:underline">
                      {request.phone}
                    </a>
                  </TableCell>
                  <TableCell>{request.teamSize}</TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap break-words text-sm">
                    {request.message || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{formatDate(request.createdAt, 'PP')}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[request.status]}>{DEMO_REQUEST_STATUS_LABELS[request.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {ACTIONS[request.status].map((action, index) => (
                        <Button
                          key={action.status}
                          type="button"
                          size="sm"
                          variant={index === 0 && action.status !== 'NEW' ? 'default' : 'outline'}
                          disabled={update.isPending}
                          onClick={() => void changeStatus(request, action.status)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}
