import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import type { ApiPlanType, PlanCatalog } from '@/types';
import contract from './plan-catalog.contract.json';
import { formatPrice, isPlanUpgrade, planLabel, toPlanView } from './plan-catalog';

/**
 * `plan-catalog.contract.json` is a copy of `api/docs/plan-catalog.contract.json`, the
 * published shape of `GET /subscription/plans` (the API has the matching test). The panel
 * reads the endpoint itself; the public pricing page is static, so it is checked here.
 */
const catalog = contract as PlanCatalog;
const views = Object.fromEntries(
  catalog.plans.map((entry) => [entry.planType, toPlanView(entry)]),
);

const SITE_PLAN_IDS: Record<string, ApiPlanType> = {
  'personal-basic': 'PERSONAL_BASIC',
  'personal-pro': 'PERSONAL_PRO',
  'clinic-basic': 'CLINIC_BASIC',
  'clinic-pro': 'CLINIC_PRO',
  enterprise: 'CLINIC_ENTERPRISE',
};

describe('plan catalog contract', () => {
  const apiCopy = resolve(__dirname, '../../../../api/docs/plan-catalog.contract.json');

  // Runs where both repositories are checked out side by side; skipped in the web's own CI.
  it.skipIf(!existsSync(apiCopy))('is identical to the copy published by the API', () => {
    expect(contract).toEqual(JSON.parse(readFileSync(apiCopy, 'utf8')));
  });

  // The individual custom plan is agreed with sales and has no entry in the catalog.
  const catalogPlans = site.plans.filter((plan) => plan.id !== 'personal-custom');

  // The trial period is a state of an account, not a plan on offer, so the site leaves it out.
  it('covers every plan the public site advertises', () => {
    expect(catalogPlans.map((plan) => SITE_PLAN_IDS[plan.id]).sort()).toEqual(
      catalog.plans.map((plan) => plan.planType).filter((planType) => planType !== 'TRIAL').sort(),
    );
  });

  it.each(catalogPlans.map((plan) => [plan.id, plan] as const))(
    'the public site shows the API price and limits for %s',
    (_id, sitePlan) => {
      const api = views[SITE_PLAN_IDS[sitePlan.id]];

      expect({
        priceMonthly: sitePlan.priceMonthly,
        pricePerExtraSeat: sitePlan.pricePerExtraSeat,
        seatsIncluded: sitePlan.seatsIncluded,
        maxActivePatients: sitePlan.maxActivePatients,
        storageGB: sitePlan.storageGB,
        monthlyNotifications: sitePlan.monthlyNotifications,
      }).toEqual({
        priceMonthly: api.priceMonthly,
        pricePerExtraSeat: api.pricePerExtraSeat,
        seatsIncluded: api.seatsIncluded,
        maxActivePatients: api.maxActivePatients,
        storageGB: api.storageGB,
        monthlyNotifications: api.monthlyNotifications,
      });
    },
  );
});

describe('plan presentation', () => {
  it('shows a paid plan with the numbers of the catalog', () => {
    expect(views.CLINIC_PRO).toMatchObject({
      group: 'clinic',
      priceMonthly: 199,
      pricePerExtraSeat: 12,
      seatsIncluded: 10,
      maxActivePatients: 500,
      storageGB: 25,
      includedSpecialties: 3,
    });
    expect(views.CLINIC_PRO.modules).toContain('Cifrado de datos clínicos');
  });

  it('treats the custom plan as unpriced and unlimited', () => {
    expect(views.CLINIC_ENTERPRISE).toMatchObject({
      priceMonthly: null,
      seatsIncluded: null,
      maxActivePatients: null,
      includedSpecialties: null,
    });
  });

  it('gives every plan in the catalog a finite storage quota', () => {
    expect(views.TRIAL.storageGB).toBe(1);
    expect(views.PERSONAL_BASIC.storageGB).toBe(2);
  });

  it('shows no storage where the plan has none', () => {
    const basic = catalog.plans.find((entry) => entry.planType === 'PERSONAL_BASIC')!;
    expect(toPlanView({ ...basic, storageGB: 0 }).storageGB).toBeNull();
  });

  it('orders plans for upgrades and names them by group', () => {
    expect(isPlanUpgrade('TRIAL', 'PERSONAL_BASIC')).toBe(true);
    expect(isPlanUpgrade('PERSONAL_PRO', 'CLINIC_BASIC')).toBe(true);
    expect(isPlanUpgrade('CLINIC_PRO', 'CLINIC_BASIC')).toBe(false);
    expect(planLabel('CLINIC_PRO')).toBe('Empresarial Pro');
    expect(planLabel('TRIAL')).toBe('Prueba');
    expect(formatPrice(1299.5)).toBe('$1,299.5');
  });
});
