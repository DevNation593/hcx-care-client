'use client';

import { AlertTriangle } from 'lucide-react';
import { usePatientClinicalAlerts } from '@/hooks/useSpecialtyRecords';
import { cn, formatDate } from '@/lib/utils';
import type { FormAlertLevel } from '@/types/clinical';
import { ALERT_STYLES } from './record-card';

const LEVEL_ORDER: FormAlertLevel[] = ['critical', 'warning', 'info'];

/**
 * The patient's standing clinical alerts: every allergy flagged as severe and what the latest
 * record of each module raises. Shown only to accounts that may read clinical content.
 */
export function PatientClinicalAlerts({ patientId }: { patientId: string }) {
  const { data: alerts = [] } = usePatientClinicalAlerts(patientId);
  if (alerts.length === 0) return null;

  const sorted = [...alerts].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );

  return (
    <section aria-label="Alertas clínicas" className="space-y-2">
      {sorted.map((alert) => (
        <p
          key={`${alert.recordId}-${alert.message}`}
          role={alert.level === 'critical' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
            ALERT_STYLES[alert.level],
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{alert.message}</span>{' '}
            <span className="opacity-80">
              {alert.moduleName} · {formatDate(alert.recordDate, 'dd/MM/yyyy')}
            </span>
          </span>
        </p>
      ))}
    </section>
  );
}
