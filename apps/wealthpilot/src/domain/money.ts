import type { Cents } from "./types";

const NARROW_NBSP = " ";
const MINUS = "−";

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(decimals: number) {
  const key = String(decimals);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  /** "auto" drops cents on whole amounts; "always" keeps them; "never" rounds. */
  cents?: "auto" | "always" | "never";
  /** Prefix positive values with "+". */
  signed?: boolean;
}

/** `−1 234,50 €` with a true minus and narrow no-break spaces. */
export function formatEuro(value: Cents, options: FormatOptions = {}): string {
  const { cents = "auto", signed = false } = options;
  const abs = Math.abs(value);
  const decimals =
    cents === "always" ? 2 : cents === "never" ? 0 : abs % 100 === 0 ? 0 : 2;
  const number = formatter(decimals)
    .format((decimals ? abs : Math.round(abs / 100) * 100) / 100)
    .replace(/[\s ]/g, NARROW_NBSP);
  const sign = value < 0 ? MINUS : signed && value > 0 ? "+" : "";
  return `${sign}${number}${NARROW_NBSP}€`;
}

/** Parses French or English bank amounts into cents; null when ambiguous. */
export function parseMoney(value: string): Cents | null {
  let s = value
    .trim()
    .replace(/[€\s  ]/g, "")
    .replace(/EUR/gi, "")
    .replace(/−/g, "-");
  if (!s) return null;
  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf("."))
      s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) s = s.replace(",", ".");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole, fraction = ""] = s.replace(/^[+-]/, "").split(".");
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (negative ? -1 : 1);
  return Number.isSafeInteger(result) && Math.abs(result) <= 1e12
    ? result
    : null;
}

export const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

export const sumBy = <T>(items: readonly T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

/** Mean of the two middle values, rounded to the cent. 0 for an empty list. */
export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
  );
}

/** Upper of the two middle values. Kept where income-period and recurrence
 * detection used it, so existing budget-month boundaries do not move. */
export function upperMedian(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
