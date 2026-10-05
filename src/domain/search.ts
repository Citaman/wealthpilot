import type { DateRange } from "./dates";
import { memo, rowsIn, type Ledger } from "./ledger";
import { isUncategorized } from "./categories";
import type { IsoDate, Transaction } from "./types";

// Search keeps its own normalisation (apostrophes removed), distinct from identity text.
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
import { merchantLabel } from "./labels";
export { merchantLabel };
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = current;
  }
  return previous[b.length];
}
function matchToken(q: string, token: string): number {
  if (token === q) return 100;
  if (token.startsWith(q)) return 90;
  if (q.length < 3) return 0;
  if (token.includes(q)) return 80;
  if (
    q.length >= 4 &&
    Math.abs(token.length - q.length) <= 2 &&
    distance(q, token) <= (q.length > 6 ? 2 : 1)
  )
    return 65;
  // Abbreviations retain letter order: mcdo → macdonalds, bnp → BNP Paribas.
  if (q.length >= 4 && token[0] === q[0] && token.length <= q.length * 2.5) {
    let at = 0;
    for (const c of token) if (c === q[at]) at++;
    if (at === q.length) return 55;
  }
  return 0;
}
const searchIndex = new WeakMap<
  Transaction,
  { source: string; tokens: string[] }
>();
export function searchScore(t: Transaction, query: string): number {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return 1;
  const source = [
    merchantLabel(t),
    t.merchant,
    t.label,
    t.category,
    t.subcategory,
    t.account,
    t.note,
  ]
    .filter(Boolean)
    .join(" ");
  let indexed = searchIndex.get(t);
  if (!indexed || indexed.source !== source) {
    indexed = { source, tokens: [...new Set(normalize(source).split(" "))] };
    searchIndex.set(t, indexed);
  }
  const tokens = indexed.tokens;
  let score = 0;
  for (const term of terms) {
    const best = Math.max(...tokens.map((token) => matchToken(term, token)));
    if (!best) return 0;
    score += best;
  }
  return score;
}

export type TransactionSort =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "merchant";

export interface TransactionFilters {
  account: string;
  range: DateRange;
  kind: "all" | "expense" | "income" | "transfer";
  categories: string[];
  /** Absolute amounts in cents. */
  min: number | null;
  max: number | null;
  uncategorized: boolean;
  withNote: boolean;
  query: string;
  sort: TransactionSort;
  batchId?: string;
}

const kindMatches = (t: Transaction, kind: TransactionFilters["kind"]) =>
  kind === "all" ||
  (kind === "transfer"
    ? t.internal
    : !t.internal && (kind === "expense" ? t.amount < 0 : t.amount > 0));

const comparators: Record<
  TransactionSort,
  (a: Transaction, b: Transaction) => number
> = {
  "date-desc": (a, b) => b.date.localeCompare(a.date),
  "date-asc": (a, b) => a.date.localeCompare(b.date),
  "amount-desc": (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  "amount-asc": (a, b) => Math.abs(a.amount) - Math.abs(b.amount),
  merchant: (a, b) => merchantLabel(a).localeCompare(merchantLabel(b), "fr"),
};

export const sortTransactions = (rows: Transaction[], sort: TransactionSort) =>
  rows.toSorted(comparators[sort]);

/** Search relevance first when a query is typed, then the chosen sort. */
/** Filter value of a subcategory: « Food › Fast Food ». */
export const subcategoryKey = (category: string, subcategory = "") =>
  subcategory ? `${category} › ${subcategory}` : category;

/** Filter value for the operations of a category that have no subcategory. */
export const NO_SUBCATEGORY = "sans sous-catégorie";

export const filterTransactions = memo(
  (ledger: Ledger, f: TransactionFilters): Transaction[] => {
    const categories = new Set(f.categories);
    const scored = rowsIn(ledger, f.account).flatMap((t) => {
      if (
        t.date < f.range.from ||
        t.date > f.range.to ||
        (f.batchId && t.batchId !== f.batchId) ||
        !kindMatches(t, f.kind) ||
        (categories.size &&
          !categories.has(t.category) &&
          !categories.has(
            subcategoryKey(t.category, t.subcategory || NO_SUBCATEGORY),
          )) ||
        (f.min !== null && Math.abs(t.amount) < f.min) ||
        (f.max !== null && Math.abs(t.amount) > f.max) ||
        (f.uncategorized && !isUncategorized(t.category)) ||
        (f.withNote && !t.note?.trim())
      )
        return [];
      const score = searchScore(t, f.query);
      return score ? [{ t, score }] : [];
    });
    const compare = comparators[f.sort];
    return scored
      .sort((a, b) => b.score - a.score || compare(a.t, b.t))
      .map(({ t }) => t);
  },
);

/** Totals exclude internal transfers and operations dated after `asOf`. */
export function summarize(rows: Transaction[], asOf: IsoDate) {
  let income = 0,
    spending = 0;
  for (const t of rows)
    if (!t.internal && t.date <= asOf) {
      if (t.amount > 0) income += t.amount;
      else spending -= t.amount;
    }
  return { count: rows.length, income, spending, net: income - spending };
}
