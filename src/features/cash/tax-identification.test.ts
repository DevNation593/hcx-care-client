import { describe, expect, it } from 'vitest';
import { isValidCedula, normalizeIdNumber, taxIdentificationError } from './tax-identification';

describe('taxIdentificationError', () => {
  it.each([
    ['05', '1710034065', ''],
    ['04', '1710034065001', ''],
    ['04', '1790012345001', ''],
    ['04', '1760001550001', ''],
    ['06', 'AB123', ''],
    ['07', '9999999999999', 'Consumidor Final'],
  ])('accepts %s %s', (idType, idNumber, name) => {
    expect(taxIdentificationError(idType, idNumber, name)).toBeNull();
  });

  it.each([
    ['05', '1710034066', ''],
    ['05', '2510034065', ''],
    ['05', '1760034065', ''],
    ['05', '171003406', ''],
    ['04', '1710034065002', ''],
    ['04', '1710034066001', ''],
    ['04', '1780012345001', ''],
    ['04', '9999999999999', ''],
    ['06', 'A*1', ''],
    ['06', 'AB', ''],
    ['07', '9999999999999', 'Ana'],
    ['03', '1710034065', ''],
  ])('rejects %s %s', (idType, idNumber, name) => {
    expect(taxIdentificationError(idType, idNumber, name)).toEqual(expect.any(String));
  });
});

describe('normalizeIdNumber', () => {
  it('strips spaces and hyphens, and uppercases passports', () => {
    expect(normalizeIdNumber('05', ' 1710034065 ')).toBe('1710034065');
    expect(normalizeIdNumber('06', 'ab-123')).toBe('AB123');
  });
});

describe('isValidCedula', () => {
  it('checks the check digit', () => {
    expect(isValidCedula('1710034065')).toBe(true);
    expect(isValidCedula('1710034066')).toBe(false);
  });
});
