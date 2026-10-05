import { memo, type Ledger } from "./ledger";
import { knownSubcategory } from "./subcategories";
import { normalizedText } from "./text";
import type { CategoryDefinition, Transaction } from "./types";

/** Only empty or « À catégoriser »; « Autre(s) » is a real category. */
export const isUncategorized = (category: string) =>
  ["", "a categoriser"].includes(normalizedText(category));

export const CATEGORY_COLORS = [
  "#F3C447",
  "#21A9C0",
  "#E68BDC",
  "#9CCBEF",
  "#F08A5D",
  "#8FBF7A",
  "#B9A3E3",
  "#4D473F",
] as const;
// The household's everyday categories get distinct colours; a hash of only
// eight colours would make Courses and Shopping share yellow.
const USUAL_COLORS: Record<string, number> = {
  courses: 0,
  alimentation: 0,
  transport: 1,
  carburant: 1,
  restaurants: 2,
  restauration: 2,
  logement: 3,
  energie: 4,
  loisirs: 5,
  sante: 5,
  shopping: 6,
  abonnements: 7,
};

/** The aggregated « Autres » slice of a chart, always last. */
export const OTHERS_COLOR = "#CBC3B3";

export function categoryColor(
  name: string,
  definitions: CategoryDefinition[],
): string {
  const defined = definitions.find(
    (d) => !d.parentId && d.name === name,
  )?.color;
  if (defined) return defined;
  const usual = USUAL_COLORS[normalizedText(name)];
  if (usual !== undefined) return CATEGORY_COLORS[usual];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

/** Root categories in use or defined (archived ones excluded), sorted. */
export const categoryNames = memo((ledger: Ledger) => {
  const archived = new Set(
    ledger.prefs.categoryDefinitions
      .filter((d) => !d.parentId && d.archived)
      .map((d) => d.name),
  );
  const names = new Set([
    ...ledger.prefs.categoryDefinitions
      .filter((d) => !d.parentId)
      .map((d) => d.name),
    ...ledger.transactions.map((t) => t.category),
    ...ledger.budgets.map((b) => b.category),
  ]);
  return [...names]
    .filter((n) => !archived.has(n) && !isUncategorized(n))
    .sort((a, b) => a.localeCompare(b, "fr"));
});

/** Subcategories seen under a root category, sorted. */
export const subcategoryNames = memo((ledger: Ledger, category: string) => {
  const root = ledger.prefs.categoryDefinitions.find(
    (d) => !d.parentId && d.name === category,
  );
  const names = new Set([
    ...ledger.prefs.categoryDefinitions
      .filter((d) => root && d.parentId === root.id && !d.archived)
      .map((d) => d.name),
    ...ledger.transactions.flatMap((t) =>
      t.category === category && t.subcategory ? [t.subcategory] : [],
    ),
  ]);
  return [...names].sort((a, b) => a.localeCompare(b, "fr"));
});

const merchantKey = (t: Transaction) =>
  normalizedText(t.merchantName || t.merchant || t.label);

const byMerchant = memo((ledger: Ledger) => {
  const index = new Map<string, Transaction[]>();
  for (const t of ledger.transactions) {
    const rows = index.get(merchantKey(t));
    if (rows) rows.push(t);
    else index.set(merchantKey(t), [t]);
  }
  return index;
});

/** Other operations of the same merchant, e.g. to apply a category to all of them. */
export const similarTransactions = (ledger: Ledger, t: Transaction) =>
  (byMerchant(ledger).get(merchantKey(t)) ?? []).filter((o) => o.id !== t.id);

function rankCategories(rows: Transaction[], sign: number) {
  const counts = new Map<string, number>();
  for (const o of rows)
    if (!isUncategorized(o.category) && Math.sign(o.amount) === sign)
      counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

const overallRank = memo((ledger: Ledger, sign: number) =>
  rankCategories(ledger.transactions, sign),
);

/** Three categories most used for this merchant, then most used overall. */
export function suggestCategories(ledger: Ledger, t: Transaction): string[] {
  const sign = Math.sign(t.amount);
  return [
    ...new Set([
      ...rankCategories(similarTransactions(ledger, t), sign),
      ...overallRank(ledger, sign),
    ]),
  ].slice(0, 3);
}

export interface CategoryChoice {
  category: string;
  subcategory?: string;
}

function rankChoices(rows: Transaction[], sign: number) {
  const counts = new Map<string, { choice: CategoryChoice; n: number }>();
  for (const o of rows) {
    if (
      isUncategorized(o.category) ||
      o.internal ||
      Math.sign(o.amount) !== sign
    )
      continue;
    const key = JSON.stringify([o.category, o.subcategory ?? ""]);
    const entry = counts.get(key) ?? {
      choice: { category: o.category, subcategory: o.subcategory || undefined },
      n: 0,
    };
    entry.n++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.choice);
}

const overallChoices = memo((ledger: Ledger, sign: number) =>
  rankChoices(ledger.transactions, sign),
);

/**
 * Three « Category › Subcategory » choices, one per category: the merchant's
 * own history, then the category usually holding the subcategory the ledger
 * derived for this row, then the most used overall.
 */
export function suggestCategoryChoices(
  ledger: Ledger,
  t: Transaction,
): CategoryChoice[] {
  const sign = Math.sign(t.amount);
  const overall = overallChoices(ledger, sign);
  const derived = t.subcategory
    ? overall.filter((c) => c.subcategory === t.subcategory).slice(0, 1)
    : [];
  const seen = new Set<string>();
  return [
    ...rankChoices(similarTransactions(ledger, t), sign),
    ...derived,
    ...overall,
  ]
    .filter((c) => !seen.has(c.category) && seen.add(c.category))
    .slice(0, 3);
}

const subcategoryIndex = memo((ledger: Ledger) => {
  const counts = new Map<string, Map<string, number>>();
  for (const t of ledger.transactions) {
    if (!t.subcategory) continue;
    const key = JSON.stringify([t.category, merchantKey(t)]);
    const subs = counts.get(key) ?? new Map<string, number>();
    subs.set(t.subcategory, (subs.get(t.subcategory) ?? 0) + 1);
    counts.set(key, subs);
  }
  return new Map(
    [...counts].map(([key, subs]) => [
      key,
      [...subs].sort((a, b) => b[1] - a[1])[0][0],
    ]),
  );
});

/** Subcategory an expected movement (due, estimate) most likely takes: the merchant history, else a known merchant. */
export const subcategoryForLabel = (
  ledger: Ledger,
  label: string,
  category = "",
): string | undefined =>
  subcategoryIndex(ledger).get(
    JSON.stringify([category, normalizedText(label)]),
  ) ?? (category ? knownSubcategory(label) : undefined);
