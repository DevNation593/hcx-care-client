'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrder, useOrderEligibility, useSetOrderBillingProfile } from '@/hooks/useOrders';
import { useMyPermissions } from '@/hooks/usePermissions';
import type { ApiError } from '@/types';
import { SRI_ID_TYPE_LABELS, type Order, type OrderStatus } from '@/types/cash';
import { BillingProfilePicker } from './billing-profile-picker';
import { InvoiceRequestPanel } from './invoice-request-panel';
import { formatMoney } from './money';
import { OrderItems } from './order-items';
import { OrderPayments } from './order-payments';

const STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: 'Abierta',
  PAID: 'Pagada',
  INVOICED: 'En facturación',
  CANCELLED: 'Cancelada',
};

const CONFLICT_MESSAGE = 'La orden cambió; revisa y vuelve a intentar';

function itemsLockedReason(order: Order): string | null {
  if (order.status !== 'OPEN') {
    return 'Los ítems no se pueden cambiar: la orden no está abierta.';
  }
  if (order.payments.some((payment) => payment.status === 'RECORDED')) {
    return 'Los ítems no se pueden cambiar: la orden tiene pagos registrados. Devuelve los pagos para editarla.';
  }
  return null;
}

function orderPatients(order: Order): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const item of order.items) {
    if (item.patient && !seen.has(item.patient.id)) {
      seen.set(item.patient.id, `${item.patient.firstName} ${item.patient.lastName}`);
    }
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PayerSection({ order, onConflict }: { order: Order; onConflict: () => void }) {
  const { can } = useMyPermissions();
  const setProfile = useSetOrderBillingProfile(order.id);
  const [changing, setChanging] = useState(false);
  const editable = can('billing.create') && (order.status === 'OPEN' || order.status === 'PAID');
  const profile = order.billingProfile;

  const handleSelect = async (selected: { id: string }) => {
    try {
      await setProfile.mutateAsync({ version: order.version, billingProfileId: selected.id });
      setChanging(false);
    } catch (error) {
      if ((error as ApiError)?.code === 'ORDER_VERSION_CONFLICT') onConflict();
    }
  };

  return (
    <Section title="Quién paga">
      {profile ? (
        <div className="text-sm">
          <p className="font-medium">{profile.legalName}</p>
          <p className="text-muted-foreground">
            {SRI_ID_TYPE_LABELS[profile.idType]} {profile.idNumber}
            {profile.email ? ` · ${profile.email}` : ''}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin receptor elegido.</p>
      )}
      {!editable && order.status !== 'OPEN' && order.status !== 'PAID' && (
        <p className="text-sm text-muted-foreground">El receptor no se puede cambiar: la orden ya no admite cambios.</p>
      )}
      {editable && !changing && (
        <Button type="button" variant="outline" size="sm" onClick={() => setChanging(true)}>
          {profile ? 'Cambiar receptor' : 'Elegir receptor'}
        </Button>
      )}
      {editable && changing && (
        <div className="space-y-2">
          <BillingProfilePicker
            patients={orderPatients(order)}
            selectedId={profile?.id}
            disabled={setProfile.isPending}
            onSelect={handleSelect}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(false)}>
            Cerrar
          </Button>
        </div>
      )}
    </Section>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const { data: order, isPending, isError, isFetching, refetch } = useOrder(orderId);
  const { data: eligibility } = useOrderEligibility(orderId);
  const [conflict, setConflict] = useState(false);

  if (isPending) return <p className="text-sm text-muted-foreground">Cargando la orden…</p>;
  // A failed background refetch keeps the order on screen: unmounting the page would drop the payment
  // form and its idempotency key.
  if (!order) return <Alert variant="destructive">No se pudo cargar la orden</Alert>;

  const onConflict = () => setConflict(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Orden #{order.number}</h1>
          <Badge variant="secondary">{STATUS_LABELS[order.status]}</Badge>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium">{formatMoney(order.total)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pagado</dt>
            <dd className="font-medium">{formatMoney(order.paidTotal)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saldo</dt>
            <dd className="font-medium">{formatMoney(order.balance)}</dd>
          </div>
        </dl>
      </div>
      {isError && (
        <Alert variant="warning">
          No se pudo actualizar la orden.
          <Button type="button" variant="link" size="sm" disabled={isFetching} onClick={() => refetch()}>
            Reintentar
          </Button>
        </Alert>
      )}
      {conflict && (
        <Alert variant="warning">
          {CONFLICT_MESSAGE}
          <Button type="button" variant="link" size="sm" onClick={() => setConflict(false)}>
            Entendido
          </Button>
        </Alert>
      )}
      <PayerSection order={order} onConflict={onConflict} />
      <Section title="Ítems">
        <OrderItems order={order} lockedReason={itemsLockedReason(order)} onConflict={onConflict} />
      </Section>
      <Section title="Pagos">
        <OrderPayments order={order} onConflict={onConflict} />
      </Section>
      <Section title="Para emitir">
        <InvoiceRequestPanel key={order.id} order={order} eligibility={eligibility} />
      </Section>
    </div>
  );
}
