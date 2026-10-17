import { CheckCircle2, Circle } from 'lucide-react';
import type { BillingEligibility, Order } from '@/types/cash';
import { eligibilityLines } from './eligibility-copy';

interface EligibilityChecklistProps {
  eligibility: BillingEligibility;
  order: Order;
}

/** What is missing before the order can be invoiced. There is no emit button in this release. */
export function EligibilityChecklist({ eligibility, order }: EligibilityChecklistProps) {
  if (eligibility.eligible) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Lista para facturar
      </p>
    );
  }

  const lines = eligibilityLines(eligibility, order);
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line, index) => (
        <li key={`${line.code}-${index}`} className="flex items-start gap-2">
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
