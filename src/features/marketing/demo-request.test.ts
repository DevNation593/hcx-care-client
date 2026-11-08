import { describe, expect, it } from 'vitest';
import { demoRequestSchema, whatsappUrl } from './demo-request';

const valid = {
  name: 'Ana Vega', clinic: 'Centro Vida', email: 'ana@example.com', phone: '0991234567',
  teamSize: '2-5', message: '', acceptPrivacy: true,
};

describe('demoRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(demoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['name', { name: 'A' }],
    ['clinic', { clinic: '' }],
    ['email', { email: 'not-an-email' }],
    ['phone', { phone: '12' }],
    ['teamSize', { teamSize: '' }],
    ['message', { message: 'x'.repeat(501) }],
    ['acceptPrivacy', { acceptPrivacy: false }],
  ])('rejects an invalid %s', (field, override) => {
    const result = demoRequestSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe(field);
  });
});

describe('whatsappUrl', () => {
  it('normalizes a formatted WhatsApp number to digits', () => {
    expect(whatsappUrl('+593 99 123-4567', 'Hola')).toBe('https://wa.me/593991234567?text=Hola');
  });

  it('encodes reserved characters, line breaks and emoji so the message arrives intact', () => {
    const text = 'Clínica A&B #1\nGracias 🙂';
    const url = new URL(whatsappUrl('593991234567', text));
    expect(url.searchParams.get('text')).toBe(text);
    expect(url.hash).toBe('');
  });
});
