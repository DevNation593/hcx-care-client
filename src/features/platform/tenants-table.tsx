'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { usePlatformPlans, usePlatformTenants } from '@/hooks/usePlatform';
import { ROUTES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { ApiSubscriptionStatus, PlatformTenantListParams, PlatformTenantRow } from '@/types';
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUSPENDED_LABEL,
  tenantStatusLabel,
} from './labels';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SUSPENDED = 'SUSPENDED';

type StatusFilter = ApiSubscriptionStatus | typeof SUSPENDED | '';

const selectClass =
  'h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

// One option per label; the three blocked statuses would read the same.
const STATUS_FILTER_OPTIONS: { value: ApiSubscriptionStatus; label: string }[] = [
  { value: 'TRIALING', label: SUBSCRIPTION_STATUS_LABELS.TRIALING },
  { value: 'ACTIVE', label: SUBSCRIPTION_STATUS_LABELS.ACTIVE },
  { value: 'PAST_DUE', label: SUBSCRIPTION_STATUS_LABELS.PAST_DUE },
  { value: 'UNPAID', label: `${SUBSCRIPTION_STATUS_LABELS.UNPAID} (impago)` },
  { value: 'CANCELED', label: `${SUBSCRIPTION_STATUS_LABELS.CANCELED} (cancelado)` },
  { value: 'INCOMPLETE', label: `${SUBSCRIPTION_STATUS_LABELS.INCOMPLETE} (incompleto)` },
];

function statusVariant(row: PlatformTenantRow): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (!row.isActive) return 'destructive';
  switch (row.status) {
    case 'ACTIVE':
      return 'success';
    case 'PAST_DUE':
      return 'warning';
    case 'TRIALING':
    case null:
      return 'secondary';
    default:
      return 'destructive';
  }
}

export function TenantsTable() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const plans = usePlatformPlans();
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const params: PlatformTenantListParams = { page, pageSize: PAGE_SIZE };
  if (search.trim()) params.search = search.trim();
  if (planId) params.planId = planId;
  if (status === SUSPENDED) params.isActive = false;
  else if (status) params.status = status;

  const { data, isPending, isError, isFetching, refetch } = usePlatformTenants(params);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-64">
            <label htmlFor="tenant-search" className="mb-1 block text-sm font-medium">
              Buscar consultorio
            </label>
            <Input
              id="tenant-search"
              type="search"
              placeholder="Nombre, correo o responsable"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="tenant-plan" className="mb-1 block text-sm font-medium">
              Plan
            </label>
            <select
              id="tenant-plan"
              className={selectClass}
              value={planId}
              onChange={(event) => {
                setPlanId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {(plans.data ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tenant-status" className="mb-1 block text-sm font-medium">
              Estado
            </label>
            <select
              id="tenant-status"
              className={selectClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value={SUSPENDED}>{SUSPENDED_LABEL}</option>
            </select>
          </div>
        </div>
        <Link
          href={ROUTES.PLATFORM_TENANT_NEW}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo consultorio
        </Link>
      </div>

      {isPending ? (
        <Skeleton className="h-48" aria-busy="true" />
      ) : isError || !data ? (
        <div className="space-y-3">
          <Alert variant="destructive" title="No se pudo cargar el listado de consultorios" />
          <Button variant="outline" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No hay consultorios que coincidan con la búsqueda
          </CardContent>
        </Card>
      ) : (
        <Card className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultorio</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Profesionales</TableHead>
                <TableHead>Pacientes activos</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Link
                      href={ROUTES.PLATFORM_TENANT_DETAIL(tenant.id)}
                      className="font-medium hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {tenant.master ? (
                      <>
                        <p>
                          {tenant.master.firstName} {tenant.master.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{tenant.master.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin responsable</span>
                    )}
                  </TableCell>
                  <TableCell>{tenant.plan?.name ?? 'Sin plan'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tenant)}>{tenantStatusLabel(tenant)}</Badge>
                  </TableCell>
                  <TableCell>
                    {tenant.seatsPsychologistsUsed} / {tenant.seatsPsychologistsMax}
                  </TableCell>
                  <TableCell>
                    {tenant.activePatientsCount} / {tenant.maxActivePatients}
                  </TableCell>
                  <TableCell>{formatDate(tenant.createdAt, 'PP')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
