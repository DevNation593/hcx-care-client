import type {
  MissingRequirement,
  TreatmentSessionDetail,
  TreatmentSessionStatus,
} from '@/types/treatments';

export type SessionStepId = 'form' | 'consent' | 'before' | 'procedure' | 'after' | 'close';

export interface SessionStep {
  id: SessionStepId;
  label: string;
  state: 'done' | 'current' | 'pending' | 'skipped' | 'blocked';
  missing: MissingRequirement[];
}

const STEP_LABELS: Record<SessionStepId, string> = {
  form: 'Ficha',
  consent: 'Consentimiento',
  before: 'Fotos antes',
  procedure: 'Procedimiento',
  after: 'Fotos después',
  close: 'Cierre',
};

// Statuses that end a session before it is clinically complete.
const ENDED: TreatmentSessionStatus[] = ['CONSENT_REFUSED', 'CONSENT_REVOKED', 'CANCELLED', 'NO_SHOW'];

/**
 * The steps of a session as the server describes it: each step is satisfied by what the API
 * reports missing, never by what the client believes. The first unsatisfied step is the current
 * one (blocked when the session ended there); the ones after it are pending. The procedure stays
 * current from the start until the session is complete; the close is a summary, done only once
 * the session is clinically complete and blocked when it ended otherwise.
 */
export function buildSessionSteps(session: TreatmentSessionDetail): SessionStep[] {
  const { policy, requirements, status } = session;
  const started = session.startedAt !== null || status === 'IN_PROGRESS' || status === 'CLINICAL_COMPLETE';
  const completed = status === 'CLINICAL_COMPLETE';
  const ended = ENDED.includes(status);
  const pick = (codes: MissingRequirement[], code: MissingRequirement) =>
    codes.includes(code) ? [code] : [];

  // Once started, the server checked the start requirements: later changes do not undo them.
  const definitions: { id: SessionStepId; skipped: boolean; satisfied: boolean; missing: MissingRequirement[] }[] = [
    {
      id: 'form',
      skipped: !policy.medicalForm.required,
      satisfied: started || !requirements.start.includes('FINALIZED_MEDICAL_FORM'),
      missing: pick(requirements.start, 'FINALIZED_MEDICAL_FORM'),
    },
    {
      id: 'consent',
      skipped: !policy.informedConsent.required,
      satisfied: started || !requirements.start.includes('SIGNED_APPLICABLE_CONSENT'),
      missing: pick(requirements.start, 'SIGNED_APPLICABLE_CONSENT'),
    },
    {
      // Without a minimum the photos are optional: the step stays visible and is met at once.
      id: 'before',
      skipped: false,
      satisfied: started || !requirements.start.includes('BEFORE_PHOTOS'),
      missing: pick(requirements.start, 'BEFORE_PHOTOS'),
    },
    {
      id: 'procedure',
      skipped: false,
      satisfied: completed,
      missing: pick(requirements.complete, 'CLINICAL_NOTES'),
    },
    {
      id: 'after',
      skipped: false,
      satisfied: completed,
      missing: pick(requirements.complete, 'AFTER_PHOTOS'),
    },
  ];

  const currentIndex = definitions.findIndex((step) => !step.skipped && !step.satisfied);

  const steps: SessionStep[] = definitions.map((step, index) => {
    const base = { id: step.id, label: STEP_LABELS[step.id] };
    if (step.skipped) return { ...base, state: 'skipped', missing: [] };
    if (currentIndex === -1 || index < currentIndex) return { ...base, state: 'done', missing: [] };
    if (index === currentIndex) {
      return { ...base, state: ended ? 'blocked' : 'current', missing: step.missing };
    }
    return { ...base, state: 'pending', missing: step.missing };
  });

  steps.push({
    id: 'close',
    label: STEP_LABELS.close,
    state: completed ? 'done' : ended ? 'blocked' : 'pending',
    missing: [],
  });
  return steps;
}
