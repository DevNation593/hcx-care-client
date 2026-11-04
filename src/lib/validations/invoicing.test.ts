import { describe, expect, it } from 'vitest';
import { emissionPointSchema, issuerSchema } from './schemas';

const issuer = (overrides: Record<string, unknown> = {}) => ({
  ruc: '1790012345001',
  legalName: 'Clínica Demo S.A.',
  tradeName: '',
  headOfficeAddress: 'Av. Amazonas N1-23',
  accountingRequired: false,
  specialTaxpayerCode: '',
  withholdingAgentCode: '',
  rimpeRegime: 'NONE',
  environment: '1',
  active: true,
  ...overrides,
});
const point = (overrides: Record<string, unknown> = {}) => ({
  establishmentCode: '001',
  emissionPointCode: '002',
  establishmentAddress: 'Av. Sucursal 5',
  nextSequential: '',
  ...overrides,
});
const fieldErrors = (result: { success: boolean; error?: { flatten: () => { fieldErrors: object } } }) =>
  result.success ? {} : result.error!.flatten().fieldErrors;

describe('issuerSchema', () => {
  it('trims the texts and sends blank optional fields as null', () => {
    expect(
      issuerSchema.parse(
        issuer({ ruc: ' 1790012345001 ', legalName: ' Clínica ', tradeName: '  ', headOfficeAddress: ' Quito ' }),
      ),
    ).toEqual({
      ruc: '1790012345001',
      legalName: 'Clínica',
      tradeName: null,
      headOfficeAddress: 'Quito',
      accountingRequired: false,
      specialTaxpayerCode: null,
      withholdingAgentCode: null,
      rimpeRegime: 'NONE',
      environment: '1',
      active: true,
    });
  });

  it.each(['179001234500', '1790012345002', '17900123450011', 'A790012345001'])('refuses the RUC %s', (ruc) => {
    expect(fieldErrors(issuerSchema.safeParse(issuer({ ruc })))).toEqual({
      ruc: ['El RUC debe tener 13 dígitos y terminar en 001.'],
    });
  });

  it('reports every invalid field at once', () => {
    const errors = fieldErrors(
      issuerSchema.safeParse(
        issuer({ ruc: '123', legalName: '  ', headOfficeAddress: '', specialTaxpayerCode: '12', withholdingAgentCode: '123456789' }),
      ),
    );
    expect(Object.keys(errors).sort()).toEqual([
      'headOfficeAddress',
      'legalName',
      'ruc',
      'specialTaxpayerCode',
      'withholdingAgentCode',
    ]);
  });

  it('limits the texts to 300 characters', () => {
    const long = 'x'.repeat(301);
    expect(issuerSchema.safeParse(issuer({ legalName: 'x'.repeat(300), tradeName: 'x'.repeat(300) })).success).toBe(true);
    expect(Object.keys(fieldErrors(issuerSchema.safeParse(issuer({ legalName: long, tradeName: long, headOfficeAddress: long })))).sort()).toEqual([
      'headOfficeAddress',
      'legalName',
      'tradeName',
    ]);
  });

  it('accepts the tax codes the API accepts and refuses the rest', () => {
    for (const code of ['123', '1234567890123'])
      expect(issuerSchema.safeParse(issuer({ specialTaxpayerCode: code })).success).toBe(true);
    for (const code of ['12', '12345678901234', '12a'])
      expect(fieldErrors(issuerSchema.safeParse(issuer({ specialTaxpayerCode: code })))).toEqual({
        specialTaxpayerCode: ['El código de contribuyente especial debe tener entre 3 y 13 dígitos.'],
      });
    for (const code of ['1', '12345678'])
      expect(issuerSchema.safeParse(issuer({ withholdingAgentCode: code })).success).toBe(true);
    for (const code of ['123456789', '1a'])
      expect(fieldErrors(issuerSchema.safeParse(issuer({ withholdingAgentCode: code })))).toEqual({
        withholdingAgentCode: ['El código de agente de retención debe tener hasta 8 dígitos.'],
      });
  });

  it('allows only the selectable RIMPE regimes and the two environments', () => {
    expect(issuerSchema.safeParse(issuer({ rimpeRegime: 'EMPRENDEDOR', environment: '2' })).success).toBe(true);
    for (const rimpeRegime of ['NEGOCIO_POPULAR', 'OTRO'])
      expect(fieldErrors(issuerSchema.safeParse(issuer({ rimpeRegime })))).toEqual({
        rimpeRegime: ['Selecciona un régimen RIMPE disponible.'],
      });
    expect(fieldErrors(issuerSchema.safeParse(issuer({ environment: '3' })))).toEqual({
      environment: ['Selecciona el ambiente.'],
    });
  });
});

describe('emissionPointSchema', () => {
  it('omits the next sequential when it was left blank', () => {
    expect(emissionPointSchema.parse(point({ establishmentAddress: ' Av. Sucursal 5 ' }))).toEqual({
      establishmentCode: '001',
      emissionPointCode: '002',
      establishmentAddress: 'Av. Sucursal 5',
      nextSequential: undefined,
    });
    expect(emissionPointSchema.parse(point({ nextSequential: '15' })).nextSequential).toBe(15);
  });

  it.each(['000', '12', '1234', 'abc'])('refuses the series code %s', (code) => {
    expect(fieldErrors(emissionPointSchema.safeParse(point({ establishmentCode: code, emissionPointCode: code })))).toEqual({
      establishmentCode: ['Debe tener tres dígitos (001); 000 no es válido.'],
      emissionPointCode: ['Debe tener tres dígitos (001); 000 no es válido.'],
    });
  });

  it('requires the establishment address up to 300 characters', () => {
    expect(fieldErrors(emissionPointSchema.safeParse(point({ establishmentAddress: ' ' })))).toEqual({
      establishmentAddress: ['Ingresa la dirección del establecimiento.'],
    });
    expect(emissionPointSchema.safeParse(point({ establishmentAddress: 'x'.repeat(301) })).success).toBe(false);
  });

  it.each(['1', '999999999'])('accepts the next sequential %s', (value) => {
    expect(emissionPointSchema.parse(point({ nextSequential: value })).nextSequential).toBe(Number(value));
  });

  it.each(['0', '1000000000', '1.5', '-3', '1e3'])('refuses the next sequential %s', (value) => {
    expect(fieldErrors(emissionPointSchema.safeParse(point({ nextSequential: value })))).toEqual({
      nextSequential: ['Debe ser un entero entre 1 y 999999999.'],
    });
  });
});
