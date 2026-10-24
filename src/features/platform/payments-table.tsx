'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePagination } from '@/hooks/usePagination';
import { useConfirmPayment, usePlatformPayments, useRejectPayment } from '@/hooks/usePlatform';
import { ROUTES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { paymentReferenceSchema, paymentRejectReasonSchema } from '@/lib/validations/schemas';
import type { PlatformPayment, SubscriptionPayment } from '@/types';
import { PAYMENT_KIND_LABELS, PAYMENT_STATUS_LABELS } from './labels';

type PaymentStatus = SubscriptionPayment['status'];

const selectClass =
  'h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'destructive',
  CANCELED: 'secondary',
  EXPIRED: 'secondary',
};

type Action = { type: 'confirm' | 'reject'; payment: PlatformPayment };

function errorMessage(failure: unknown, fallback: string): string {
  const message = (failure as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export function PaymentsTable() {
  const [status, setStatus] = useState<PaymentStatus | ''>('PENDING');
  const [action, setAction] = useState<Action | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError, isFetching, refetch } = usePlatformPayments(status);
  const pagination = usePagination(data ?? [], { resetKey: status });
  const confirm = useConfirmPayment();
  const reject = useRejectPayment();

  function openDialog(type: Action['type'], payment: PlatformPayment) {
    setReference('');
    setNote('');
    setReason('');
    setError(null);
    setAction({ type, payment });
  }

  async function submit() {
    if (!action) return;
    try {
      if (action.type === 'confirm') {
        const parsed = paymentReferenceSchema.safeParse(reference);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setError(null);
        const trimmedNote = note.trim();
        await confirm.mutateAsync({
          id: action.payment.id,
          reference: parsed.data,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        });
      } else {
        const parsed = paymentRejectReasonSchema.safeParse(reason);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setError(null);
        await reject.mutateAsync({ id: action.payment.id, reason: parsed.data });
      }
      setAction(null);
    } catch (failure) {
      setError(
        errorMessage(
          failure,
          action.type === 'confirm' ? 'No se pudo confirmar el pago' : 'No se pudo rechazar el pago',
        ),
      );
    }
  }

  const isConfirm = action?.type === 'confirm';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="payment-status" className="mb-1 block text-sm font-medium">
          Estado
        </label>
        <select
          id="payment-status"
          className={selectClass}
          value={status}
          onChange={(event) => setStatus(event.target.value as PaymentStatus | '')}
        >
          <option value="">Todos</option>
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((value) => (
            <option key={value} value={value}>
              {PAYMENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <Skeleton className="h-48" aria-busy="true" />
      ) : isError || !data ? (
        <div className="space-y-3">
          <Alert variant="destructive" title="No se pudo cargar el listado de pagos" />
          <Button variant="outline" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No hay pagos con este estado
          </CardContent>
        </Card>
      ) : (
        <Card className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultorio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageItems.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      href={ROUTES.PLATFORM_TENANT_DETAIL(payment.tenant.id)}
                      className="font-medium hover:underline"
                    >
                      {payment.tenant.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{payment.tenant.email}</p>
                  </TableCell>
                  <TableCell>{PAYMENT_KIND_LABELS[payment.kind]}</TableCell>
                  <TableCell>{payment.planName}</TableCell>
                  <TableCell>
                    {payment.amount} {payment.currency}
                  </TableCell>
                  <TableCell>{formatDate(payment.createdAt, 'PP')}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {payment.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => openDialog('confirm', payment)}>
                          Confirmar pago
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openDialog('reject', payment)}>
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />

      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <DialogHeader>
            <DialogTitle id="payment-dialog-title">{isConfirm ? '¿Confirmar pago?' : '¿Rechazar pago?'}</DialogTitle>
            <DialogDescription>
              {isConfirm
                ? `Al confirmar, ${action?.payment.tenant.name} paga su período de ${action?.payment.planName ?? ''}. Cada referencia confirma un solo pago.`
                : `El pago de ${action?.payment.tenant.name} quedará rechazado. El motivo queda registrado.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isConfirm ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="payment-reference">Referencia</Label>
                  <Input
                    id="payment-reference"
                    value={reference}
                    maxLength={120}
                    onChange={(event) => setReference(event.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'payment-action-error' : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-note">Nota (opcional)</Label>
                  <Input id="payment-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="payment-reason">Motivo del rechazo</Label>
                <Input
                  id="payment-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'payment-action-error' : undefined}
                />
              </div>
            )}
            {error && (
              <p id="payment-action-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={isConfirm ? 'default' : 'destructive'}
              loading={confirm.isPending || reject.isPending}
              onClick={() => void submit()}
            >
              {isConfirm ? 'Confirmar pago' : 'Rechazar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
