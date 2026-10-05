import { subcategoryOf } from "./merchants";
import { normalizedText } from "./text";
import type { Transaction } from "./types";

// Well-known merchants, for rows that have neither a stored subcategory nor
// a history to learn from. Names follow the bank exports (English).
const KNOWN: [RegExp, string][] = [
  [
    /mc ?donald|burger king|\bkfc\b|\bquick\b|five guys|o tacos|subway|big fernand|kebab/,
    "Fast Food",
  ],
  [/uber ?eats|deliveroo|just ?eat/, "Delivery"],
  [
    /boulang|\bpaul\b|pain|patisser|starbucks|columbus|levain/,
    "Coffee & Bakery",
  ],
  [
    /lidl|carrefour|leclerc|auchan|monoprix|franprix|intermarche|\baldi\b|picard|\bg20\b|biocoop|casino|super u/,
    "Groceries",
  ],
  [/total ?energies|\besso\b|\bbp\b|\bshell\b|avia|relais/, "Fuel"],
  [/netflix|spotify|disney|deezer|prime video|canal/, "Streaming"],
  [/ratp|sncf|navigo|transilien/, "Public Transit"],
  [/\buber\b|bolt|heetch|\btaxi/, "Ride Hailing"],
  [/pharmac/, "Pharmacy"],
];

/** Subcategory of a well-known merchant name, or undefined. */
export const knownSubcategory = (text: string) =>
  KNOWN.find(([pattern]) => pattern.test(normalizedText(text)))?.[1];

const merchantKey = (t: Transaction) =>
  `${t.category}|${normalizedText(t.merchantName || t.merchant || t.label)}`;

/**
 * Fills the subcategory a row is missing, without writing it: first the raw
 * bank column, then the subcategory this merchant has elsewhere in the same
 * category, then a well-known merchant. `subcategorySource` says which.
 */
export function withSubcategories(rows: Transaction[]): Transaction[] {
  const learned = new Map<string, Map<string, number>>();
  for (const t of rows) {
    const sub = t.subcategory || subcategoryOf(t.raw ?? {});
    if (!sub) continue;
    const counts = learned.get(merchantKey(t)) ?? new Map<string, number>();
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
    learned.set(merchantKey(t), counts);
  }
  const best = (counts?: Map<string, number>) =>
    counts && [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return rows.map((t) => {
    if (t.subcategory) return t;
    const raw = subcategoryOf(t.raw ?? {});
    if (raw)
      return { ...t, subcategory: raw, subcategorySource: "raw" as const };
    const fromMerchant = best(learned.get(merchantKey(t)));
    if (fromMerchant)
      return {
        ...t,
        subcategory: fromMerchant,
        subcategorySource: "merchant" as const,
      };
    const known = knownSubcategory(
      `${t.merchantName ?? ""} ${t.merchant} ${t.label}`,
    );
    return known
      ? { ...t, subcategory: known, subcategorySource: "known" as const }
      : t;
  });
}
