'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBillAsPatient } from '@/hooks/useBillingProfiles';
import { usePatientTerms } from '@/hooks/usePatientTerms';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useSections } from '@/hooks/useSections';
import {
  patientBillingDataSchema,
  type PatientBillingDataValues,
} from '@/lib/validations/schemas';
import { useAuthStore } from '@/store/authStore';
import type { ApiError } from '@/types';
import type { BillAsPatientInput, LinkedBillingProfile, PatientBillingIssue } from '@/types/cash';
import { canReadPatients } from '@/types/guards';

const ID_TYPES: { value: PatientBillingDataValues['identificationType']; label: string }[] = [
  { value: 'CEDULA', label: 'Cédula' },
  { value: 'RUC', label: 'RUC' },
  { value: 'PASSPORT', label: 'Pasaporte' },
];

const SELECT_CLASS = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const ISSUES: readonly PatientBillingIssue[] = ['identification', 'legalName', 'email', 'address', 'phone'];

interface IncompleteData {
  /** Empty data this form may complete. */
  missing: PatientBillingIssue[];
  /** Data on file that must be fixed in the record. */
  invalid: PatientBillingIssue[];
  message: string;
}

const issuesIn = (value: unknown): PatientBillingIssue[] =>
  Array.isArray(value) ? ISSUES.filter((issue) => value.includes(issue)) : [];

/** What a 422 PATIENT_BILLING_DATA_INCOMPLETE reports, or null for any other error. */
function incompleteData(error: ApiError): IncompleteData | null {
  if (error.code !== 'PATIENT_BILLING_DATA_INCOMPLETE') return null;
  const details = error.details ?? {};
  return { missing: issuesIn(details.missing), invalid: issuesIn(details.invalid), message: error.message };
}

interface PatientOwnBillingProps {
  patient: { id: string; name: string };
  /** Called with the patient's own profile, already linked to the patient. */
  onReady: (profile: LinkedBillingProfile) => void;
  disabled?: boolean;
}

/**
 * Bills in the patient's own name with the data already on the record. When something is
 * missing it asks only for that, and the answers are saved to the record too.
 */
export function PatientOwnBilling({ patient, onReady, disabled }: PatientOwnBillingProps) {
  const terms = usePatientTerms();
  const bill = useBillAsPatient(patient.id);
  const role = useAuthStore((state) => state.user?.role);
  const { can } = useMyPermissions();
  const { isEnabled } = useSections();
  const [incomplete, setIncomplete] = useState<IncompleteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The recipient is copied from the patient record, which the cashier never reads (SEC-WEB-12):
  // it bills with the profiles already linked to the patient.
  const readsPatients = !!role && canReadPatients(role);
  // Completing the record edits the patient: the API asks for patients.update and the patient
  // records section.
  const mayEditRecord = readsPatients && can('patients.update') && isEnabled('core.patients.records');

  if (!readsPatients) {
    return (
      <p className="text-sm text-muted-foreground">
        Pide a recepción que registre los datos de facturación de {patient.name}.
      </p>
    );
  }

  const mustFixRecord = !!incomplete && incomplete.invalid.length > 0;
  // Data on file that cannot be invoiced is fixed in the record first: completing anything else
  // here could not produce the recipient.
  const asks =
    incomplete && mayEditRecord && !mustFixRecord
      ? {
          identification: incomplete.missing.includes('identification'),
          email: incomplete.missing.includes('email'),
        }
      : null;

  const send = (data?: BillAsPatientInput) => {
    setError(null);
    bill.mutate(data, {
      onSuccess: (profile) => {
        setIncomplete(null);
        toast.success(`Facturación a nombre de ${profile.legalName} lista`);
        onReady(profile);
      },
      onError: (failure) => {
        const missing = incompleteData(failure);
        if (missing) {
          setIncomplete(missing);
          return;
        }
        setError(failure.message);
      },
    });
  };

  return (
    <div className="space-y-2">
      {!incomplete && (
        <Button
          type="button"
          size="sm"
          disabled={disabled || bill.isPending}
          loading={bill.isPending}
          aria-label={`Facturar a nombre de ${patient.name}`}
          onClick={() => send()}
        >
          Facturar a su nombre
        </Button>
      )}

      {incomplete && mustFixRecord && mayEditRecord && (
        <Alert variant="warning">
          {incomplete.message}{' '}
          <Link href={`/patients/${patient.id}/edit`} className="font-medium underline">
            Editar {terms.one}
          </Link>
        </Alert>
      )}

      {incomplete && !mayEditRecord && (
        <Alert variant="warning">
          Faltan o no son válidos datos de la ficha de {patient.name}. Pide a un usuario que pueda
          editar {terms.many} que la complete para facturar a su nombre.
        </Alert>
      )}

      {asks && (asks.identification || asks.email) && (
        <PatientBillingDataForm
          patient={patient}
          asks={asks}
          disabled={disabled}
          saving={bill.isPending}
          onSubmit={send}
          onCancel={() => {
            setIncomplete(null);
            setError(null);
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Asks only for the data the record lacks; mounted per answer, so its schema stays fixed. */
function PatientBillingDataForm({
  patient,
  asks,
  disabled,
  saving,
  onSubmit,
  onCancel,
}: {
  patient: { id: string; name: string };
  asks: { identification: boolean; email: boolean };
  disabled?: boolean;
  saving: boolean;
  onSubmit: (data: BillAsPatientInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientBillingDataValues, unknown, BillAsPatientInput>({
    resolver: zodResolver(patientBillingDataSchema(asks)),
    defaultValues: { identificationType: 'CEDULA', identificationNumber: '', email: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-md border p-3" noValidate>
      <p className="text-sm">
        Faltan estos datos para facturar a nombre de{' '}
        <span className="font-medium">{patient.name}</span>. Se guardarán también en su ficha.
      </p>
      {asks.identification && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`own-id-type-${patient.id}`}>Tipo de identificación</Label>
            <select id={`own-id-type-${patient.id}`} className={SELECT_CLASS} {...register('identificationType')}>
              {ID_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`own-id-number-${patient.id}`}>Número de identificación</Label>
            <Input
              id={`own-id-number-${patient.id}`}
              className="mt-1"
              error={errors.identificationNumber?.message}
              {...register('identificationNumber')}
            />
          </div>
        </div>
      )}
      {asks.email && (
        <div>
          <Label htmlFor={`own-email-${patient.id}`}>Correo para la factura</Label>
          <Input
            id={`own-email-${patient.id}`}
            type="email"
            className="mt-1"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={disabled} loading={saving}>
          Guardar y facturar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
