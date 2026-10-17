import { describe, expect, it } from 'vitest';
import type { TreatmentRequirements, TreatmentSessionDetail } from '@/types/treatments';
import { buildSessionSteps } from './session-steps';

const policy = (overrides: Partial<TreatmentRequirements> = {}): TreatmentRequirements => ({
  medicalForm: { required: true },
  informedConsent: { required: true, validityDays: null },
  photos: { minimumBefore: 1, minimumAfter: 1 },
  clinicalNotes: { requiredForCompletion: true },
  billingGate: { requireClinicalCompletion: true },
  ...overrides,
});

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    status: 'INTAKE_IN_PROGRESS',
    startedAt: null,
    policy: policy(),
    requirements: {
      start: ['FINALIZED_MEDICAL_FORM', 'SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'],
      complete: ['CLINICAL_NOTES', 'AFTER_PHOTOS'],
    },
    ...overrides,
  }) as TreatmentSessionDetail;

const states = (detail: TreatmentSessionDetail) =>
  Object.fromEntries(buildSessionSteps(detail).map((step) => [step.id, step.state]));

describe('buildSessionSteps', () => {
  it('labels the six steps in order', () => {
    expect(buildSessionSteps(session()).map((step) => step.label)).toEqual([
      'Ficha',
      'Consentimiento',
      'Fotos antes',
      'Procedimiento',
      'Fotos después',
      'Cierre',
    ]);
  });

  it('starts at the form while the intake is in progress', () => {
    const steps = buildSessionSteps(session());

    expect(states(session())).toEqual({
      form: 'current',
      consent: 'pending',
      before: 'pending',
      procedure: 'pending',
      after: 'pending',
      close: 'pending',
    });
    expect(steps[0].missing).toEqual(['FINALIZED_MEDICAL_FORM']);
  });

  it('points at the before photos once consented, with what is missing', () => {
    const detail = session({
      status: 'CONSENTED',
      requirements: { start: ['BEFORE_PHOTOS'], complete: ['CLINICAL_NOTES', 'AFTER_PHOTOS'] },
    });
    const steps = buildSessionSteps(detail);

    expect(states(detail)).toMatchObject({
      form: 'done',
      consent: 'done',
      before: 'current',
      procedure: 'pending',
    });
    expect(steps.find((step) => step.id === 'before')?.missing).toEqual(['BEFORE_PHOTOS']);
  });

  it('skips the consent the treatment does not require', () => {
    const detail = session({
      status: 'READY_FOR_CONSENT',
      policy: policy({ informedConsent: { required: false, validityDays: null } }),
      requirements: { start: ['BEFORE_PHOTOS'], complete: [] },
    });

    expect(states(detail)).toMatchObject({ form: 'done', consent: 'skipped', before: 'current' });
  });

  it('skips the form the treatment does not require', () => {
    const detail = session({
      status: 'READY_FOR_CONSENT',
      policy: policy({ medicalForm: { required: false } }),
      requirements: { start: ['SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'], complete: [] },
    });

    expect(states(detail)).toMatchObject({ form: 'skipped', consent: 'current' });
  });

  it('keeps photo steps without a minimum visible and done once reached', () => {
    const detail = session({
      status: 'CONSENTED',
      policy: policy({ photos: { minimumBefore: 0, minimumAfter: 0 } }),
      requirements: { start: [], complete: ['CLINICAL_NOTES'] },
    });

    expect(states(detail)).toMatchObject({
      before: 'done',
      procedure: 'current',
      after: 'pending',
      close: 'pending',
    });
    expect(buildSessionSteps(detail).find((step) => step.id === 'procedure')?.missing).toEqual([
      'CLINICAL_NOTES',
    ]);
  });

  it('marks everything done or skipped once clinically complete', () => {
    const detail = session({
      status: 'CLINICAL_COMPLETE',
      startedAt: '2026-10-15T15:00:00.000Z',
      policy: policy({ informedConsent: { required: false, validityDays: null } }),
      requirements: { start: [], complete: [] },
    });
    const steps = buildSessionSteps(detail);

    expect(steps.every((step) => step.state === 'done' || step.state === 'skipped')).toBe(true);
    expect(states(detail)).toMatchObject({ consent: 'skipped', close: 'done' });
  });

  it.each(['BILLING_PENDING', 'BILLED', 'BILLING_FAILED'] as const)(
    'keeps %s as clinically complete: no step is current',
    (status) => {
      const detail = session({
        status,
        startedAt: '2026-10-15T15:00:00.000Z',
        requirements: { start: [], complete: [] },
      });
      const steps = buildSessionSteps(detail);

      expect(steps.some((step) => step.state === 'current' || step.state === 'pending')).toBe(false);
      expect(states(detail)).toMatchObject({ procedure: 'done', close: 'done' });
    },
  );

  it('keeps the procedure current while in progress, with the complete-time codes on their steps', () => {
    const detail = session({
      status: 'IN_PROGRESS',
      startedAt: '2026-10-15T15:00:00.000Z',
      requirements: { start: [], complete: ['CLINICAL_NOTES', 'AFTER_PHOTOS'] },
    });
    const steps = buildSessionSteps(detail);

    expect(states(detail)).toEqual({
      form: 'done',
      consent: 'done',
      before: 'done',
      procedure: 'current',
      after: 'pending',
      close: 'pending',
    });
    expect(steps.find((step) => step.id === 'procedure')?.missing).toEqual(['CLINICAL_NOTES']);
    expect(steps.find((step) => step.id === 'after')?.missing).toEqual(['AFTER_PHOTOS']);
    expect(steps.find((step) => step.id === 'close')?.missing).toEqual([]);
  });

  it('keeps the steps before the start done although a reused consent was revoked later', () => {
    const detail = session({
      status: 'IN_PROGRESS',
      startedAt: '2026-10-15T15:00:00.000Z',
      requirements: { start: ['SIGNED_APPLICABLE_CONSENT'], complete: [] },
    });

    expect(states(detail)).toMatchObject({
      consent: 'done',
      before: 'done',
      procedure: 'current',
      close: 'pending',
    });
  });

  it('blocks the step where a refused consent ended the session', () => {
    const detail = session({
      status: 'CONSENT_REFUSED',
      requirements: { start: ['SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'], complete: [] },
    });

    expect(states(detail)).toMatchObject({
      form: 'done',
      consent: 'blocked',
      before: 'pending',
      close: 'blocked',
    });
  });

  it('blocks the form and the close of a session cancelled during the intake', () => {
    const detail = session({ status: 'CANCELLED' });

    expect(states(detail)).toEqual({
      form: 'blocked',
      consent: 'pending',
      before: 'pending',
      procedure: 'pending',
      after: 'pending',
      close: 'blocked',
    });
  });

  it('blocks the consent and the close of a no-show waiting for consent', () => {
    const detail = session({
      status: 'NO_SHOW',
      requirements: { start: ['SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'], complete: [] },
    });

    expect(states(detail)).toMatchObject({ form: 'done', consent: 'blocked', close: 'blocked' });
  });

  it('blocks the consent and the close once the consent is revoked', () => {
    const detail = session({
      status: 'CONSENT_REVOKED',
      requirements: { start: ['SIGNED_APPLICABLE_CONSENT'], complete: [] },
    });

    expect(states(detail)).toMatchObject({
      form: 'done',
      consent: 'blocked',
      before: 'pending',
      procedure: 'pending',
      close: 'blocked',
    });
  });

  it('blocks the procedure and the close of a session cancelled after its start', () => {
    const detail = session({
      status: 'CANCELLED',
      startedAt: '2026-10-15T15:00:00.000Z',
      requirements: { start: [], complete: ['CLINICAL_NOTES', 'AFTER_PHOTOS'] },
    });

    expect(states(detail)).toEqual({
      form: 'done',
      consent: 'done',
      before: 'done',
      procedure: 'blocked',
      after: 'pending',
      close: 'blocked',
    });
  });
});
