import { isUncategorized } from "./categories";
import { minDate, shiftMonth, within, type DateRange } from "./dates";
import { memo, rowsIn, type Ledger, type Scope } from "./ledger";
import { median } from "./money";
import { currentMonthKey, monthOf, monthRange } from "./periods";
import type { Transaction } from "./types";

interface MonthTotals {
  income: number;
  spending: number;
  categories: Map<string, number>;
}

/** External flows per [account, budget month], plus household totals under account "". */
const monthIndex = memo((ledger: Ledger) => {
  const index = new Map<string, MonthTotals>();
  for (const t of ledger.transactions) {
    if (t.internal || t.date > ledger.asOf) continue;
    const month = monthOf(t.date, ledger.calendar);
    for (const account of [t.account, ""]) {
      const k = JSON.stringify([account, month]);
      const totals = index.get(k) ?? {
        income: 0,
        spending: 0,
        categories: new Map(),
      };
      if (t.amount > 0) totals.income += t.amount;
      else {
        totals.spending -= t.amount;
        totals.categories.set(
          t.category,
          (totals.categories.get(t.category) ?? 0) - t.amount,
        );
      }
      index.set(k, totals);
    }
  }
  return index;
});

export interface MonthFlow {
  month: string;
  range: DateRange;
  income: number;
  spending: number;
  net: number;
  /** False for the running month: still partial. */
  complete: boolean;
}

/** The last `count` budget months ending with the current one, oldest first. Transfers excluded. */
export const monthlyFlows = memo(
  (ledger: Ledger, account: string, count: number): MonthFlow[] => {
    const index = monthIndex(ledger);
    const current = currentMonthKey(ledger.calendar, ledger.asOf);
    const flows: MonthFlow[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const month = shiftMonth(current, -i);
      const range = monthRange(month, ledger.calendar);
      if (range.from > range.to) continue;
      const totals = index.get(JSON.stringify([account, month]));
      const income = totals?.income ?? 0;
      const spending = totals?.spending ?? 0;
      flows.push({
        month,
        range,
        income,
        spending,
        net: income - spending,
        complete: range.to < ledger.asOf,
      });
    }
    return flows;
  },
);

/** Median spending per category over the three last months with data before `month`. */
export const usualSpending = memo(
  (ledger: Ledger, account: string, month: string) => {
    const index = monthIndex(ledger);
    const months = [...index.keys()]
      .map((k) => JSON.parse(k) as [string, string])
      .filter(([a, m]) => a === account && m < month)
      .map(([, m]) => m)
      .sort()
      .slice(-3);
    const categories = new Set(
      months.flatMap((m) => [
        ...index.get(JSON.stringify([account, m]))!.categories.keys(),
      ]),
    );
    return new Map(
      [...categories].map((c) => [
        c,
        median(
          months.map(
            (m) =>
              index.get(JSON.stringify([account, m]))!.categories.get(c) ?? 0,
          ),
        ),
      ]),
    );
  },
);

/** The reference never trains on the examined month: it starts before the first examined day. */
const referenceMonth = (ledger: Ledger, scope: Scope) =>
  monthOf(minDate(scope.range.from, ledger.asOf), ledger.calendar);

const spentIn = (ledger: Ledger, scope: Scope) =>
  rowsIn(ledger, scope.account).filter(
    (t) =>
      !t.internal &&
      t.amount < 0 &&
      t.date <= ledger.asOf &&
      within(t.date, scope.range),
  );

export interface CategorySpending {
  category: string;
  amount: number;
  share: number;
  usual: number | null;
  /** Rounded % vs usual; null without a usual value. */
  deltaPct: number | null;
}

export const spendingByCategory = memo(
  (ledger: Ledger, scope: Scope): CategorySpending[] => {
    const totals = new Map<string, number>();
    for (const t of spentIn(ledger, scope))
      totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount);
    const all = [...totals.values()].reduce((n, v) => n + v, 0);
    const usual = usualSpending(
      ledger,
      scope.account,
      referenceMonth(ledger, scope),
    );
    return [...totals]
      .map(([category, amount]) => {
        const u = usual.get(category) || null;
        return {
          category,
          amount,
          share: all ? amount / all : 0,
          usual: u,
          deltaPct: u ? Math.round(((amount - u) / u) * 100) : null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  },
);

export interface SubcategorySpending {
  /** "" for operations without a subcategory. */
  subcategory: string;
  amount: number;
}

/** Spending of each category split by subcategory, largest first (same rows as spendingByCategory). */
export const spendingBySubcategory = memo(
  (ledger: Ledger, scope: Scope): Map<string, SubcategorySpending[]> => {
    const totals = new Map<string, Map<string, number>>();
    for (const t of spentIn(ledger, scope)) {
      const subs = totals.get(t.category) ?? new Map<string, number>();
      const key = isUncategorized(t.category)
        ? ""
        : (t.subcategory?.trim() ?? "");
      subs.set(key, (subs.get(key) ?? 0) - t.amount);
      totals.set(t.category, subs);
    }
    return new Map(
      [...totals].map(([category, subs]) => [
        category,
        [...subs]
          .map(([subcategory, amount]) => ({ subcategory, amount }))
          .sort((a, b) => b.amount - a.amount),
      ]),
    );
  },
);

/** A descriptive threshold, never an outlier probability: > 100 € and > half the usual month. */
export const unusualExpenses = memo(
  (ledger: Ledger, scope: Scope): Transaction[] => {
    const usual = usualSpending(
      ledger,
      scope.account,
      referenceMonth(ledger, scope),
    );
    return spentIn(ledger, scope)
      .filter((t) => {
        const u = usual.get(t.category) ?? 0;
        return u > 0 && -t.amount > u * 0.5 && -t.amount > 10000;
      })
      .sort((a, b) => a.amount - b.amount);
  },
);
