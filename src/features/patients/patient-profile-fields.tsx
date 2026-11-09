'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PatientFormData } from '@/lib/validations/schemas';
import { IDENTIFICATION_TYPES, IDENTIFICATION_TYPE_LABELS } from './patient-identity';
import { usePatientTerms } from '@/hooks/usePatientTerms';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const MARITAL_STATUSES = ['Soltero/a', 'Casado/a', 'Unión de hecho', 'Divorciado/a', 'Viudo/a'];

interface PatientFieldsProps {
  register: UseFormRegister<PatientFormData>;
  errors: FieldErrors<PatientFormData>;
}

/** Identification document of the patient; unique within the clinic. */
export function PatientIdentificationFields({ register, errors }: PatientFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="identificationType">Tipo de documento</Label>
        <select
          id="identificationType"
          className={SELECT_CLASS}
          aria-invalid={errors.identificationType ? true : undefined}
          aria-describedby={errors.identificationType ? 'identificationType-error' : undefined}
          {...register('identificationType')}
        >
          <option value="">Sin documento</option>
          {IDENTIFICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {IDENTIFICATION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {errors.identificationType && (
          <p id="identificationType-error" className="text-sm text-destructive">
            {errors.identificationType.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="identificationNumber">Número de documento</Label>
        <Input
          id="identificationNumber"
          autoComplete="off"
          {...register('identificationNumber')}
          error={errors.identificationNumber?.message}
        />
      </div>
    </div>
  );
}

/** Demographic and coverage data beyond the basic record. */
export function PatientAdditionalFields({ register }: PatientFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="mb-4 font-semibold">Datos adicionales</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maritalStatus">Estado civil</Label>
          <select id="maritalStatus" className={SELECT_CLASS} {...register('maritalStatus')}>
            <option value="">Seleccionar</option>
            {MARITAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="occupation">Ocupación</Label>
          <Input id="occupation" {...register('occupation')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nationality">Nacionalidad</Label>
          <Input id="nationality" {...register('nationality')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bloodType">Grupo sanguíneo</Label>
          <select id="bloodType" className={SELECT_CLASS} {...register('bloodType')}>
            <option value="">Seleccionar</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="disability">Discapacidad</Label>
          <Input id="disability" {...register('disability')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insuranceProvider">Seguro o convenio</Label>
          <Input id="insuranceProvider" {...register('insuranceProvider')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insurancePolicyNumber">Número de póliza</Label>
          <Input id="insurancePolicyNumber" {...register('insurancePolicyNumber')} />
        </div>
      </div>
    </div>
  );
}

/** Legal guardian. Required by the API when the birth date makes the patient a minor. */
export function PatientGuardianFields({
  register,
  errors,
  required,
}: PatientFieldsProps & { required: boolean }) {
  const terms = usePatientTerms();
  return (
    <div className="border-t pt-6">
      <h3 className="font-semibold">Representante legal</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {required
          ? `El ${terms.one} es menor de edad: registra a su representante legal.`
          : `Obligatorio solo cuando el ${terms.one} es menor de edad.`}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guardianName" required={required}>
            Nombre del representante
          </Label>
          <Input
            id="guardianName"
            {...register('guardianName')}
            error={errors.guardianName?.message}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guardianRelationship">Relación con el {terms.one}</Label>
          <Input
            id="guardianRelationship"
            placeholder="Madre, padre, tutor legal…"
            {...register('guardianRelationship')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guardianIdentification">Documento del representante</Label>
          <Input id="guardianIdentification" autoComplete="off" {...register('guardianIdentification')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guardianPhone">Teléfono del representante</Label>
          <Input id="guardianPhone" type="tel" {...register('guardianPhone')} />
        </div>
      </div>
    </div>
  );
}
