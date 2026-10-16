'use client';

import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRecordPayment, useRefundPayment } from '@/hooks/useOrders';
import { useMyPermissions } from '@/hooks/usePermissions';
import type { ApiError } from '@/types';
import { PAYMENT_METHOD_LABELS, type Order, type Payment, type PaymentMethod } from '@/types/cash';
import { centsToAmount, formatMoney, parseCents } from './money';

interface OrderPaymentsProps {
  order: Order;
  onConflict: () => void;
}

const SELECT_CLASS = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

function PaymentForm({ order, onConflict }: OrderPaymentsProps) {
  const record = useRecordPayment(order.id);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(order.balance);
  const [amountEdited, setAmountEdited] = useState(false);
  const [seenBalance, setSeenBalance] = useState(order.balance);
  // A refetch moves the balance: follow it unless the user typed an amount. The form never remounts.
  if (seenBalance !== order.balance) {
    setSeenBalance(order.balance);
    if (!amountEdited) setAmount(order.balance);
  }
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  // One key per opened form, kept across refetches and re-renders, rotated only after a success
  // or a 409 IDEMPOTENCY_KEY_REUSED. It is reused by every submission until one succeeds: if a lost response
  // had in fact recorded the payment, the server answers a retry with 409 instead of charging twice.
  const keyRef = useRef<string | null>(null);
  if (keyRef.current === null) keyRef.current = crypto.randomUUID();

  const cents = parseCents(amount);
  const valid = cents !== null && cents > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || cents === null) return;
    const data = {
      method,
      amount: centsToAmount(cents),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    };
    setError(null);
    try {
      await record.mutateAsync({ data, idempotencyKey: keyRef.current as string });
      keyRef.current = crypto.randomUUID();
      setAmountEdited(false);
      setReference('');
    } catch (err) {
      // Keep the form and the key so a retry is safe.
      const apiError = err as ApiError;
      // The key was used for another body: show why, and let the next attempt be deliberate.
      if (apiError?.code === 'IDEMPOTENCY_KEY_REUSED') keyRef.current = crypto.randomUUID();
      if (apiError?.code === 'ORDER_VERSION_CONFLICT') onConflict();
      setError(apiError?.message ?? 'No se pudo registrar el pago');
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
      <div>
        <Label htmlFor="pay-method">Forma de pago</Label>
        <select
          id="pay-method"
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          className={SELECT_CLASS}
        >
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((item) => (
            <option key={item} value={item}>
              {PAYMENT_METHOD_LABELS[item]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="pay-amount">
          Monto<span className="text-destructive"> *</span>
        </Label>
        <Input
          id="pay-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setAmountEdited(true);
          }}
        />
      </div>
      <div>
        <Label htmlFor="pay-reference">Referencia</Label>
        <Input id="pay-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={!valid || record.isPending}>
          Registrar pago
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

function RefundForm({
  order,
  payment,
  onDone,
  onConflict,
}: {
  order: Order;
  payment: Payment;
  onDone: () => void;
  onConflict: () => void;
}) {
  const refund = useRefundPayment(order.id);
  const [reason, setReason] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim() === '') return;
    try {
      await refund.mutateAsync({ paymentId: payment.id, data: { reason: reason.trim() } });
      onDone();
    } catch (err) {
      if ((err as ApiError)?.code === 'ORDER_VERSION_CONFLICT') onConflict();
      // The hook showed the error; the reason stays.
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-2">
      <Label htmlFor={`refund-${payment.id}`}>
        Motivo<span className="text-destructive"> *</span>
      </Label>
      <Textarea id={`refund-${payment.id}`} value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={reason.trim() === '' || refund.isPending}>
          Confirmar devolución
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function OrderPayments({ order, onConflict }: OrderPaymentsProps) {
  const { can } = useMyPermissions();
  const [refunding, setRefunding] = useState<string | null>(null);
  const canPay = can('billing.create') && order.status === 'OPEN';
  const canRefund = can('billing.adjust') && (order.status === 'OPEN' || order.status === 'PAID');

  return (
    <div className="space-y-3">
      {canPay && <PaymentForm order={order} onConflict={onConflict} />}
      {order.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
      ) : (
        <ul className="space-y-2">
          {order.payments.map((payment) => (
            <li key={payment.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {PAYMENT_METHOD_LABELS[payment.method]} · {formatMoney(payment.amount)}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(payment.receivedAt).toLocaleString('es-EC')} · {payment.receivedBy.firstName}{' '}
                    {payment.receivedBy.lastName}
                  </p>
                  {payment.status === 'REFUNDED' && payment.refundReason && (
                    <p className="text-muted-foreground">Motivo de la devolución: {payment.refundReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{payment.status === 'REFUNDED' ? 'Devuelto' : 'Registrado'}</Badge>
                  {payment.status === 'RECORDED' && canRefund && refunding !== payment.id && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setRefunding(payment.id)}>
                      Devolver
                    </Button>
                  )}
                </div>
              </div>
              {refunding === payment.id && (
                <RefundForm
                  order={order}
                  payment={payment}
                  onDone={() => setRefunding(null)}
                  onConflict={onConflict}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
