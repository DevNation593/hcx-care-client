import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl, resolveContactChannel, site } from './site';

describe('site content', () => {
  it('has exactly five frequently asked questions with text', () => {
    expect(site.faq).toHaveLength(5);
    for (const item of site.faq) {
      expect(item.question.trim()).not.toBe('');
      expect(item.answer.trim()).not.toBe('');
    }
  });

  it('publishes the plans on offer in the API with their prices and limits', () => {
    const summary = site.plans.map((plan) => [
      plan.name, plan.priceMonthly, plan.pricePerExtraSeat, plan.seatsIncluded, plan.maxBranches, plan.monthlyInvoices,
    ]);
    expect(summary).toEqual([
      ['Esencial', 24.9, null, 1, 1, 30],
      ['Profesional', 44.9, 14, 3, 1, 100],
      ['Centro', 79.9, 12, 6, 2, 300],
      ['Clínica', 149.9, 10, 15, 5, 1000],
      ['Personalizado', null, null, null, null, null],
    ]);
  });

  it('offers no free plan', () => {
    expect(site.plans.filter((plan) => plan.priceMonthly === 0)).toEqual([]);
    const faq = site.faq.map((item) => `${item.question} ${item.answer}`).join(' ');
    expect(faq).not.toMatch(/plan prueba|gratis|gratuit/i);
  });

  it('names the company that owns the rights', () => {
    expect(site.legal.companyName).toBe('DEVNATION TECHNOLOGIES S.A.S.');
  });

  it('highlights exactly one plan', () => {
    expect(site.plans.filter((plan) => plan.highlighted).map((plan) => plan.name)).toEqual(['Profesional']);
  });

  it('gives every plan a distinct name', () => {
    expect(new Set(site.plans.map((plan) => plan.name)).size).toBe(site.plans.length);
  });

  it('ships without invented real-world content', () => {
    expect(site.reviews).toEqual([]);
    expect(site.caseStudies).toEqual([]);
    expect(site.team).toEqual([]);
    expect(site.location).toBeNull();
    expect(site.legal.reviewed).toBe(false);
  });

  it('gives every image alternative text', () => {
    const images = [
      ...site.team.map((member) => member.photo),
      ...site.reviews.flatMap((review) => (review.photo ? [review.photo] : [])),
      ...site.caseStudies.flatMap((item) => (item.image ? [item.image] : [])),
    ];
    for (const image of images) expect(image.alt.trim()).not.toBe('');
  });
});

describe('resolveContactChannel', () => {
  const base = { responseTime: 'x' };
  it('prefers WhatsApp, then email, then none', () => {
    expect(resolveContactChannel({ ...base, whatsappNumber: '593991234567', email: 'a@b.co' })).toBe('whatsapp');
    expect(resolveContactChannel({ ...base, whatsappNumber: '', email: 'a@b.co' })).toBe('email');
    expect(resolveContactChannel({ ...base, whatsappNumber: ' ', email: '' })).toBe('none');
  });
});

describe('normalizeBaseUrl', () => {
  it('falls back to localhost and strips trailing slashes', () => {
    expect(normalizeBaseUrl(undefined)).toBe('http://localhost:4200');
    expect(normalizeBaseUrl('')).toBe('http://localhost:4200');
    expect(normalizeBaseUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeBaseUrl('https://example.com///')).toBe('https://example.com');
  });

  it('always returns a URL the app can parse', () => {
    expect(normalizeBaseUrl('midominio.com')).toBe('https://midominio.com');
    expect(normalizeBaseUrl('midominio.com/')).toBe('https://midominio.com');
    expect(normalizeBaseUrl('not a url')).toBe('http://localhost:4200');
    for (const raw of [undefined, '', 'midominio.com', 'not a url', 'https://example.com/']) {
      expect(() => new URL(normalizeBaseUrl(raw))).not.toThrow();
    }
  });
});
