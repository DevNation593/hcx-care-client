'use client';

import { useParams } from 'next/navigation';
import { SectionGate } from '@/components/layout/section-gate';
import { OrderDetail } from '@/features/cash/order-detail';

export default function CashOrderRoute() {
  const { id } = useParams<{ id: string }>();
  return (
    <SectionGate section="core.billing">
      <OrderDetail orderId={id} />
    </SectionGate>
  );
}
