'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClinicalInbox } from '@/hooks/useClinicalOrders';
import { formatDate } from '@/lib/utils';
import {
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  type ClinicalFollowUp,
  type ClinicalInbox,
  type InboxOrder,
  type InboxScope,
} from '@/types/clinical-orders';
import { CloseFollowUpDialog, OrderActionDialog, type OrderAction, type OrderRef } from './order-actions';

const name = (person: { firstName: string; lastName: string } | null | undefined) =>
  person ? `${person.firstName} ${person.lastName}` : '';

function PatientLink({ patient }: { patient: { id: string; firstName: string; lastName: string } | null | undefined }) {
  if (!patient) return null;
  return (
    <Link href={`/patients/${patient.id}?tab=orders`} className="font-medium hover:underline">
      {name(patient)}
    </Link>
  );
}

function Overdue({ show }: { show: boolean }) {
  return show ? <Badge variant="destructive">Vencido</Badge> : null;
}

function Section({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {title} <Badge variant={count ? 'default' : 'secondary'}>{count}</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? <p className="text-sm text-muted-foreground">Nada pendiente.</p> : <ul className="divide-y">{children}</ul>}
      </CardContent>
    </Card>
  );
}

function OrderLine({ order, children }: { order: InboxOrder; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div>
        <PatientLink patient={order.patient} /> · {order.studyName}
        <p className="text-muted-foreground">
          Ordenada el {formatDate(order.orderedAt)} por {name(order.orderedBy)}
          {order.provider && ` · ${order.provider}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {order.priority !== 'ROUTINE' && (
          <Badge variant={order.priority === 'URGENT' ? 'destructive' : 'outline'}>
            {ORDER_PRIORITY_LABELS[order.priority]}
          </Badge>
        )}
        {children}
      </div>
    </li>
  );
}

/** How many pages the longest list of the inbox needs. */
export const pageCount = (data: ClinicalInbox) =>
  Math.max(1, ...Object.values(data.totals).map((total) => Math.ceil(total / data.pageSize)));

/**
 * The order a dialog of the inbox acts on, as the inbox shows it now. After someone else moves it
 * the inbox reloads: the order may be in another list (a result arrived), or in none (it was
 * reviewed or closed), and then the dialog says its step no longer applies.
 */
export function currentInboxOrder(data: ClinicalInbox, opened: OrderRef): { order: OrderRef; gone: boolean } {
  const pending = data.pendingReview.find((result) => result.orderId === opened.id);
  if (pending) return { order: { ...pending.order, currentResult: pending }, gone: false };
  const listed = [...data.awaitingResult, ...data.toCommunicate].find((order) => order.id === opened.id);
  return listed ? { order: listed, gone: false } : { order: opened, gone: true };
}

/**
 * The pending clinical work of the professional, or of the clinic: results to review, orders
 * still without a result, results the patient was not told about and open follow-ups. A result
 * stays here until someone reviews it, whatever happens to the patient's appointments.
 */
export function ClinicalInboxView() {
  const [scope, setScope] = useState<InboxScope>('mine');
  const [page, setPage] = useState(1);
  const inbox = useClinicalInbox(scope, page);
  const changeScope = (next: InboxScope) => {
    setScope(next);
    setPage(1);
  };
  const [acting, setActing] = useState<{ order: OrderRef; action: OrderAction } | null>(null);
  const [closing, setClosing] = useState<ClinicalFollowUp | null>(null);
  const data = inbox.data;
  // Closing the last item of the last page leaves that page out of range: go back to the new last.
  const lastPage = data ? pageCount(data) : null;
  useEffect(() => {
    if (lastPage !== null && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Inbox className="h-6 w-6" /> Pendientes clínicos
          </h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `Un resultado se marca vencido a los ${data.thresholds.resultReviewAlertDays} días sin revisar; una orden, al pasar su fecha esperada (por defecto ${data.thresholds.orderResultAlertDays} días).`
              : 'Resultados por revisar, órdenes sin resultado y seguimientos abiertos.'}
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Alcance">
          <Button variant={scope === 'mine' ? 'default' : 'outline'} onClick={() => changeScope('mine')} aria-pressed={scope === 'mine'}>
            Míos
          </Button>
          <Button variant={scope === 'all' ? 'default' : 'outline'} onClick={() => changeScope('all')} aria-pressed={scope === 'all'}>
            Todo el consultorio
          </Button>
        </div>
      </div>

      {inbox.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : inbox.isError || !data ? (
        <Alert variant="destructive">No fue posible cargar los pendientes.</Alert>
      ) : (
        <>
          <Section
            title="Resultados por revisar"
            description="Recibidos y sin revisión de un profesional. Registrarlos no informa al paciente."
            count={data.totals.pendingReview}
          >
            {data.pendingReview.map((result) => (
              <OrderLine key={result.id} order={result.order}>
                <span className="text-muted-foreground">Recibido el {formatDate(result.receivedAt)}</span>
                <Overdue show={result.overdue} />
                <Button
                  size="sm"
                  onClick={() =>
                    setActing({
                      // The whole result goes along: the dialog shows it before any decision.
                      order: { ...result.order, currentResult: result },
                      action: 'review',
                    })
                  }
                >
                  Revisar
                </Button>
              </OrderLine>
            ))}
          </Section>

          <Section
            title="Revisados, falta informar al paciente"
            description="El resultado ya tiene conducta; registra cuándo y cómo se informó."
            count={data.totals.toCommunicate}
          >
            {data.toCommunicate.map((order) => (
              <OrderLine key={order.id} order={order}>
                <Link
                  href={`/patients/${order.patientId}?tab=orders`}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Registrar comunicación
                </Link>
              </OrderLine>
            ))}
          </Section>

          <Section
            title="Órdenes sin resultado"
            description="Ordenadas, con muestra tomada o enviadas al laboratorio."
            count={data.totals.awaitingResult}
          >
            {data.awaitingResult.map((order) => (
              <OrderLine key={order.id} order={order}>
                <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
                {order.resultDueAt && (
                  <span className="text-muted-foreground">Esperado el {formatDate(order.resultDueAt)}</span>
                )}
                <Overdue show={order.overdue} />
                <Button size="sm" variant="outline" onClick={() => setActing({ order, action: 'result' })}>
                  Registrar resultado
                </Button>
              </OrderLine>
            ))}
          </Section>

          <Section
            title="Seguimientos abiertos"
            description="Se cierran solo a mano: cancelar una cita no los cierra."
            count={data.totals.followUps}
          >
            {data.followUps.map((followUp) => (
              <li key={followUp.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <PatientLink patient={followUp.patient} /> · {followUp.title}
                  <p className="text-muted-foreground">
                    Para el {formatDate(followUp.dueDate)} · {name(followUp.assignedTo)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Overdue show={followUp.overdue} />
                  <Button size="sm" variant="outline" onClick={() => setClosing(followUp)}>
                    Cerrar
                  </Button>
                </div>
              </li>
            ))}
          </Section>

          {pageCount(data) > 1 && (
            <nav aria-label="Páginas de pendientes" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Página {data.page} de {pageCount(data)}: cada lista muestra hasta {data.pageSize}, los más antiguos primero.
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anteriores
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount(data)}
                  onClick={() => setPage(page + 1)}
                >
                  Siguientes
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {acting && data && (
        <OrderActionDialog {...currentInboxOrder(data, acting.order)} action={acting.action} onClose={() => setActing(null)} />
      )}
      {closing && data && (
        <CloseFollowUpDialog
          // As the inbox shows it now; gone once someone else closed it.
          followUp={data.followUps.find((followUp) => followUp.id === closing.id) ?? closing}
          gone={!data.followUps.some((followUp) => followUp.id === closing.id)}
          onClose={() => setClosing(null)}
        />
      )}
    </div>
  );
}
