const MONEY = /^-?\d+([.,]\d{1,2})?$/;

/** Cents of an amount typed by the user (a comma works as the decimal separator), or null when it is not a valid amount with up to 2 decimals. */
export function parseCents(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!MONEY.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

/** Cents as a string with 2 decimals, the way the API takes money. */
export function centsToAmount(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** An amount for display: `$12.00`, or `-$2.00` for a negative one. */
export function formatMoney(amount: string): string {
  return amount.startsWith('-') ? `-$${amount.slice(1)}` : `$${amount}`;
}
