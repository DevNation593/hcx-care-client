'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, type PatientFormData } from '@/lib/validations/schemas';
import { usePatient, useUpdatePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Gender } from '@/types';
import { isMinor } from '@/features/patients/patient-identity';
import {
  PatientAdditionalFields,
  PatientGuardianFields,
  PatientIdentificationFields,
} from '@/features/patients/patient-profile-fields';

export default function EditPatientPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const { data: patient, isLoading: patientLoading } = usePatient(patientId);
  const { mutate: updatePatient, isPending } = useUpdatePatient(patientId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      identificationType: '', identificationNumber: '',
      maritalStatus: '', occupation: '', nationality: '', bloodType: '', disability: '',
      insuranceProvider: '', insurancePolicyNumber: '',
      guardianName: '', guardianRelationship: '', guardianIdentification: '', guardianPhone: '',
    },
  });

  // Pre-fill form when patient data loads
  useEffect(() => {
    if (patient) {
      reset({
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email || '',
        phone: patient.phone || '',
        // The API stores a full timestamp; the date input only accepts YYYY-MM-DD.
        dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
        gender: patient.gender ?? undefined,
        address: patient.address || '',
        emergencyContactName: patient.emergencyContactName || '',
        emergencyContactPhone: patient.emergencyContactPhone || '',
        notes: patient.notes || '',
        identificationType: patient.identificationType || '',
        identificationNumber: patient.identificationNumber || '',
        maritalStatus: patient.maritalStatus || '',
        occupation: patient.occupation || '',
        nationality: patient.nationality || '',
        bloodType: patient.bloodType || '',
        disability: patient.disability || '',
        insuranceProvider: patient.insuranceProvider || '',
        insurancePolicyNumber: patient.insurancePolicyNumber || '',
        guardianName: patient.guardianName || '',
        guardianRelationship: patient.guardianRelationship || '',
        guardianIdentification: patient.guardianIdentification || '',
        guardianPhone: patient.guardianPhone || '',
      });
    }
  }, [patient, reset]);

  const onSubmit = (data: PatientFormData) => {
    updatePatient(data, {
      onSuccess: () => {
        router.push(`/patients/${patientId}`);
      },
    });
  };

  if (patientLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground text-lg">Paciente no encontrado</p>
        <Button variant="outline" onClick={() => router.push('/patients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a pacientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Detalle
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Editar Paciente</h1>
        <p className="text-muted-foreground mt-1">
          {patient.firstName} {patient.lastName}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>Datos básicos del paciente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" required>Nombre</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  error={errors.firstName?.message}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" required>Apellido</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  error={errors.lastName?.message}
                />
              </div>
            </div>

            <PatientIdentificationFields register={register} errors={errors} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  error={errors.email?.message}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...register('phone')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Fecha de Nacimiento</Label>
                <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Género</Label>
                <select
                  id="gender"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('gender')}
                >
                  <option value="">Seleccionar</option>
                  <option value={Gender.MALE}>Masculino</option>
                  <option value={Gender.FEMALE}>Femenino</option>
                  <option value={Gender.NON_BINARY}>No binario</option>
                  <option value={Gender.PREFER_NOT_TO_SAY}>Prefiero no decir</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register('address')} />
            </div>

            <PatientAdditionalFields register={register} errors={errors} />

            <PatientGuardianFields
              register={register}
              errors={errors}
              required={isMinor(watch('dateOfBirth'))}
            />

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Contacto de Emergencia</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Nombre</Label>
                  <Input id="emergencyContactName" {...register('emergencyContactName')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Teléfono</Label>
                  <Input id="emergencyContactPhone" {...register('emergencyContactPhone')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Información adicional sobre el paciente..."
                rows={4}
                {...register('notes')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/patients/${patientId}`}>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" loading={isPending} disabled={!isDirty}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
