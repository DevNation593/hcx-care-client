'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBillAsPatient } from '@/hooks/useBillingProfiles';
import { usePatientTerms } from '@/hooks/usePatientTerms';
import type { ApiError } from '@/types';
import type {
  BillAsPatientInput,
  LinkedBillingProfile,
  MissingPatientBillingField,
  SriIdType,
} from '@/types/cash';
import { normalizeIdNumber, taxIdentificationError } from './tax-identification';

type PatientIdType = NonNullable<BillAsPatientInput['identificationType']>;

const ID_TYPES: { value: PatientIdType; label: string; sri: SriIdType }[] = [
  { value: 'CEDULA', label: 'Cédula', sri: '05' },
  { value: 'RUC', label: 'RUC', sri: '04' },
  { value: 'PASSPORT', label: 'Pasaporte', sri: '06' },
];

const SELECT_CLASS = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IncompleteData {
  missing: MissingPatientBillingField[];
  identificationOnFile: boolean;
  message: string;
}

/** The fields a 422 PATIENT_BILLING_DATA_INCOMPLETE reports, or null for any other error. */
function incompleteData(error: ApiError): IncompleteData | null {
  if (error.code !== 'PATIENT_BILLING_DATA_INCOMPLETE') return null;
  const details = error.details ?? {};
  const missing = Array.isArray(details.missing)
    ? details.missing.filter(
        (field: unknown): field is MissingPatientBillingField =>
          field === 'identification' || field === 'email',
      )
    : [];
  return {
    missing,
    identificationOnFile: details.identificationOnFile === true,
    message: error.message,
  };
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
  const [incomplete, setIncomplete] = useState<IncompleteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idType, setIdType] = useState<PatientIdType>('CEDULA');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');

  const mustFixRecord =
    !!incomplete && incomplete.missing.includes('identification') && incomplete.identificationOnFile;
  // An identification on file that cannot be invoiced is fixed in the record first: completing
  // anything else here could not produce the recipient.
  const asksIdentification =
    !!incomplete && incomplete.missing.includes('identification') && !mustFixRecord;
  const asksEmail = !!incomplete && incomplete.missing.includes('email') && !mustFixRecord;

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

  const handleComplete = (event: React.FormEvent) => {
    event.preventDefault();
    const data: BillAsPatientInput = {};
    if (asksIdentification) {
      const sri = ID_TYPES.find((type) => type.value === idType)!.sri;
      const normalized = normalizeIdNumber(sri, idNumber);
      const problem = normalized
        ? taxIdentificationError(sri, normalized, patient.name)
        : 'Escribe el número de identificación';
      if (problem) {
        setError(problem);
        return;
      }
      data.identificationType = idType;
      data.identificationNumber = normalized;
    }
    if (asksEmail) {
      if (!EMAIL.test(email.trim())) {
        setError('Escribe un correo válido');
        return;
      }
      data.email = email.trim();
    }
    send(data);
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

      {mustFixRecord && incomplete && (
        <Alert variant="warning">
          {incomplete.message}{' '}
          <Link href={`/patients/${patient.id}/edit`} className="font-medium underline">
            Editar {terms.one}
          </Link>
        </Alert>
      )}

      {(asksIdentification || asksEmail) && (
        <form onSubmit={handleComplete} className="space-y-3 rounded-md border p-3" noValidate>
          <p className="text-sm">
            Faltan estos datos para facturar a nombre de{' '}
            <span className="font-medium">{patient.name}</span>. Se guardarán también en su ficha.
          </p>
          {asksIdentification && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`own-id-type-${patient.id}`}>Tipo de identificación</Label>
                <select
                  id={`own-id-type-${patient.id}`}
                  className={SELECT_CLASS}
                  value={idType}
                  onChange={(event) => setIdType(event.target.value as PatientIdType)}
                >
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
                  value={idNumber}
                  onChange={(event) => setIdNumber(event.target.value)}
                />
              </div>
            </div>
          )}
          {asksEmail && (
            <div>
              <Label htmlFor={`own-email-${patient.id}`}>Correo para la factura</Label>
              <Input
                id={`own-email-${patient.id}`}
                type="email"
                className="mt-1"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={disabled} loading={bill.isPending}>
              Guardar y facturar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIncomplete(null);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
