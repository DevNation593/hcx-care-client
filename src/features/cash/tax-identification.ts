import type { SriIdType } from '@/types/cash';

// Same rules as the API (billing-profiles/tax-identification.ts), copied so the form can
// warn before sending. The server stays the authority.

export const FINAL_CONSUMER_ID = '9999999999999';
export const FINAL_CONSUMER_NAME = 'CONSUMIDOR FINAL';

/** Strips spaces and hyphens; passports are also uppercased. */
export function normalizeIdNumber(idType: SriIdType, raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, '');
  return idType === '06' ? cleaned.toUpperCase() : cleaned;
}

/** Ecuadorian cedula: 10 digits, valid province, third digit 0-5, modulo 10 check digit. */
export function isValidCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(value[2]) > 5) return false;

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sum = coefficients.reduce((acc, coefficient, index) => {
    let product = coefficient * Number(value[index]);
    if (product > 9) product -= 9;
    return acc + product;
  }, 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[9]);
}

function isValidRuc(value: string): boolean {
  if (!/^\d{13}$/.test(value) || !value.endsWith('001')) return false;
  const third = Number(value[2]);
  if (third <= 5) return isValidCedula(value.slice(0, 10));
  // Public entities (6) and legal entities (9): format only.
  return third === 6 || third === 9;
}

/** The problem with an already normalized identification, or null when it is valid. */
export function taxIdentificationError(
  idType: string,
  idNumber: string,
  legalName: string,
): string | null {
  if (idType !== '07' && idNumber === FINAL_CONSUMER_ID) {
    return 'La identificación de consumidor final solo aplica al tipo 07';
  }

  switch (idType) {
    case '05':
      return isValidCedula(idNumber) ? null : 'La cédula no es válida';
    case '04':
      return isValidRuc(idNumber) ? null : 'El RUC no es válido';
    case '06':
      return /^[A-Z0-9]{3,20}$/.test(idNumber) ? null : 'El pasaporte no es válido';
    case '07':
      return idNumber === FINAL_CONSUMER_ID && legalName.trim().toUpperCase() === FINAL_CONSUMER_NAME
        ? null
        : 'El consumidor final debe usar 9999999999999 y el nombre CONSUMIDOR FINAL';
    default:
      return 'El tipo de identificación no es válido';
  }
}
