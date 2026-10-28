import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Plan } from '@/content/site';

/** "$24,90", "$14": cents only when there are any, with the comma used in Ecuador. */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2).replace('.', ',')}`;
}

/** "1.000": thousands grouped the way the price sheet reads. */
const formatCount = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const plural = (count: number, one: string, many: string) => `${formatCount(count)} ${count === 1 ? one : many}`;

export function formatPlanPrice(plan: Plan): string {
  return plan.priceMonthly === null ? 'A medida' : formatMoney(plan.priceMonthly);
}

export function planLimits(plan: Plan): string[] {
  const lines: string[] = [];
  if (plan.seatsIncluded !== null) lines.push(plural(plan.seatsIncluded, 'profesional', 'profesionales'));
  if (plan.maxBranches !== null) lines.push(plural(plan.maxBranches, 'sede', 'sedes'));
  if (plan.monthlyInvoices !== null) lines.push(`${formatCount(plan.monthlyInvoices)} comprobantes electrónicos al mes`);
  if (plan.maxActivePatients !== null) lines.push(`Hasta ${formatCount(plan.maxActivePatients)} pacientes activos`);
  if (plan.storageGB !== null) lines.push(`${plan.storageGB} GB de almacenamiento`);
  if (plan.includedSpecialties !== null) {
    lines.push(plural(plan.includedSpecialties, 'especialidad incluida', 'especialidades incluidas'));
  }
  if (lines.length === 0) lines.push('Profesionales, sedes y comprobantes según tu operación');
  return lines;
}

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      aria-label={plan.name}
      className={`relative flex flex-col rounded-xl border bg-background p-6 ${plan.highlighted ? 'border-primary shadow-lg ring-1 ring-primary' : ''}`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Más elegido
        </span>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      {/* Fixed heights keep the prices and the limits of every card on the same lines. */}
      <p className="mt-1 text-sm text-muted-foreground lg:min-h-10">{plan.summary}</p>
      <p className="mt-5">
        <span className="text-4xl font-bold tracking-tight">{formatPlanPrice(plan)}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">al mes + IVA</p>
      <p className="mt-1 text-sm text-muted-foreground lg:min-h-10">
        {plan.pricePerExtraSeat !== null && `${formatMoney(plan.pricePerExtraSeat)} por profesional adicional`}
      </p>
      <ul className="mt-5 flex-1 space-y-2 border-t pt-5 text-sm">
        {planLimits(plan).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/contacto"
        className={`mt-6 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium ${
          plan.highlighted
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border hover:bg-accent'
        }`}
      >
        Solicitar demo
      </Link>
    </article>
  );
}

/** A plan without a fixed price: a band under the ladder that leads to sales. */
export function CustomPlanBand({ plan }: { plan: Plan }) {
  return (
    <article
      aria-label={plan.name}
      className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-6 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h3 className="text-lg font-semibold">
          {plan.name} <span className="font-normal text-muted-foreground">· A medida</span>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.summary} {planLimits(plan).join(' · ')}.</p>
      </div>
      <Link
        href="/contacto"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
      >
        Hablar con ventas
      </Link>
    </article>
  );
}
