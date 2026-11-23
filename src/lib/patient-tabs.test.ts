import { describe, expect, it } from 'vitest';
import {
  PATIENT_TAB_IDS,
  parsePatientTab,
  patientTabHref,
  RETURN_TAB_PARAM,
  withReturnTab,
} from './patient-tabs';

describe('parsePatientTab', () => {
  it.each(PATIENT_TAB_IDS)('accepts the tab %s', (tab) => {
    expect(parsePatientTab(tab)).toBe(tab);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty text', ''],
    ['an unknown tab', 'admin'],
    ['another case', 'Clinical'],
    ['an external URL', 'https://evil.example'],
    ['a protocol-relative URL', '//evil.example'],
    ['a script', 'javascript:alert(1)'],
    ['a path', '../admin'],
    ['a tab followed by more parameters', 'clinical&next=/x'],
    ['an object name from the prototype', 'constructor'],
    ['a number', 5],
  ])('refuses %s', (_label, value) => {
    expect(parsePatientTab(value)).toBeUndefined();
  });
});

describe('patientTabHref', () => {
  it('opens a tab of the patient', () => {
    expect(patientTabHref('p1', 'clinical')).toBe('/patients/p1?tab=clinical');
  });

  it('encodes a patient id that is not a plain slug, so it cannot leave /patients/', () => {
    expect(patientTabHref('../../evil?x=1', 'clinical')).toBe(
      '/patients/..%2F..%2Fevil%3Fx%3D1?tab=clinical',
    );
    expect(patientTabHref('//evil.example', 'clinical').startsWith('/patients/')).toBe(true);
  });
});

describe('withReturnTab', () => {
  it('adds the tab the link is followed from', () => {
    expect(withReturnTab('/treatment-sessions/s1', 'clinical')).toBe(
      `/treatment-sessions/s1?${RETURN_TAB_PARAM}=clinical`,
    );
  });

  it('joins an existing query with &', () => {
    expect(withReturnTab('/x?a=1', 'treatments')).toBe('/x?a=1&from=treatments');
  });

  it('leaves the link as it is without a tab', () => {
    expect(withReturnTab('/treatment-sessions/s1', undefined)).toBe('/treatment-sessions/s1');
  });
});
