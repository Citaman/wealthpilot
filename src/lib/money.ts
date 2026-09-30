/**
 * Monetary values are persisted as euros for backwards compatibility, but all
 * arithmetic must go through integer cents to avoid floating-point drift.
 */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  // EPSILON compensation handles decimal inputs such as 1.005/-1.005 before
  // the value enters the integer-cent calculation path.
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

export function sumMoney(values: number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}
