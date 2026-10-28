'use client';

import { useId } from 'react';
import type { Plan } from '@/content/site';
import { CustomPlanBand, PlanCard } from './plans';

/** The plans from a single professional up to a clinic with several branches, then the custom one. */
export function PlanLadder({ plans, heading = 'Planes' }: { plans: Plan[]; heading?: string }) {
  // The section can appear more than once per page, so its id must be unique.
  const titleId = useId();
  const priced = plans.filter((plan) => plan.priceMonthly !== null);
  const custom = plans.filter((plan) => plan.priceMonthly === null);

  return (
    <section aria-labelledby={titleId} className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h2 id={titleId} className="text-2xl font-bold">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Precios en USD al mes, más IVA. Todos incluyen agenda, historia clínica y facturación electrónica.</p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {priced.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
      {custom.map((plan) => (
        <div key={plan.id} className="mt-6">
          <CustomPlanBand plan={plan} />
        </div>
      ))}
    </section>
  );
}
