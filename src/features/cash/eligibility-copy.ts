import type { BillingCode, BillingEligibility, ClinicalBillingCode, Order } from '@/types/cash';
import { formatMoney, parseCents } from './money';

const FINAL_CONSUMER_LIMIT_CENTS = 5000;

const CLINICAL_TEXT: Record<ClinicalBillingCode, (patient: string) => string> = {
  FINALIZED_MEDICAL_FORM: (patient) => `Falta la ficha de ${patient}`,
  SIGNED_APPLICABLE_CONSENT: (patient) => `Falta el consentimiento firmado de ${patient}`,
  CLINICAL_COMPLETION: (patient) => `La atención de ${patient} no está cerrada`,
  SESSION_NOT_BILLABLE: (patient) =>
    `La atención de ${patient} no se puede facturar (cancelada, sin consentimiento o ya facturada)`,
};

function isClinical(code: BillingCode): code is ClinicalBillingCode {
  return code in CLINICAL_TEXT;
}

function cashText(code: Exclude<BillingCode, ClinicalBillingCode>, order: Order): string {
  switch (code) {
    case 'BILLING_PROFILE': {
      const totalCents = parseCents(order.total);
      if (order.billingProfile?.idType === '07' && totalCents !== null && totalCents > FINAL_CONSUMER_LIMIT_CENTS) {
        return 'Consumidor final solo hasta $50.00: elige un receptor con identificación';
      }
      return 'Elige quién recibe la factura';
    }
    case 'INVOICE_ITEMS':
      return 'Agrega al menos un ítem con valor';
    case 'BALANCE_DUE':
      return `Saldo pendiente: ${formatMoney(order.balance)}`;
    case 'INVOICING_NOT_CONFIGURED':
      return 'Configura la facturación electrónica de la sucursal';
  }
}

/** What still stands between the order and its invoice, in Spanish; a clinical code gives one line per item. */
export function eligibilityLines(
  result: BillingEligibility,
  order: Order,
): { code: BillingCode; text: string }[] {
  return result.missing.flatMap((code): { code: BillingCode; text: string }[] => {
    if (!isClinical(code)) return [{ code, text: cashText(code, order) }];
    return result.items
      .filter((item) => item.codes.includes(code))
      .map((item) => ({ code, text: CLINICAL_TEXT[code](item.patientName) }));
  });
}
