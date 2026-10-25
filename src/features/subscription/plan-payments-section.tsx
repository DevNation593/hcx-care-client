'use client';

import { Alert } from '@/components/ui/alert';
import { useSubscriptionPayments } from '@/hooks/useSubscription';
import { formatDate } from '@/lib/utils';
import type { SubscriptionPayment } from '@/types';

const formatAmount = (payment: SubscriptionPayment) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: payment.currency }).format(
    Number(payment.amount),
  );

/** The charges waiting for payment, and how to change the plan: only the platform does it. */
export function PlanPaymentsSection() {
  const payments = useSubscriptionPayments();
  const pending = (payments.data ?? []).filter((payment) => payment.status === 'PENDING');

  return (
    <div className="space-y-3">
      {pending.map((payment) => (
        <Alert
          key={payment.id}
          variant="warning"
          title={`${payment.planName}: pago pendiente`}
          description={`Importe: ${formatAmount(payment)}${
            payment.periodStart
              ? `, para el período que inicia el ${formatDate(payment.periodStart, 'dd/MM/yyyy')}`
              : ''
          }. Contacta a soporte para registrar tu pago.`}
        />
      ))}
      <Alert
        variant="default"
        title="¿Necesitas otro plan o más capacidad?"
        description="Los planes los asigna el equipo de soporte. Escríbenos para cambiar de plan, ampliar un límite o activar un módulo."
      />
    </div>
  );
}
