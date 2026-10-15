'use client';

import { useParams } from 'next/navigation';
import { SectionGate } from '@/components/layout/section-gate';
import { SessionWorkflow } from '@/features/treatment-sessions/session-workflow';

export default function TreatmentSessionPage() {
  const params = useParams();
  const id = params.id as string;
  return (
    <SectionGate section="core.specialties">
      <SessionWorkflow id={id} />
    </SectionGate>
  );
}
