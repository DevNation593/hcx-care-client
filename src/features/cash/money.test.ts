import { describe, expect, it } from 'vitest';
import { centsToAmount, parseCents } from './money';

describe('parseCents', () => {
  it('reads a dot as the decimal separator', () => {
    expect(parseCents('12.50')).toBe(1250);
    expect(parseCents('12')).toBe(1200);
    expect(parseCents('-2.5')).toBe(-250);
  });

  it('reads a comma as the decimal separator', () => {
    expect(parseCents('12,50')).toBe(1250);
    expect(parseCents('0,5')).toBe(50);
    expect(parseCents('-2,05')).toBe(-205);
  });

  it('rejects more than 2 decimals and malformed amounts', () => {
    expect(parseCents('12,505')).toBeNull();
    expect(parseCents('1,2,3')).toBeNull();
    expect(parseCents('1.000,50')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('')).toBeNull();
  });

  it('submits the amount with a dot', () => {
    expect(centsToAmount(parseCents('12,5') as number)).toBe('12.50');
  });
});
