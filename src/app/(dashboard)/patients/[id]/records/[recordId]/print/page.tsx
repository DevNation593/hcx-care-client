'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Printer } from 'lucide-react';
import { SectionGate } from '@/components/layout/section-gate';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordDocument } from '@/features/patients/record-document';
import { useClinicalModules } from '@/hooks/useClinicalModules';
import { useSaveRecordDocument } from '@/hooks/useDocuments';
import { usePatient } from '@/hooks/usePatients';
import { usePatientSpecialtyRecord } from '@/hooks/useSpecialtyRecords';
import { useAuthStore } from '@/store/authStore';

function RecordPrintContent() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const recordId = params.recordId as string;
  const tenant = useAuthStore((state) => state.tenant);
  const [printedAt] = useState(() => new Date());

  const patientQuery = usePatient(patientId);
  const recordQuery = usePatientSpecialtyRecord(patientId, recordId);
  const modulesQuery = useClinicalModules();
  const saveDocument = useSaveRecordDocument(patientId);
  const record = recordQuery.data;
  const patient = patientQuery.data;

  if (recordQuery.isError || patientQuery.isError) {
    return (
      <Alert variant="destructive" title="No se pudo cargar el documento">
        <Button variant="outline" size="sm" className="mt-2" onClick={() => router.back()}>
          Volver
        </Button>
      </Alert>
    );
  }
  if (!record || !patient || modulesQuery.isPending) {
    return <Skeleton className="mx-auto h-[600px] max-w-3xl" />;
  }

  const definition = modulesQuery.data?.find(
    (candidate) =>
      candidate.moduleKey === record.moduleKey &&
      candidate.schemaVersion === (record.schemaVersion ?? 1),
  );

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => router.push(`/patients/${patientId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al paciente
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {/* The copy kept in the history: rendered by the server, with the same code. */}
          <Button
            variant="outline"
            loading={saveDocument.isPending}
            onClick={() => saveDocument.mutate(recordId)}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Guardar PDF en archivos
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-3xl rounded-lg border print:max-w-none print:border-0">
        <RecordDocument
          clinic={{
            name: tenant?.name ?? '',
            address: tenant?.address,
            phone: tenant?.phone,
            logoUrl: tenant?.logoUrl,
          }}
          patient={patient}
          record={record}
          definition={definition}
          printedAt={printedAt}
        />
      </div>
    </div>
  );
}

export default function RecordPrintPage() {
  return (
    <SectionGate section="core.clinical.specialties">
      <RecordPrintContent />
    </SectionGate>
  );
}
