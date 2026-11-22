'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RecordDataView } from '@/features/clinical-forms/clinical-module-form';
import { describeModule } from '@/features/admin/specialties/module-labels';
import { useClinicalModules } from '@/hooks/useClinicalModules';
import { withReturnTab, type PatientTabId } from '@/lib/patient-tabs';
import { cn, formatDate } from '@/lib/utils';
import type { SpecialtyRecord } from '@/types';
import type { ClinicalModuleDefinition, Encounter, FormAlertLevel } from '@/types/clinical';
import { describeEncounter } from './encounter-panel';

export const ALERT_STYLES: Record<FormAlertLevel, string> = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-orange-300 bg-orange-50 text-orange-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

const definitionKey = (moduleKey: string, schemaVersion: number) => `${moduleKey}@${schemaVersion}`;

/** The definitions the records were written under, to read them back with their labels. */
export function useRecordDefinitions(enabled = true) {
  const modulesQuery = useClinicalModules(enabled);
  const definitions = useMemo(
    () =>
      new Map(
        (modulesQuery.data ?? []).map((definition) => [
          definitionKey(definition.moduleKey, definition.schemaVersion),
          definition,
        ]),
      ),
    [modulesQuery.data],
  );
  const definitionOf = (record: SpecialtyRecord) =>
    definitions.get(definitionKey(record.moduleKey, record.schemaVersion ?? 1));
  const nameOf = (record: SpecialtyRecord) =>
    definitionOf(record)?.name ?? describeModule(record.moduleKey).name;
  return { modulesQuery, definitionOf, nameOf };
}

/**
 * A clinical record as it is read: who wrote it and when, its signature and addenda, the alerts
 * its data raises, the data itself and a link to print it. The tab that shows it decides what can
 * be done with it through `actions` (the clinical history shows none).
 */
export function RecordCard({
  record,
  name,
  definition,
  from,
  actions,
}: {
  record: SpecialtyRecord;
  /** What the record is called: the form's name, or the module's when it has no definition. */
  name: string;
  definition?: ClinicalModuleDefinition;
  /** The tab of the patient's page this card is on: the print page's back link returns there. */
  from: PatientTabId;
  actions?: ReactNode;
}) {
  // A signed record is final: its author corrects it with an addendum, once.
  const signed = record.signed === true;
  const superseded = !!record.amendedBy;

  return (
    <Card className={cn(superseded && 'opacity-75')}>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">
              {[
                record.professional && `${record.professional.firstName} ${record.professional.lastName}`,
                record.specialty?.name,
                formatDate(record.recordDate, 'dd/MM/yyyy'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {record.encounter && (
              <p className="text-xs text-muted-foreground">
                Atención: {describeEncounter(record.encounter as Pick<Encounter, 'encounterType' | 'startedAt'>)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {record.amendsRecordId && <Badge>Adenda</Badge>}
            {signed && <Badge variant="secondary">Firmado</Badge>}
            {superseded ? (
              <Badge variant="outline">Corregido por adenda</Badge>
            ) : (
              (record.version ?? 1) > 1 && <Badge variant="outline">Corregido</Badge>
            )}
            <Link
              href={withReturnTab(`/patients/${record.patientId}/records/${record.id}/print`, from)}
              aria-label={`Imprimir ${name}`}
              className="inline-flex h-9 items-center justify-center rounded-md px-3 hover:bg-accent"
            >
              <Printer className="h-4 w-4" />
            </Link>
            {actions}
          </div>
        </div>

        {record.alerts?.map((alert) => (
          <p
            key={alert.message}
            role="alert"
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
              ALERT_STYLES[alert.level],
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {alert.message}
          </p>
        ))}

        {record.amendsRecordId && record.amendmentReason && (
          <p className="rounded-md border border-input px-3 py-2 text-sm">
            <span className="font-medium">Motivo de la adenda:</span> {record.amendmentReason}
          </p>
        )}
        {superseded && record.amendedBy && (
          <p className="text-sm text-muted-foreground">
            Corregido por una adenda del {formatDate(record.amendedBy.createdAt, 'dd/MM/yyyy HH:mm')}. Se
            conserva tal como se firmó.
          </p>
        )}

        <RecordDataView definition={definition} data={record.data} />
        {record.notes && <p className="whitespace-pre-wrap border-t pt-3 text-sm">{record.notes}</p>}
      </CardContent>
    </Card>
  );
}
