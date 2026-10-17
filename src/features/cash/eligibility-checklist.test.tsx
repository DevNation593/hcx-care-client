import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BillingCode, BillingEligibility, Order } from '@/types/cash';
import { EligibilityChecklist } from './eligibility-checklist';
import { eligibilityLines } from './eligibility-copy';

const order = (overrides: Partial<Order> = {}) =>
  ({
    id: 'o-1',
    total: '40.00',
    balance: '40.00',
    billingProfile: null,
    items: [],
    payments: [],
    ...overrides,
  }) as unknown as Order;

const eligibility = (
  missing: BillingCode[],
  items: BillingEligibility['items'] = [],
): BillingEligibility => ({ eligible: missing.length === 0, missing, items });

describe('eligibilityLines', () => {
  it.each([
    ['FINALIZED_MEDICAL_FORM', 'Falta la ficha de Ana Paz'],
    ['SIGNED_APPLICABLE_CONSENT', 'Falta el consentimiento firmado de Ana Paz'],
    ['CLINICAL_COMPLETION', 'La atención de Ana Paz no está cerrada'],
    [
      'SESSION_NOT_BILLABLE',
      'La atención de Ana Paz no se puede facturar (cancelada, sin consentimiento o ya facturada)',
    ],
  ] as const)('writes the clinical code %s', (code, text) => {
    const lines = eligibilityLines(
      eligibility([code], [{ itemId: 'i-1', patientName: 'Ana Paz', codes: [code] }]),
      order(),
    );
    expect(lines).toEqual([{ code, text }]);
  });

  it('writes one line per item for a clinical code', () => {
    const lines = eligibilityLines(
      eligibility(
        ['FINALIZED_MEDICAL_FORM'],
        [
          { itemId: 'i-1', patientName: 'Ana Paz', codes: ['FINALIZED_MEDICAL_FORM'] },
          { itemId: 'i-2', patientName: 'Luis Mora', codes: ['FINALIZED_MEDICAL_FORM'] },
        ],
      ),
      order(),
    );
    expect(lines.map((line) => line.text)).toEqual([
      'Falta la ficha de Ana Paz',
      'Falta la ficha de Luis Mora',
    ]);
  });

  it('writes the cash codes', () => {
    const lines = eligibilityLines(
      eligibility(['BILLING_PROFILE', 'INVOICE_ITEMS', 'BALANCE_DUE', 'INVOICING_NOT_CONFIGURED']),
      order(),
    );
    expect(lines.map((line) => line.text)).toEqual([
      'Elige quién recibe la factura',
      'Agrega al menos un ítem con valor',
      'Saldo pendiente: $40.00',
      'Configura la facturación electrónica de la sucursal',
    ]);
  });

  it('explains the final consumer limit', () => {
    const final = {
      id: 'p',
      kind: 'PERSON',
      idType: '07',
      idNumber: '9999999999999',
      legalName: 'CONSUMIDOR FINAL',
      email: null,
    } as const;
    const over = eligibilityLines(
      eligibility(['BILLING_PROFILE']),
      order({ billingProfile: final, total: '50.01' }),
    );
    expect(over[0].text).toBe('Consumidor final solo hasta $50.00: elige un receptor con identificación');

    const under = eligibilityLines(
      eligibility(['BILLING_PROFILE']),
      order({ billingProfile: final, total: '50.00' }),
    );
    expect(under[0].text).toBe('Elige quién recibe la factura');
  });
});

describe('EligibilityChecklist', () => {
  it('says the order is ready when eligible', () => {
    render(<EligibilityChecklist eligibility={eligibility([])} order={order()} />);
    expect(screen.getByText('Lista para facturar')).toBeInTheDocument();
  });

  it('lists two sessions without a form with their names', () => {
    render(
      <EligibilityChecklist
        eligibility={eligibility(
          ['FINALIZED_MEDICAL_FORM'],
          [
            { itemId: 'i-1', patientName: 'Ana Paz', codes: ['FINALIZED_MEDICAL_FORM'] },
            { itemId: 'i-2', patientName: 'Luis Mora', codes: ['FINALIZED_MEDICAL_FORM'] },
          ],
        )}
        order={order()}
      />,
    );
    expect(screen.getByText('Falta la ficha de Ana Paz')).toBeInTheDocument();
    expect(screen.getByText('Falta la ficha de Luis Mora')).toBeInTheDocument();
    expect(screen.queryByText('Lista para facturar')).not.toBeInTheDocument();
  });
});
