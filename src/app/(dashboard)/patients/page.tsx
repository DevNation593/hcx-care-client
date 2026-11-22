'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { useState } from 'react';
import { usePatientsPage } from '@/hooks/usePatients';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useFallbackToLastPage, useServerPage } from '@/hooks/useServerPage';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { PatientStatusFilter } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Plus, Search, Filter, X } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { describeIdentification } from '@/features/patients/patient-identity';
import { usePatientTerms } from '@/hooks/usePatientTerms';

// The list starts on the active patients; archived ones are one filter away ("Todos", "Inactivos").
const DEFAULT_STATUS_FILTER: PatientStatusFilter = 'active';

function PatientsPageContent() {
  const terms = usePatientTerms();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>(DEFAULT_STATUS_FILTER);
  // The box answers every keystroke; the request waits until typing pauses.
  const debouncedSearch = useDebouncedValue(search.trim());
  const { page, setPage } = useServerPage(`${debouncedSearch}|${statusFilter}`);
  const { data: patientsPage, isLoading, isPlaceholderData } = usePatientsPage({
    search: debouncedSearch,
    status: statusFilter,
    page,
    limit: DEFAULT_PAGE_SIZE,
  });
  const patients = patientsPage?.items ?? [];
  const meta = patientsPage?.meta;
  useFallbackToLastPage(
    page,
    setPage,
    meta && { totalPages: meta.totalPages, settled: !isPlaceholderData },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{terms.Many}</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los registros de tus {terms.many}
          </p>
        </div>
        <Link href="/patients/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo {terms.One}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, identificación, correo o teléfono"
                aria-label={`Buscar ${terms.many}`}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {statusFilter !== DEFAULT_STATUS_FILTER && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  1
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <div className="flex gap-1">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                  >
                    Activos
                  </Button>
                  <Button
                    variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('inactive')}
                  >
                    Inactivos
                  </Button>
                </div>
              </div>
              {statusFilter !== DEFAULT_STATUS_FILTER && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(DEFAULT_STATUS_FILTER)}
                  className="self-end"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable />
          ) : patients.length > 0 ? (
            <>
            <div className={isPlaceholderData ? 'overflow-x-auto opacity-60 transition-opacity' : 'overflow-x-auto'} aria-busy={isPlaceholderData}>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Teléfono</th>
                    <th className="text-left py-3 px-4 font-medium">Profesional Asignado</th>
                    <th className="text-left py-3 px-4 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 font-medium">Agregado</th>
                    <th className="text-right py-3 px-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </p>
                          {patient.identificationNumber && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {describeIdentification(patient.identificationType, patient.identificationNumber)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {patient.email || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {patient.phone || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {patient.assignedPsychologist
                          ? `${patient.assignedPsychologist.firstName} ${patient.assignedPsychologist.lastName}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={patient.isActive ? 'success' : 'secondary'}>
                          {patient.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDate(patient.createdAt, 'dd/MM/yyyy')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/patients/${patient.id}`}>
                          <Button variant="ghost" size="sm">
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && (
              <Pagination
                className="mt-4"
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={meta.limit}
                onPageChange={setPage}
              />
            )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron {terms.many}</p>
              <Link href="/patients/new">
                <Button variant="link" className="mt-2">
                  Agregar primer {terms.one}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <SectionGate section="core.patients.records">
      <PatientsPageContent />
    </SectionGate>
  );
}
