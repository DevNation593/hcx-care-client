'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { AestheticsWorkspace } from '@/features/aesthetics/aesthetics-workspace';

export default function AestheticsPage() {
  return <SectionGate section="core.aesthetics"><AestheticsWorkspace /></SectionGate>;
}
