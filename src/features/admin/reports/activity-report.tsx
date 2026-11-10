'use client';

import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranches } from '@/hooks/useBranches';
import { useActivityReport } from '@/hooks/useReports';
import type { ActivityCounts, ActivityReportParams } from '@/lib/api/reports-api';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/constants';
import { ENCOUNTER_TYPE_LABELS } from '@/types/clinical';
import { getErrorMessage } from '@/lib/api/error-messages';

const MAX_DAYS = 366;

const pad = (value: number) => String(value).padStart(2, '0');
const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** First and last day of the current month, as the date inputs hold them. */
export function currentMonth(today = new Date()): { from: string; to: string } {
  return {
    from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

/**
 * The period the API expects for two local dates: from the start of the first day to the end
 * of the last one. Returns the problem as text when the dates do not make a period.
 */
export function reportPeriod(from: string, to: string): { from: string; to: string } | string {
  const [start, end] = [from, to].map((value) => {
    const [year, month, day] = value.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  });
  if (!start || !end) return 'Elige la fecha inicial y la final.';
  if (end < start) return 'La fecha final no puede ser anterior a la inicial.';
  // The last day is included: the period ends when the next day starts.
  end.setDate(end.getDate() + 1);
  if (end.getTime() - start.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    return 'El reporte cubre como máximo un año.';
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

const COLUMNS: { key: keyof ActivityCounts; label: string }[] = [
  { key: 'appointments', label: 'Citas' },
  { key: 'completed', label: 'Completadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'noShow', label: 'No asistió' },
  { key: 'encounters', label: 'Atenciones' },
];

function CountsTable({
  caption,
  firstColumn,
  rows,
}: {
  caption: string;
  firstColumn: string;
  rows: (ActivityCounts & { id: string; name: string })[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              {firstColumn}
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-2 text-right font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-medium">
                {row.name}
              </th>
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-2 py-2 text-right tabular-nums">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Breakdown({
  title,
  counts,
  labels,
}: {
  title: string;
  counts: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros en el período.</p>
      ) : (
        <dl className="space-y-1 text-sm">
          {entries.map(([key, count]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt>{labels[key] ?? key}</dt>
              <dd className="tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Appointments and encounters of a period, by branch and by professional. */
export function ActivityReport() {
  const initial = useMemo(() => currentMonth(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [branchId, setBranchId] = useState('');
  const { data: branches = [] } = useBranches();

  const period = reportPeriod(from, to);
  const problem = typeof period === 'string' ? period : null;
  const params: ActivityReportParams | null =
    typeof period === 'string' ? null : { ...period, ...(branchId ? { branchId } : {}) };
  const report = useActivityReport(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">
          Citas y atenciones del período, por sede y por profesional.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
          <div>
            <Label htmlFor="report-from">Desde</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? 'report-period-error' : undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="report-to">Hasta</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? 'report-period-error' : undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          {branches.length > 1 && (
            <div>
              <Label htmlFor="report-branch">Sede</Label>
              <select
                id="report-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todas las sedes</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.isActive ? '' : ' (inactiva)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {problem && (
            <p id="report-period-error" className="text-sm text-destructive sm:col-span-3">
              {problem}
            </p>
          )}
        </CardContent>
      </Card>

      {problem ? null : report.isError ? (
        <Alert variant="destructive" title="No se pudo cargar el reporte" description={getErrorMessage(report.error, 'Intenta de nuevo.')}>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => report.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : report.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {COLUMNS.map((column) => (
              <Card key={column.key}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{column.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{report.data.totals[column.key]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por sede</CardTitle>
              <CardDescription>
                Las citas cuentan por su fecha; las atenciones, por la fecha en que se iniciaron.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CountsTable
                caption="Citas y atenciones por sede"
                firstColumn="Sede"
                rows={report.data.branches.map((branch) => ({
                  ...branch,
                  id: branch.branchId ?? 'none',
                  name: branch.isActive ? branch.name : `${branch.name} (inactiva)`,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Por profesional</CardTitle>
            </CardHeader>
            <CardContent>
              {report.data.professionals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay citas ni atenciones en este período.
                </p>
              ) : (
                <CountsTable
                  caption="Citas y atenciones por profesional"
                  firstColumn="Profesional"
                  rows={report.data.professionals.map((professional) => ({
                    ...professional,
                    id: professional.professionalId,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
              <Breakdown
                title="Citas por estado"
                counts={report.data.appointmentsByStatus}
                labels={APPOINTMENT_STATUS_LABELS}
              />
              <Breakdown
                title="Atenciones por tipo"
                counts={report.data.encountersByType}
                labels={ENCOUNTER_TYPE_LABELS}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
