import type { DateRange } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import type { TransactionFilters, TransactionSort } from "../../domain/search";
import type { Transaction } from "../../domain/types";
import type { TransactionPatch } from "../../data/commands";

export type Kind = TransactionFilters["kind"];
export type Density = "compact" | "standard" | "comfortable";

export const pageSizes = [25, 50, 75, 100, 150] as const;
const densities: readonly Density[] = ["compact", "standard", "comfortable"];
const PRESENTATION_KEY = "wealthpilot-ledger-presentation";

export interface Presentation {
  pageSize: number;
  density: Density;
}

/** v1 format kept as-is: `{ pageSize, density }`. */
export function readPresentation(): Presentation {
  try {
    const saved = JSON.parse(localStorage.getItem(PRESENTATION_KEY) ?? "{}");
    return {
      pageSize: pageSizes.includes(saved.pageSize) ? saved.pageSize : 25,
      density: densities.includes(saved.density) ? saved.density : "standard",
    };
  } catch {
    return { pageSize: 25, density: "standard" };
  }
}

export function writePresentation(p: Presentation) {
  try {
    localStorage.setItem(PRESENTATION_KEY, JSON.stringify(p));
  } catch {
    // Private mode: presentation is simply not remembered.
  }
}

/** Page-owned filters; account and period come from the reading context. */
export interface LedgerFilters {
  query: string;
  kind: Kind;
  categories: string[];
  min: number | null;
  max: number | null;
  uncategorized: boolean;
  withNote: boolean;
  sort: TransactionSort;
  /** Drilldown dates overriding the dock period. */
  range: DateRange | null;
  batchId: string | null;
}

export const defaultFilters: LedgerFilters = {
  query: "",
  kind: "all",
  categories: [],
  min: null,
  max: null,
  uncategorized: false,
  withNote: false,
  sort: "date-desc",
  range: null,
  batchId: null,
};

export const sortLabels: Record<TransactionSort, string> = {
  "date-desc": "Date ↓",
  "date-asc": "Date ↑",
  "amount-desc": "Montant ↓",
  "amount-asc": "Montant ↑",
  merchant: "Marchand A→Z",
};

/** Filters behind the « Filtres » popover (shown as chips). */
export const popoverFilterCount = (f: LedgerFilters) =>
  f.categories.length +
  Number(f.min !== null) +
  Number(f.max !== null) +
  Number(f.uncategorized) +
  Number(f.withNote);

export const hasNarrowing = (f: LedgerFilters) =>
  popoverFilterCount(f) > 0 ||
  Boolean(f.query.trim()) ||
  f.kind !== "all" ||
  f.range !== null ||
  f.batchId !== null;

/** Keeps definition ids in step with the names (DATA_COMPAT). */
export function categoryPatch(
  ledger: Ledger,
  category: string,
  subcategory?: string,
): TransactionPatch {
  const definitions = ledger.prefs.categoryDefinitions;
  const root = definitions.find((d) => !d.parentId && d.name === category);
  const child =
    root && subcategory
      ? definitions.find((d) => d.parentId === root.id && d.name === subcategory)
      : undefined;
  return {
    category,
    subcategory: subcategory || undefined,
    categoryId: root?.id,
    subcategoryId: child?.id,
  };
}

/** Operations that would take the same category as `t` (same merchant, same sign). */
export const otherCandidates = (
  similar: Transaction[],
  t: Transaction,
  category: string,
) =>
  similar.filter(
    (o) =>
      o.category !== category && Math.sign(o.amount) === Math.sign(t.amount),
  );

export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
