import { describe, expect, it } from 'vitest';
import { patientBillingDataSchema, type PatientBillingDataValues } from './schemas';

const values: PatientBillingDataValues = { identificationType: 'CEDULA', identificationNumber: '', email: '' };

describe('patientBillingDataSchema', () => {
  it('sends only what was asked, with the identification normalized and the e-mail trimmed', () => {
    const both = patientBillingDataSchema({ identification: true, email: true });
    expect(both.parse({ ...values, identificationNumber: ' 171003406-5 ', email: ' ana@example.test ' })).toEqual({
      identificationType: 'CEDULA',
      identificationNumber: '1710034065',
      email: 'ana@example.test',
    });

    const emailOnly = patientBillingDataSchema({ identification: false, email: true });
    expect(emailOnly.parse({ ...values, email: 'ana@example.test' })).toEqual({ email: 'ana@example.test' });
  });

  it('applies the SRI rules of each identification type', () => {
    const schema = patientBillingDataSchema({ identification: true, email: false });
    const issue = (input: typeof values) => schema.safeParse(input).error?.issues[0];

    expect(issue({ ...values, identificationNumber: '1710034066' })).toMatchObject({
      path: ['identificationNumber'],
      message: 'La cédula no es válida',
    });
    expect(issue(values)?.message).toBe('Escribe el número de identificación');
    expect(issue({ ...values, identificationType: 'RUC', identificationNumber: '1710034065001' })).toBeUndefined();
    expect(issue({ ...values, identificationType: 'PASSPORT', identificationNumber: 'ab-12345' })).toBeUndefined();
  });

  it('asks for a valid e-mail only when it is missing', () => {
    expect(
      patientBillingDataSchema({ identification: false, email: true }).safeParse({ ...values, email: 'ana' }).error
        ?.issues[0],
    ).toMatchObject({ path: ['email'], message: 'Escribe un correo válido' });
    expect(patientBillingDataSchema({ identification: false, email: false }).safeParse(values).success).toBe(true);
  });
});
